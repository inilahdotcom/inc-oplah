import { beforeAll, describe, expect, it, vi } from 'vitest';
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

const urls = (n: number, tag = Math.random().toString(36).slice(2, 8)) => Array.from({ length: n }, (_, i) => `https://www.inilah.com/rilis/${tag}-${i + 1}`);
const pub = (benefitId: string, url: string, extra: Record<string, unknown> = {}) => ({ moBenefitId: benefitId, publishedDate: '2026-07-01', url, ...extra });

describe('Realisasi publikasi', () => {
  it('AC M4: 12 URL pada MO contoh → 100%, COMPLETED, READY_TO_BILL, Finance dapat notifikasi', async () => {
    const s = await as('ADMIN_SALES');
    const fin = await as('FINANCE');
    const unreadBefore = (await fin.get('/notifications')).body.unread;

    const mo = await submittedMo(sample);
    const benefitId = mo.benefitProgress[0].id;
    const res = await s.post(`/media-orders/${mo.id}/publications/bulk`).send({ moBenefitId: benefitId, publishedDate: '2026-07-01', urls: urls(12) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 12, rejected: [], becameReady: true });

    const after = (await s.get(`/media-orders/${mo.id}`)).body;
    expect(after).toMatchObject({ status: 'COMPLETED', billingStatus: 'READY_TO_BILL', fulfillmentPct: '100' });
    expect(after.benefitProgress[0]).toMatchObject({ targetQty: 12, realizedQty: 12, bonusQty: 0 });

    const notif = (await fin.get('/notifications')).body;
    expect(notif.unread).toBe(unreadBefore + 1);
    expect(notif.data[0]).toMatchObject({ type: 'MO_READY_TO_BILL', payload: { moId: mo.id, moNumber: mo.moNumber } });
    expect((await fin.post('/notifications/read-all')).status).toBe(204);
    expect((await fin.get('/notifications')).body.unread).toBe(0);
  });

  it('kuota, bonus, URL ganda, di luar periode, hapus → status kembali', async () => {
    const s = await as('ADMIN_SALES');
    const mo = await submittedMo({ ...sample, benefits: [{ ...(sample.benefits as object[])[0], targetQty: 2 }] });
    const b = mo.benefitProgress[0].id;
    const [u1, u2, u3] = urls(3);

    const first = await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, u1, { title: 'Rilis 1', publishedDate: '2028-01-01' })); // di luar periode: tetap diterima
    expect(first.status).toBe(201);
    expect((await s.get(`/media-orders/${mo.id}`)).body.status).toBe('ACTIVE');

    const dup = await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, `${u1.replace('www.', 'WWW.')}/?utm_source=wa`));
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_URL');

    expect((await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, u2))).body.becameReady).toBe(true);
    const over = await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, u3));
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('QUOTA_EXCEEDED');
    const bonus = await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, u3, { isBonus: true }));
    expect(bonus.status).toBe(201);

    let detail = (await s.get(`/media-orders/${mo.id}`)).body;
    expect(detail).toMatchObject({ status: 'COMPLETED', billingStatus: 'READY_TO_BILL', fulfillmentPct: '100' });
    expect(detail.benefitProgress[0]).toMatchObject({ realizedQty: 2, bonusQty: 1 });

    expect((await s.delete(`/publications/${first.body.publication.id}`)).status).toBe(200);
    detail = (await s.get(`/media-orders/${mo.id}`)).body;
    expect(detail).toMatchObject({ status: 'ACTIVE', billingStatus: 'NOT_READY', fulfillmentPct: '50' });

    const list = (await (await as('FINANCE')).get(`/media-orders/${mo.id}/publications`)).body.data;
    expect(list.map((p: { url: string }) => p.url).sort()).toEqual([u2, u3].sort());
  });

  it('bulk menolak per URL; edit tetap cek kuota; RBAC & status', async () => {
    const s = await as('ADMIN_SALES');
    const mo = await submittedMo({ ...sample, benefits: [{ ...(sample.benefits as object[])[0], targetQty: 2 }] });
    const b = mo.benefitProgress[0].id;
    const [u1, u2, u3] = urls(3);
    const res = await s.post(`/media-orders/${mo.id}/publications/bulk`).send({ moBenefitId: b, publishedDate: '2026-07-01', urls: [u1, 'bukan-url', `${u1}/`, u2, u3] });
    expect(res.body.created).toBe(2);
    expect(res.body.rejected.map((r: { url: string }) => r.url)).toEqual(['bukan-url', `${u1}/`, u3]);

    const bonus = (await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, `${u3}-bonus`, { isBonus: true }))).body.publication;
    expect((await s.patch(`/publications/${bonus.id}`).send(pub(b, bonus.url, { isBonus: false }))).status).toBe(409);
    expect((await s.patch(`/publications/${bonus.id}`).send(pub(b, bonus.url, { isBonus: true, title: 'Judul baru' }))).body.publication.title).toBe('Judul baru');

    expect((await (await as('FINANCE')).post(`/media-orders/${mo.id}/publications`).send(pub(b, `${u3}-fin`))).status).toBe(403);
    const draft = (await s.post('/media-orders').send(sample)).body;
    expect((await s.post(`/media-orders/${draft.id}/publications`).send(pub(draft.benefitProgress[0].id, `${u3}-draft`))).status).toBe(409);
    expect((await s.post(`/media-orders/${mo.id}/publications`).send(pub(b, 'ftp://x.y'))).status).toBe(400);
  });

  it('revisi memindahkan realisasi; submit revisi langsung dihitung ulang', async () => {
    const s = await as('ADMIN_SALES');
    const mo = await submittedMo(sample);
    await s.post(`/media-orders/${mo.id}/publications/bulk`).send({ moBenefitId: mo.benefitProgress[0].id, publishedDate: '2026-07-01', urls: urls(3) });
    const rev = (await s.post(`/media-orders/${mo.id}/revise`)).body;
    expect(rev.benefitProgress[0]).toMatchObject({ realizedQty: 3 });
    const submitted = (await s.post(`/media-orders/${rev.id}/submit`)).body;
    expect(submitted).toMatchObject({ status: 'ACTIVE', fulfillmentPct: '25' });
    expect((await s.get(`/media-orders/${rev.id}/publications`)).body.data).toHaveLength(3);
  });
});
