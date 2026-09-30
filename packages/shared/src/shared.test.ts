import { describe, expect, it } from 'vitest';
import {
  can,
  clientSchema,
  formatMoNumber,
  formatPeriode,
  formatRupiah,
  formatTanggal,
  isSimilarCompany,
  monthRange,
  moPdfFileName,
  moSubmitSchema,
  normalizeUrl,
  isHttpUrl,
  normalizeCompanyName,
  toCode,
} from './index';

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

describe('MO', () => {
  it('nomor MO dari template (PRD §5.5)', () => {
    const v = { seq: 7, salesCode: 'BMO', moDate: '2026-05-22' };
    expect(formatMoNumber('{SEQ}/MO-{SALES_CODE}/INC/{MONTH_ROMAN}/{YEAR}', v)).toBe('007/MO-BMO/INC/V/2026');
    expect(formatMoNumber('{SEQ:4}-{MONTH_ROMAN}', { ...v, moDate: '2026-12-01' })).toBe('0007-XII');
    expect(formatMoNumber('{SEQ}', { ...v, seq: 1234 })).toBe('1234');
  });

  it('periode & nama file PDF (PRD §8)', () => {
    expect(monthRange('2027-02')).toEqual(['2027-02-01', '2027-02-28']);
    expect(formatPeriode('2026-06-01', '2027-05-31')).toBe('Juni 2026 - Mei 2027');
    expect(formatPeriode('2026-06-01', null)).toBe('Juni 2026');
    const mo = { moNumber: '007/MO-BMO/INC/V/2026', companyName: 'PT Bukit Asam', periodStart: '2026-06-01', periodEnd: '2027-05-31' };
    expect(moPdfFileName(mo)).toBe('MO_007-MO-BMO-INC-V-2026_PT_BUKIT_ASAM_Juni_2026-Mei_2027.pdf');
  });

  it('submit menolak draft yang belum lengkap', () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    const draft = {
      moDate: '2026-05-22',
      clientId: uuid,
      salesId: uuid,
      clientSnapshot: { companyName: 'PT A', picName: 'Budi', email: 'a@b.co', phone: '0812' },
      periodStart: '2026-06-01',
      periodEnd: '2027-05-31',
      description: 'Publikasi',
      selectedOptions: {},
      benefits: [{ benefitTypeId: uuid, targetQty: 12 }],
      cooperationDetail: 'Artikel 12x',
      subtotal: '20000000',
    };
    expect(moSubmitSchema.safeParse(draft).success).toBe(true);
    expect(moSubmitSchema.safeParse({ ...draft, periodEnd: null, subtotal: '0' }).success).toBe(true);
    const bad = moSubmitSchema.safeParse({ ...draft, benefits: [], paymentMethod: 'CHEQUE_BG', subtotal: '0', periodEnd: '2026-01-31' });
    expect(bad.error?.issues.map((i) => i.path.join('.')).sort()).toEqual(['benefits', 'chequeNo', 'periodEnd']);
  });
});

it('normalizeUrl: host kecil, tanpa www/utm/hash/slash akhir', () => {
  expect(normalizeUrl('https://WWW.Inilah.com/berita/abc/?utm_source=x&id=2#top')).toBe('https://inilah.com/berita/abc?id=2');
  expect(normalizeUrl('https://inilah.com/berita/abc')).toBe(normalizeUrl('https://www.inilah.com/berita/abc/'));
  expect(isHttpUrl('ftp://a.b')).toBe(false);
  expect(isHttpUrl('bukan url')).toBe(false);
});
