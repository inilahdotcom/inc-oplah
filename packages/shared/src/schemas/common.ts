import { z } from 'zod';

/** Teks opsional: string kosong/spasi → null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const requiredText = (label: string, max = 200) => z.string().trim().min(1, `${label} wajib diisi`).max(max);

export const idParam = z.object({ id: z.string().uuid('ID tidak valid') });

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
