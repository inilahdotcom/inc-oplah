import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { as } from '../../test/helpers';

const valid = { companyName: 'PT Sinar Energi Terbarukan', picName: 'Andi Pratama', email: 'andi@sinarenergi.id', phone: '0812 8890 2231' };

describe('CRUD klien', () => {
  it('Admin Sales membuat, mencari, mengedit klien', async () => {
    const sales = await as('ADMIN_SALES');
    const created = await sales.post('/clients').send({ ...valid, nik: '3174000000001234', city: 'Jakarta Pusat' });
    expect(created.status).toBe(201);

    const found = await sales.get('/clients?q=sinar');
    expect(found.status).toBe(200);
    expect(found.body.data.map((c: { id: string }) => c.id)).toContain(created.body.id);
    expect(found.body.data[0]).toHaveProperty('moCount', 0);
    expect((await sales.get('/clients?q=andi')).body.total).toBeGreaterThanOrEqual(1); // cari PIC

    const edited = await sales.patch(`/clients/${created.body.id}`).send({ ...valid, city: 'Bandung' });
    expect(edited.status).toBe(200);
    expect(edited.body.city).toBe('Bandung');

    const detail = await sales.get(`/clients/${created.body.id}`);
    expect(detail.body).toMatchObject({ city: 'Bandung', mediaOrders: [] });
  });

  it('peringatan duplikat: "Bukit Asam" mirip klien seed PT Bukit Asam Tbk (PTBA)', async () => {
    const res = await (await as('ADMIN_SALES')).get('/clients/similar?name=bukit%20asam');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { companyName: string }) => c.companyName)).toContain('PT Bukit Asam Tbk (PTBA)');

    const none = await (await as('ADMIN_SALES')).get('/clients/similar?name=Universitas%20Cakrawala');
    expect(none.body.data).toEqual([]);
  });

  it('validasi: NIK bukan 16 digit & email salah → 400', async () => {
    const res = await (await as('ADMIN_SALES')).post('/clients').send({ ...valid, nik: '123', email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['email', 'nik']);
  });

  it('Finance hanya bisa melihat; NIK dimasking', async () => {
    const sales = await as('ADMIN_SALES');
    const { body } = await sales.post('/clients').send({ ...valid, companyName: 'CV Lestari Craft', nik: '3174000000005678' });

    const fin = await as('FINANCE');
    expect((await fin.post('/clients').send(valid)).status).toBe(403);
    expect((await fin.patch(`/clients/${body.id}`).send(valid)).status).toBe(403);
    expect((await fin.delete(`/clients/${body.id}`)).status).toBe(403);
    expect((await fin.get(`/clients/${body.id}`)).body.nik).toBe('************5678');
    expect((await sales.get(`/clients/${body.id}`)).body.nik).toBe('3174000000005678');
  });

  it('hapus = soft delete; klien hilang dari daftar & detail 404', async () => {
    const sales = await as('ADMIN_SALES');
    const { body } = await sales.post('/clients').send({ ...valid, companyName: 'PT Hapus Saya' });
    expect((await sales.delete(`/clients/${body.id}`)).status).toBe(204);
    expect((await sales.get('/clients?q=hapus saya')).body.total).toBe(0);
    expect((await sales.get(`/clients/${body.id}`)).status).toBe(404);
  });

  it('id tidak valid → 400, id tidak ada → 404, tanpa token → 401', async () => {
    const sales = await as('ADMIN_SALES');
    expect((await sales.get('/clients/bukan-uuid')).status).toBe(400);
    expect((await sales.get('/clients/00000000-0000-4000-8000-000000000999')).status).toBe(404);
    expect((await request(app).get('/api/v1/clients')).status).toBe(401);
  });
});
