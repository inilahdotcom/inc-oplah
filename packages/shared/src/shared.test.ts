import { describe, expect, it } from 'vitest';
import { can, clientSchema, formatRupiah, formatTanggal, isSimilarCompany, normalizeCompanyName, toCode } from './index';

describe('permissions', () => {
  it('mengikuti matriks PRD §3', () => {
    expect(can('SUPER_ADMIN', 'manageUsers')).toBe(true);
    expect(can('ADMIN_SALES', 'manageUsers')).toBe(false);
    expect(can('FINANCE', 'manageBilling')).toBe(true);
    expect(can('ADMIN_SALES', 'manageBilling')).toBe(false);
    expect(can('VIEWER', 'export')).toBe(false);
    expect(can('FINANCE', 'manageClients')).toBe(false);
  });
});

describe('format', () => {
  it('formatRupiah', () => {
    expect(formatRupiah('22200000.00')).toBe('22.200.000');
    expect(formatRupiah(0)).toBe('0');
    expect(formatRupiah('999999999')).toBe('999.999.999');
  });
  it('formatTanggal', () => {
    expect(formatTanggal('2026-05-22')).toBe('22 Mei 2026');
  });
});

describe('deteksi duplikat klien', () => {
  it('normalisasi membuang PT/Tbk/isi kurung/tanda baca', () => {
    expect(normalizeCompanyName('PT Bukit Asam Tbk (PTBA)')).toBe('bukitasam');
    expect(normalizeCompanyName('CV. Lestari-Craft')).toBe('lestaricraft');
  });
  it('mirip bila sama atau saling mengandung', () => {
    expect(isSimilarCompany('bukit asam', 'PT Bukit Asam Tbk (PTBA)')).toBe(true);
    expect(isSimilarCompany('PT Bukit Asam Persero', 'Bukit Asam')).toBe(true);
    expect(isSimilarCompany('Bank Nusantara', 'PT Bukit Asam')).toBe(false);
    expect(isSimilarCompany('PT', 'PT Bukit Asam')).toBe(false);
  });
});

describe('clientSchema', () => {
  const base = { companyName: 'PT A', picName: 'Budi', email: 'a@b.co', phone: '0812' };
  it('string kosong → null, NIK/kode pos divalidasi', () => {
    expect(clientSchema.parse({ ...base, nik: '', city: ' ' })).toMatchObject({ nik: null, city: null });
    expect(clientSchema.safeParse({ ...base, nik: '123' }).success).toBe(false);
    expect(clientSchema.safeParse({ ...base, postalCode: '1234' }).success).toBe(false);
  });
});

it('toCode', () => {
  expect(toCode('YouTube Shorts')).toBe('YOUTUBE_SHORTS');
});
