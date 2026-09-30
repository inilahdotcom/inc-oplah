import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { prisma } from '../../lib/prisma';
import { resetSecret } from './auth.service';

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
  it('refresh merotasi token; token lama masih diterima selama masa tenggang', async () => {
    const first = refreshCookie(await login(accounts.ADMIN_SALES));
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    expect(r1.body.user.email).toBe(accounts.ADMIN_SALES);
    expect(refreshCookie(r1)).not.toBe(first);
    // respons r1 "tidak sampai" (reload/dua tab): cookie lama dikirim lagi → tetap dapat sesi
    const retry = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(retry.status).toBe(200);
  });

  it('token lama dipakai ulang setelah masa tenggang → semua sesi dicabut', async () => {
    const first = refreshCookie(await login(accounts.ADMIN_SALES));
    const r1 = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    const hash = createHash('sha256').update(first.split(';')[0].split('=')[1]).digest('hex');
    await prisma.refreshToken.update({ where: { tokenHash: hash }, data: { revokedAt: new Date(Date.now() - 1000) } });

    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', first)).status).toBe(401);
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

describe('reset password (FR-AUTH-02)', () => {
  const forgot = (email: string) => request(app).post('/api/v1/auth/forgot-password').send({ email });
  const reset = (token: string, password: string) => request(app).post('/api/v1/auth/reset-password').send({ token, password });

  it('email tidak terdaftar tetap 204 (tidak bocor)', async () => {
    expect((await forgot('tidak-ada@inilah.local')).status).toBe(204);
    expect((await forgot(accounts.VIEWER)).status).toBe(204);
  });

  it('token valid mengganti password, mencabut sesi, dan hanya sekali pakai', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: accounts.VIEWER } });
    const token = jwt.sign({ sub: user.id, purpose: 'reset' }, resetSecret(user.passwordHash), { expiresIn: '30m' });
    const oldCookie = refreshCookie(await login(accounts.VIEWER));
    try {
      expect((await reset(token, 'password-baru-123')).status).toBe(204);
      expect((await login(accounts.VIEWER, 'password-baru-123')).status).toBe(200);
      expect((await login(accounts.VIEWER)).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie)).status).toBe(401);

      const again = await reset(token, 'password-lain-123');
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe('INVALID_RESET_TOKEN');
    } finally {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(PASSWORD, 12) } });
    }
  });

  it('token palsu / kedaluwarsa → 400', async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: accounts.VIEWER } });
    const expired = jwt.sign({ sub: user.id, purpose: 'reset', exp: Math.floor(Date.now() / 1000) - 10 }, resetSecret(user.passwordHash));
    const forged = jwt.sign({ sub: user.id, purpose: 'reset' }, 'secret-lain');
    for (const t of [expired, forged, 'bukan-jwt']) expect((await reset(t, 'password-baru-123')).status).toBe(400);
  });
});
