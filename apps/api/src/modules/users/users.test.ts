import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { as } from '../../test/helpers';

const login = (email: string, password: string) => request(app).post('/api/v1/auth/login').send({ email, password });

describe('Kelola pengguna', () => {
  it('SA menambah user → user bisa login; nonaktif → login & refresh ditolak', async () => {
    const sa = await as('SUPER_ADMIN');
    const res = await sa.post('/users').send({ name: 'Dewi Finance', email: 'Dewi@Inilah.local', role: 'FINANCE', password: 'rahasia123' });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('passwordHash');

    const first = await login('dewi@inilah.local', 'rahasia123');
    expect(first.status).toBe(200);
    const cookie = ([] as string[]).concat(first.headers['set-cookie']).find((c) => c.startsWith('refresh_token='))!;

    expect((await sa.patch(`/users/${res.body.id}`).send({ isActive: false })).status).toBe(200);
    expect((await login('dewi@inilah.local', 'rahasia123')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
  });

  it('email ganda → 409; password pendek → 400; non-SA → 403', async () => {
    const sa = await as('SUPER_ADMIN');
    expect((await sa.post('/users').send({ name: 'X', email: 'sales@inilah.local', role: 'VIEWER', password: 'rahasia123' })).status).toBe(409);
    expect((await sa.post('/users').send({ name: 'X', email: 'x@inilah.local', role: 'VIEWER', password: '123' })).status).toBe(400);
    expect((await (await as('FINANCE')).post('/users').send({ name: 'X', email: 'y@inilah.local', role: 'VIEWER', password: 'rahasia123' })).status).toBe(403);
  });

  it('SA tidak bisa menonaktifkan/menurunkan role dirinya sendiri', async () => {
    const sa = await as('SUPER_ADMIN');
    const me = (await sa.get('/users')).body.data.find((u: { email: string }) => u.email === 'superadmin@inilah.local');
    expect((await sa.patch(`/users/${me.id}`).send({ isActive: false })).status).toBe(409);
    expect((await sa.patch(`/users/${me.id}`).send({ role: 'VIEWER' })).status).toBe(409);
    expect((await sa.patch(`/users/${me.id}`).send({ name: 'Super Admin Utama' })).status).toBe(200);
  });
});
