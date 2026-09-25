import { z } from 'zod';
import { formOptionGroup, signatoryRole } from '../enums';
import { optionalText, requiredText } from './common';

// Kosong = dibuat otomatis dari nama/label.
const optionalCode = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{1,40}$/, 'Kode hanya huruf besar, angka, dan _')
    .optional(),
);

export const salesSchema = z.object({
  name: requiredText('Nama'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, 'Kode 2–6 huruf/angka, mis. BMO'),
  email: optionalText(200).refine((v) => v === null || z.string().email().safeParse(v).success, 'Format email tidak valid'),
  title: requiredText('Jabatan', 100).default('Sales'),
  isActive: z.boolean().default(true),
});

export const signatorySchema = z.object({
  name: requiredText('Nama'),
  title: requiredText('Jabatan', 100),
  docRole: z.enum(signatoryRole),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const benefitTypeSchema = z.object({
  name: requiredText('Nama jenis benefit', 100),
  code: optionalCode,
  pdfLabel: optionalText(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const formOptionSchema = z.object({
  group: z.enum(formOptionGroup),
  code: optionalCode,
  label: requiredText('Label', 100),
  parentCode: optionalText(40),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.object({
  company: z.object({
    name: requiredText('Nama perusahaan'),
    address: requiredText('Alamat', 500),
    bankName: requiredText('Nama bank', 100),
    bankAccountNo: requiredText('No. rekening', 50),
    bankAccountName: requiredText('Atas nama', 200),
  }),
  tax: z.object({
    ppnRate: z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?$/, 'Tarif PPN berupa angka, mis. 12'),
    dppNum: z.coerce.number().int().min(1),
    dppDen: z.coerce.number().int().min(1),
  }),
  numbering: z.object({
    template: z
      .string()
      .trim()
      .min(1, 'Template wajib diisi')
      .refine((t) => t.includes('{SEQ'), 'Template wajib memuat {SEQ}'),
  }),
  termsTemplates: z.array(z.object({ name: requiredText('Nama template', 100), body: requiredText('Isi template', 2000) })).max(20),
});
export type SettingsInput = z.input<typeof settingsSchema>;

/** "YouTube Shorts" → "YOUTUBE_SHORTS" */
export const toCode = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
