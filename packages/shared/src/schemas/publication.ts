import { z } from 'zod';
import { optionalText } from './common';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');
const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:$/.test(safeUrl(v)?.protocol ?? ''), 'URL tidak valid (harus diawali http:// atau https://)');

function safeUrl(v: string) {
  try {
    return new URL(v);
  } catch {
    return null;
  }
}

/** Kunci anti-duplikat (DATABASE.md): host huruf kecil, tanpa `www.`, tanpa query `utm_*`, tanpa hash & garis miring akhir. */
export const normalizeUrl = (raw: string) => {
  const u = new URL(raw.trim());
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';
  [...u.searchParams.keys()].filter((k) => k.toLowerCase().startsWith('utm_')).forEach((k) => u.searchParams.delete(k));
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
};

/** FR-PUB-01: satu realisasi. */
export const publicationSchema = z.object({
  moBenefitId: z.string({ required_error: 'Pilih jenis benefit' }).uuid('Pilih jenis benefit'),
  publishedDate: date,
  title: optionalText(300),
  url: httpUrl,
  notes: optionalText(500),
  isBonus: z.boolean().default(false),
});
export type PublicationInput = z.input<typeof publicationSchema>;

/** FR-PUB-02: beberapa URL (satu per baris) untuk satu jenis benefit & tanggal. Validasi per URL di server. */
export const publicationBulkSchema = z.object({
  moBenefitId: z.string().uuid('Pilih jenis benefit'),
  publishedDate: date,
  urls: z.array(z.string().trim().max(2000)).min(1, 'Isi minimal 1 URL').max(200),
  isBonus: z.boolean().default(false),
});

export const isHttpUrl = (v: string) => httpUrl.safeParse(v).success;
