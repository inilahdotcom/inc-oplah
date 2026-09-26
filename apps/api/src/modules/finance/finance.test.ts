import { beforeAll, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { prisma } from '../../lib/prisma';
import { periodEndingReminder } from '../../jobs';
import { as, sampleMo, submittedMo } from '../../test/helpers';

vi.mock('../../lib/storage', () => ({
  putObject: vi.fn(async () => undefined),
  getObject: vi.fn(async () => null),
  signedUrl: vi.fn(async (key: string | null) => (key ? `https://signed.example/${key}` : null)),
}));
vi.mock('../../lib/pdf', () => ({ renderPdf: vi.fn(async () => Buffer.from('%PDF-mock')) }));

let sample: Record<string, unknown>;
beforeAll(async () => {
  ({ sample } = await sampleMo());
});

const tag = () => Math.random().toString(36).slice(2, 8);
const fulfil = async (mo: { id: string; benefitProgress: { id: string }[] }) =>
  (await as('ADMIN_SALES')).post(`/media-orders/${mo.id}/publications/bulk`).send({
    moBenefitId: mo.benefitProgress[0].id,
    publishedDate: '2026-07-01',
    urls: Array.from({ length: 12 }, (_, i) => `https://inilah.com/fin/${tag()}-${i}`),
  });

describe('Daftar MO & ekspor', () => {
  it('AC M5: filter "Periode Tayang Juli 2026" memunculkan MO contoh (overlap); Tanggal MO Juli tidak', async () => {
    const fin = await as('FINANCE');
    const mo = await submittedMo(sample); // tanggal MO Mei 2026, periode Jun 2026 – Mei 2027
    const early = await submittedMo({ ...sample, periodStart: '2026-01-01', periodEnd: '2026-06-30' });
    const q = (s: string) => fin.get(`/media-orders?limit=200&${s}`).then((r) => r.body.data.map((m: { id: string }) => m.id));

    const period = await q('dateField=period&from=2026-07&to=2026-07');
    expect(period).toContain(mo.id);
    expect(period).not.toContain(early.id);
    expect(await q('dateField=mo_date&from=2026-07&to=2026-07')).not.toContain(mo.id);
    expect(await q(`q=${encodeURIComponent(mo.moNumber)}`)).toEqual([mo.id]);
  });

  it('AC M5: ekspor Excel berisi kolom & angka yang sama dengan tabel', async () => {
    const fin = await as('FINANCE');
    const mo = await submittedMo(sample);
    const q = `q=${encodeURIComponent(mo.moNumber)}`;
    const list = (await fin.get(`/media-orders?${q}`)).body;
    const res = await fin.get(`/finance/media-orders/export?format=xlsx&${q}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body);
    const ws = wb.worksheets[0];
    const header = (ws.getRow(1).values as string[]).slice(1);
    expect(header.slice(0, 8)).toEqual(['Nomor MO', 'Tanggal MO', 'Periode Tayang', 'Perusahaan / Instansi', 'Nama Sales', 'Nominal sebelum PPN', 'PPN', 'Nominal setelah PPN']);
    expect(header).toContain('Benefit: Artikel Rilis');
    const row = ws.getRow(2);
    const r = list.data[0];
    expect([row.getCell(1).value, row.getCell(3).value, row.getCell(6).value, row.getCell(7).value, row.getCell(8).value]).toEqual([
      r.moNumber,
      'Jun 2026 – Mei 2027',
      Number(r.subtotal),
      Number(r.ppnAmount),
      Number(r.totalAmount),
    ]);
    expect(typeof row.getCell(6).value).toBe('number');
    expect(list.totals).toEqual({ subtotal: '20000000', ppnAmount: '2200000', totalAmount: '22200000' });

    const csv = await fin.get(`/finance/media-orders/export?format=csv&${q}`);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`${mo.moNumber},`);
    expect((await (await as('VIEWER')).get(`/finance/media-orders/export?${q}`)).status).toBe(403);
  });
});

describe('Penagihan', () => {
  it('BILLED → sebagian dibayar → PAID; realisasi terkunci setelah ditagih', async () => {
    const fin = await as('FINANCE');
    const mo = await submittedMo(sample);
    await fulfil(mo);
    expect((await fin.get(`/media-orders/${mo.id}`)).body.billingStatus).toBe('READY_TO_BILL');

    expect((await fin.post(`/media-orders/${mo.id}/billings`).send({ invoiceNo: 'INV-1', invoiceDate: '2026-09-01', amount: '22200001' })).status).toBe(400);
    const b1 = (await fin.post(`/media-orders/${mo.id}/billings`).send({ invoiceNo: 'INV-1', invoiceDate: '2026-09-01', amount: '12000000' })).body;
    const b2 = (await fin.post(`/media-orders/${mo.id}/billings`).send({ invoiceNo: 'INV-2', invoiceDate: '2026-10-01', amount: '10200000' })).body;
    expect((await fin.post(`/media-orders/${mo.id}/billings`).send({ invoiceNo: 'INV-1', invoiceDate: '2026-09-01', amount: '1' })).status).toBe(400); // sudah tertagih penuh
    expect((await fin.get(`/media-orders/${mo.id}`)).body.billingStatus).toBe('BILLED');

    await fin.patch(`/billings/${b1.id}`).send({ paidDate: '2026-09-10', paidAmount: '12000000', receiptNo: 'KW-1' });
    expect((await fin.get(`/media-orders/${mo.id}`)).body.billingStatus).toBe('BILLED');
    await fin.patch(`/billings/${b2.id}`).send({ paidDate: '2026-10-10', paidAmount: '10200000' });
    const paid = (await fin.get(`/media-orders/${mo.id}`)).body;
    expect(paid.billingStatus).toBe('PAID');
    expect(paid.billings).toHaveLength(2);

    const s = await as('ADMIN_SALES');
    expect((await s.post(`/media-orders/${mo.id}/publications`).send({ moBenefitId: mo.benefitProgress[0].id, publishedDate: '2026-07-01', url: 'https://inilah.com/x-late', isBonus: true })).status).toBe(409);
    expect((await s.post(`/media-orders/${mo.id}/billings`).send({ invoiceNo: 'X', invoiceDate: '2026-09-01', amount: '1' })).status).toBe(403);

    const hist = (await fin.get(`/media-orders/${mo.id}/history`)).body.data as { action: string; summary: string | null; userName: string }[];
    expect(hist.some((h) => h.action === 'Disubmit')).toBe(true);
    expect(hist.some((h) => h.summary?.startsWith('Tagihan INV-2'))).toBe(true);
    expect(hist.some((h) => h.summary?.startsWith('Realisasi:') || h.action === 'Status berubah')).toBe(true);
  });

  it('menagih sebelum benefit 100% wajib alasan & memberi tahu Super Admin', async () => {
    const fin = await as('FINANCE');
    const sa = await as('SUPER_ADMIN');
    const before = (await sa.get('/notifications')).body.unread;
    const mo = await submittedMo(sample);
    const body = { invoiceNo: `T-${tag()}`, invoiceDate: '2026-09-01', amount: '5000000' };
    const missing = await fin.post(`/media-orders/${mo.id}/billings`).send(body);
    expect(missing.status).toBe(400);
    expect(missing.body.error.details[0].field).toBe('overrideReason');
    const ok = await fin.post(`/media-orders/${mo.id}/billings`).send({ ...body, overrideReason: 'Termin September sesuai T&C' });
    expect(ok.status).toBe(201);
    expect(ok.body.overrideReason).toBe('Termin September sesuai T&C');
    expect((await sa.get('/notifications')).body.unread).toBe(before + 1);
  });
});

describe('Dashboard & job', () => {
  it('dashboard: KPI & 12 bulan; RBAC', async () => {
    const d = (await (await as('VIEWER')).get('/finance/dashboard?year=2026')).body;
    expect(d.year).toBe(2026);
    expect(d.months).toHaveLength(12);
    expect(d.moCount).toBeGreaterThan(0);
    expect(Number(d.contractValue)).toBeGreaterThan(0);
    expect((await (await as('ADMIN_SALES')).get('/finance/dashboard')).status).toBe(403);
  });

  it('H-30: notifikasi sekali ke pembuat MO yang periodenya hampir berakhir & belum 100%', async () => {
    const mo = await submittedMo(sample); // periode berakhir 2027-05-31
    const creator = (await prisma.mediaOrder.findUniqueOrThrow({ where: { id: mo.id } })).createdBy;
    expect(await periodEndingReminder(new Date('2027-05-10'))).toBeGreaterThan(0);
    const n = await prisma.notification.findMany({ where: { userId: creator, type: 'MO_PERIOD_ENDING' } });
    expect(n.some((x) => (x.payload as { moId: string }).moId === mo.id)).toBe(true);
    expect(await periodEndingReminder(new Date('2027-05-10'))).toBe(0);
  });
});
