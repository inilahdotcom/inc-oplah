import { z } from 'zod';
import { optionalText, pageQuery, requiredText } from './common';

const pattern = (re: RegExp, message: string) => optionalText(50).refine((v) => v === null || re.test(v), message);

// Field wajib mengikuti modal klien di desain (Perusahaan, PIC, Email, Telp).
export const clientSchema = z.object({
  companyName: requiredText('Perusahaan / Biro Iklan'),
  picName: requiredText('Nama PIC'),
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  phone: requiredText('No. Telp', 30),
  nik: pattern(/^\d{16}$/, 'NIK harus 16 digit angka'),
  postalCode: pattern(/^\d{5}$/, 'Kode pos harus 5 digit angka'),
  address: optionalText(),
  city: optionalText(100),
  npwp: optionalText(30),
  notes: optionalText(1000),
});
export type ClientInput = z.input<typeof clientSchema>;

export const clientListQuery = pageQuery.extend({ q: z.string().trim().max(100).optional() });

export const similarClientQuery = z.object({
  name: z.string().trim().max(200).default(''),
  excludeId: z.string().uuid().optional(),
});

/** Normalisasi nama perusahaan untuk deteksi duplikat (port `norm()` prototipe desain). */
export const normalizeCompanyName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\b(pt|cv|tbk|persero)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Mirip bila hasil normalisasi sama atau saling mengandung (minimal 3 karakter). */
export const isSimilarCompany = (a: string, b: string) => {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (na.length < 3 || nb.length < 3) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};
