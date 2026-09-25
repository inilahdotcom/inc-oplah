import { z } from 'zod';

const optional = z.string().trim().optional().transform((v) => v || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  APP_TIMEZONE: z.string().default('Asia/Jakarta'),
  // DigitalOcean Spaces (S3). Opsional: tanpa ini fitur upload membalas 503.
  S3_ENDPOINT: optional,
  S3_REGION: optional,
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
});

// Gagal jalan saat startup bila konfigurasi tidak valid (ARCHITECTURE §7).
export const env = schema.parse(process.env);
