import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

const PASSWORD = process.env.SEED_PASSWORD || 'password123';
const accounts = {
  SUPER_ADMIN: 'superadmin@inilah.local',
  ADMIN_SALES: 'sales@inilah.local',
  FINANCE: 'finance@inilah.local',
  VIEWER: 'viewer@inilah.local',
} as const;

const login = (email: string, password = PASSWORD) => request(app).post('/api/v1/auth/login').send({ email, password });
const refreshCookie = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='))!;

describe('POST /auth/login', () => {
  it.each(Object.entries(accounts))('%s dapat login', async (role, email) => {
    const res = await login(email);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(role);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(refreshCookie(res)).toMatch(/HttpOnly/i);
  });

  it('password salah → 401', async () => {
    const res = await login(accounts.FINANCE, 'salah-password');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('body tidak valid → 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'bukan-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('RBAC GET /users (SUPER_ADMIN saja)', () => {
  it('tanpa token → 401', async () => {
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
  });

  it('SUPER_ADMIN → 200', async () => {
    const { body } = await login(accounts.SUPER_ADMIN);
    const res = await request(app).get('/api/v1/users').auth(body.accessToken, { type: 'bearer' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
  });

  it.each(['ADMIN_SALES', 'FINANCE', 'VIEWER'] as const)('%s → 403', async (role) => {
    const { body } = await login(accounts[role]);
    const res = await request(app).get('/api/v1/users').auth(body.accessToken, { type: 'bearer' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('refresh & logout', () => {
  it('refresh merotasi token; token lama ditolak', async () => {
    const first = refreshCookie(await login(accounts.ADMIN_SALES));
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(r1.body.user.email).toBe(accounts.ADMIN_SALES);

    const reused = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(reused.status).toBe(401);
    // pemakaian ulang mencabut semua sesi, termasuk token hasil rotasi
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', refreshCookie(r1))).status).toBe(401);
  });

  it('setelah logout, refresh → 401', async () => {
    const cookie = refreshCookie(await login(accounts.FINANCE));
    expect((await request(app).post('/api/v1/auth/logout').set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('GET /auth/me mengembalikan profil', async () => {
    const { body } = await login(accounts.VIEWER);
    const res = await request(app).get('/api/v1/auth/me').auth(body.accessToken, { type: 'bearer' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'VIEWER', organizationName: 'PT. Indonesia News Center' });
  });
});
