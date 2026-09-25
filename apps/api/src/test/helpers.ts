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
