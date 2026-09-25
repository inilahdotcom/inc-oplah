import { describe, expect, it, vi } from 'vitest';
import { as } from '../../test/helpers';

// Test tidak menyentuh DigitalOcean Spaces.
vi.mock('../../lib/storage', () => ({
  putObject: vi.fn(async () => undefined),
  signedUrl: vi.fn(async (key: string | null) => (key ? `https://signed.example/${key}` : null)),
}));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

describe('Sales', () => {
  it('SA membuat sales; kode ganda → 409; Admin Sales → 403', async () => {
    const sa = await as('SUPER_ADMIN');
    const res = await sa.post('/sales').send({ name: 'Rina Maharani', code: 'rna', email: 'rina@inilah.com' });
    expect(res.status).toBe(201);
    expect(res.body.code).toBe('RNA');
    expect((await sa.post('/sales').send({ name: 'Rina 2', code: 'RNA' })).status).toBe(409);
    expect((await sa.post('/sales').send({ name: 'X', code: 'kode-salah' })).status).toBe(400);
    expect((await (await as('ADMIN_SALES')).post('/sales').send({ name: 'Y', code: 'YYY' })).status).toBe(403);

    const list = await (await as('FINANCE')).get('/sales');
    expect(list.status).toBe(200);
    expect(list.body.data.find((s: { code: string }) => s.code === 'BMO')).toMatchObject({ name: 'Bimo', moCount: 0 });
  });
});

describe('Jenis benefit', () => {
  it('benefit baru mendapat kode otomatis & urutan terakhir', async () => {
    const sa = await as('SUPER_ADMIN');
    const res = await sa.post('/benefit-types').send({ name: 'YouTube Shorts' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: 'YOUTUBE_SHORTS', sortOrder: 8 });
    const list = await (await as('ADMIN_SALES')).get('/benefit-types');
    expect(list.body.data.at(-1).code).toBe('YOUTUBE_SHORTS');
    expect((await sa.post('/benefit-types').send({ name: 'YouTube Shorts' })).status).toBe(409);
  });
});

describe('Opsi formulir', () => {
  it('anak harus punya induk di grup yang sama', async () => {
    const sa = await as('SUPER_ADMIN');
    const ok = await sa.post('/form-options').send({ group: 'AD_LOCATION', label: 'Skin Ads', parentCode: 'SPOT_WEB' });
    expect(ok.status).toBe(201);
    expect(ok.body.code).toBe('SKIN_ADS');
    const bad = await sa.post('/form-options').send({ group: 'AD_TYPE', label: 'Anak Yatim', parentCode: 'SPOT_WEB' });
    expect(bad.status).toBe(400);
  });
});

describe('Penandatangan', () => {
  it('menjadikan penandatangan baru default melepas default lama', async () => {
    const sa = await as('SUPER_ADMIN');
    const res = await sa.post('/signatories').send({ name: 'Budi Santoso', title: 'Manager Sales', docRole: 'ACKNOWLEDGED_BY', isDefault: true });
    expect(res.status).toBe(201);
    const list = (await sa.get('/signatories')).body.data as { name: string; docRole: string; isDefault: boolean }[];
    const defaults = list.filter((s) => s.docRole === 'ACKNOWLEDGED_BY' && s.isDefault).map((s) => s.name);
    expect(defaults).toEqual(['Budi Santoso']);
  });

  it('upload TTD PNG sukses; non-PNG 400; stempel hanya untuk Disetujui oleh', async () => {
    const sa = await as('SUPER_ADMIN');
    const list = (await sa.get('/signatories')).body.data as { id: string; docRole: string }[];
    const ack = list.find((s) => s.docRole === 'ACKNOWLEDGED_BY')!;
    const approve = list.find((s) => s.docRole === 'APPROVED_BY')!;

    const up = await sa.post(`/signatories/${ack.id}/signature`).attach('file', PNG, 'ttd.png');
    expect(up.status).toBe(200);
    expect(up.body.url).toContain('https://signed.example/org/');

    expect((await sa.post(`/signatories/${ack.id}/signature`).attach('file', Buffer.from('%PDF-1.4'), 'x.png')).status).toBe(400);
    expect((await sa.post(`/signatories/${ack.id}/stamp`).attach('file', PNG, 's.png')).status).toBe(400);
    expect((await sa.post(`/signatories/${approve.id}/stamp`).attach('file', PNG, 's.png')).status).toBe(200);

    const after = (await sa.get('/signatories')).body.data.find((s: { id: string }) => s.id === approve.id);
    expect(after.stampUrl).toContain('stamp-');
    expect((await (await as('ADMIN_SALES')).post(`/signatories/${ack.id}/signature`).attach('file', PNG, 't.png')).status).toBe(403);
  });
});

describe('Pengaturan', () => {
  it('SA membaca & mengubah; Finance 403; validasi template', async () => {
    const sa = await as('SUPER_ADMIN');
    const cur = await sa.get('/settings');
    expect(cur.status).toBe(200);
    expect(cur.body).toMatchObject({ tax: { ppnRate: '12', dppNum: 11, dppDen: 12 }, nextSeq: { seq: 1 } });

    const body = { ...cur.body, company: { ...cur.body.company, bankName: 'Bank Mandiri (KCP Cipete)' } };
    delete body.nextSeq;
    const upd = await sa.patch('/settings').send(body);
    expect(upd.status).toBe(200);
    expect(upd.body.company.bankName).toBe('Bank Mandiri (KCP Cipete)');

    expect((await sa.patch('/settings').send({ ...body, numbering: { template: 'MO/{YEAR}' } })).status).toBe(400);
    expect((await (await as('FINANCE')).get('/settings')).status).toBe(403);
  });
});
