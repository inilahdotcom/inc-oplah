import { beforeAll, describe, expect, it, vi } from 'vitest';
import { as, sampleMo, submittedMo } from '../../test/helpers';

vi.mock('../../lib/storage', () => ({
  putObject: vi.fn(async () => undefined),
  getObject: vi.fn(async () => null),
  signedUrl: vi.fn(async (key: string | null) => (key ? `https://signed.example/${key}` : null)),
}));
vi.mock('../../lib/pdf', () => ({ renderPdf: vi.fn(async () => Buffer.from('%PDF-mock')) }));

const PDF = Buffer.from('%PDF-1.4 lampiran');
let sample: Record<string, unknown>;
let ackName: string;

beforeAll(async () => {
  ({ sample, ackName } = await sampleMo());
});

const createSubmitted = () => submittedMo(sample);

describe('Pajak', () => {
  it('AC M3: 20.000.000 → DPP 18.333.333, PPN 2.200.000, Total 22.200.000', async () => {
    const res = await (await as('ADMIN_SALES')).post('/media-orders/calculate').send({ subtotal: '20000000', isTaxable: true });
    expect(res.body).toMatchObject({ dpp: '18333333', ppn: '2200000', total: '22200000' });
    expect((await (await as('FINANCE')).post('/media-orders/calculate').send({ subtotal: '1' })).status).toBe(403);
  });
});

describe('Draft & submit', () => {
  it('draft boleh belum lengkap; submit memvalidasi penuh', async () => {
    const s = await as('ADMIN_SALES');
    const { benefits: _b, cooperationDetail: _c, ...partial } = sample;
    const draft = await s.post('/media-orders').send({ ...partial, subtotal: '0' });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: 'DRAFT', moNumber: null });

    const res = await s.post(`/media-orders/${draft.body.id}/submit`);
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['benefits', 'cooperationDetail', 'subtotal']));

    expect((await (await as('FINANCE')).post('/media-orders').send(sample)).status).toBe(403);
    expect((await s.post('/media-orders').send({ ...sample, clientId: undefined })).status).toBe(400);
  });

  it('submit: nomor, snapshot pajak & penandatangan; AC M3: MO SUBMITTED terkunci (409)', async () => {
    const mo = await createSubmitted();
    expect(mo).toMatchObject({ status: 'SUBMITTED', dppAmount: '18333333', ppnAmount: '2200000', totalAmount: '22200000' });
    expect(mo.moNumber).toMatch(/^\d{3}\/MO-BMO\/INC\/V\/2026$/);
    expect(mo.signatories.acknowledgedBy.name).toBe(ackName);

    const s = await as('ADMIN_SALES');
    const patch = await s.patch(`/media-orders/${mo.id}`).send(sample);
    expect(patch.status).toBe(409);
    expect(patch.body.error.code).toBe('MO_LOCKED');
    expect((await s.patch(`/media-orders/${mo.id}`).send({})).status).toBe(409);
    expect((await s.delete(`/media-orders/${mo.id}`)).status).toBe(409);
    expect((await s.post(`/media-orders/${mo.id}/submit`)).status).toBe(409);
  });

  it('AC M3: 20 submit paralel → 20 nomor unik & berurutan', async () => {
    const s = await as('ADMIN_SALES');
    const ids = await Promise.all(Array.from({ length: 20 }, async () => (await s.post('/media-orders').send(sample)).body.id as string));
    const done = await Promise.all(ids.map((id) => s.post(`/media-orders/${id}/submit`)));
    expect(done.every((r) => r.status === 200)).toBe(true);
    const seqs = done.map((r) => Number(r.body.moNumber.split('/')[0])).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(20);
    expect(seqs.at(-1)! - seqs[0]).toBe(19);
  });

  it('draft bisa diubah & dihapus', async () => {
    const s = await as('ADMIN_SALES');
    const draft = (await s.post('/media-orders').send(sample)).body;
    const upd = await s.patch(`/media-orders/${draft.id}`).send({ ...sample, subtotal: '12' });
    expect(upd.body).toMatchObject({ subtotal: '12', dppAmount: '11', ppnAmount: '1', totalAmount: '13' });
    expect((await s.delete(`/media-orders/${draft.id}`)).status).toBe(204);
    expect((await s.get(`/media-orders/${draft.id}`)).status).toBe(404);
  });
});

describe('Batal, revisi, duplikat', () => {
  it('batal wajib alasan; MO batal tidak bisa dibatalkan lagi', async () => {
    const mo = await createSubmitted();
    const s = await as('ADMIN_SALES');
    expect((await s.post(`/media-orders/${mo.id}/cancel`).send({ reason: ' ' })).status).toBe(400);
    const res = await s.post(`/media-orders/${mo.id}/cancel`).send({ reason: 'Klien mundur' });
    expect(res.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Klien mundur' });
    expect((await s.post(`/media-orders/${mo.id}/cancel`).send({ reason: 'x' })).status).toBe(409);
  });

  it('revisi membatalkan MO lama ("Direvisi") dan membuat draft salinan', async () => {
    const mo = await createSubmitted();
    const s = await as('ADMIN_SALES');
    const rev = await s.post(`/media-orders/${mo.id}/revise`);
    expect(rev.status).toBe(201);
    expect(rev.body).toMatchObject({ status: 'DRAFT', revisionOf: { id: mo.id, moNumber: mo.moNumber }, subtotal: '20000000' });
    expect(rev.body.benefits).toHaveLength(1);
    const old = (await s.get(`/media-orders/${mo.id}`)).body;
    expect(old).toMatchObject({ status: 'CANCELLED', cancelReason: 'Direvisi', revisedInto: { id: rev.body.id } });
    expect((await s.post(`/media-orders/${mo.id}/revise`)).status).toBe(409);
  });

  it('duplikat membuat draft baru tanpa nomor', async () => {
    const mo = await createSubmitted();
    const dup = await (await as('ADMIN_SALES')).post(`/media-orders/${mo.id}/duplicate`);
    expect(dup.status).toBe(201);
    expect(dup.body).toMatchObject({ status: 'DRAFT', moNumber: null, revisionOf: null, description: 'Publikasi Rilis Artikel' });
  });
});

describe('Lampiran & PDF', () => {
  it('lampiran PDF pada MO SUBMITTED → ACTIVE; draft ditolak; tipe lain ditolak', async () => {
    const s = await as('ADMIN_SALES');
    const mo = await createSubmitted();
    const up = await s.post(`/media-orders/${mo.id}/attachments`).attach('file', PDF, 'mo-ttd.pdf');
    expect(up.status).toBe(201);
    expect(up.body.status).toBe('ACTIVE');
    expect(up.body.attachments[0]).toMatchObject({ fileName: 'mo-ttd.pdf', mimeType: 'application/pdf' });
    expect((await s.post(`/media-orders/${mo.id}/attachments`).attach('file', Buffer.from('MZ-exe'), 'x.pdf')).status).toBe(400);

    const draft = (await s.post('/media-orders').send(sample)).body;
    expect((await s.post(`/media-orders/${draft.id}/attachments`).attach('file', PDF, 'a.pdf')).status).toBe(409);
  });

  it('unduh PDF memakai nama file PRD §8; semua role boleh unduh; generate ulang hanya SA', async () => {
    const mo = await createSubmitted();
    const res = await (await as('VIEWER')).get(`/media-orders/${mo.id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(`MO_${mo.moNumber.replaceAll('/', '-')}_PT_BUKIT_ASAM_TBK_Juni_2026-Mei_2027.pdf`);
    expect((await (await as('ADMIN_SALES')).post(`/media-orders/${mo.id}/pdf/regenerate`)).status).toBe(403);
    expect((await (await as('SUPER_ADMIN')).post(`/media-orders/${mo.id}/pdf/regenerate`)).status).toBe(204);
  });
});
