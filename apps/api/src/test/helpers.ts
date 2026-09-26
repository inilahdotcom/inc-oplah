import request from 'supertest';
import { app } from '../app';

export const PASSWORD = process.env.SEED_PASSWORD || 'password123';
export const accounts = {
  SUPER_ADMIN: 'superadmin@inilah.local',
  ADMIN_SALES: 'sales@inilah.local',
  FINANCE: 'finance@inilah.local',
  VIEWER: 'viewer@inilah.local',
} as const;

const tokens = new Map<string, string>();

/** Access token akun seed (di-cache per file test). */
export async function tokenFor(role: keyof typeof accounts) {
  if (!tokens.has(role)) {
    const res = await request(app).post('/api/v1/auth/login').send({ email: accounts[role], password: PASSWORD });
    tokens.set(role, res.body.accessToken);
  }
  return tokens.get(role)!;
}

/** Supertest dengan Bearer token role tertentu: `(await as('FINANCE')).get('/clients')`. */
export async function as(role: keyof typeof accounts) {
  const token = await tokenFor(role);
  const wrap = (method: 'get' | 'post' | 'patch' | 'delete') => (path: string) => request(app)[method](`/api/v1${path}`).auth(token, { type: 'bearer' });
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), delete: wrap('delete') };
}

/** Body draft MO data contoh PRD §14 (PT Bukit Asam, Artikel Rilis 12x, subtotal 20 juta) dari data seed. */
export async function sampleMo() {
  const sa = await as('SUPER_ADMIN');
  const client = (await sa.get('/clients?q=Bukit')).body.data[0];
  const sales = (await sa.get('/sales')).body.data.find((s: { code: string }) => s.code === 'BMO');
  const artikel = (await sa.get('/benefit-types')).body.data.find((b: { code: string }) => b.code === 'ARTIKEL_RILIS');
  const sigs = (await sa.get('/signatories')).body.data as { id: string; name: string; docRole: string; isDefault: boolean }[];
  const ack = sigs.find((s) => s.docRole === 'ACKNOWLEDGED_BY' && s.isDefault)!;
  const sample: Record<string, unknown> = {
    moDate: '2026-05-22',
    clientId: client.id,
    salesId: sales.id,
    clientSnapshot: { picName: client.picName, companyName: client.companyName, email: client.email, phone: client.phone },
    periodStart: '2026-06-01',
    periodEnd: '2027-05-31',
    description: 'Publikasi Rilis Artikel',
    selectedOptions: { AD_TYPE: ['ARTIKEL'] },
    benefits: [{ benefitTypeId: artikel.id, targetQty: 12, notes: 'Materi Ready To Post' }],
    cooperationDetail: 'Artikel Release (Materi Ready To Post) 12x',
    termsConditions: 'Pembayaran pada bulan September 2026.',
    paymentMethod: 'TRANSFER',
    isTaxable: true,
    subtotal: '20000000',
    acknowledgedById: ack.id,
    approvedById: sigs.find((s) => s.docRole === 'APPROVED_BY' && s.isDefault)!.id,
  };
  return { sample, ackName: ack.name };
}

/** MO contoh yang sudah disubmit oleh Admin Sales. */
export async function submittedMo(body?: Record<string, unknown>) {
  const s = await as('ADMIN_SALES');
  const draft = await s.post('/media-orders').send(body ?? (await sampleMo()).sample);
  return (await s.post(`/media-orders/${draft.body.id}/submit`)).body;
}
