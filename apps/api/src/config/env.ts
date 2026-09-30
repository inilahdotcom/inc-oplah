import { z } from 'zod';

const optional = z.string().trim().optional().transform((v) => v || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // DigitalOcean Spaces (S3). Opsional: tanpa ini fitur upload membalas 503.
  // Host tanpa skema (mis. `sgp1.digitaloceanspaces.com`) dianggap https.
  S3_ENDPOINT: optional.transform((v) => (v && !/^https?:\/\//.test(v) ? `https://${v}` : v)),
  S3_REGION: optional,
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,
  // Reset password (FR-AUTH-02). Tanpa SMTP_URL email hanya ditulis ke log (development).
  SMTP_URL: optional,
  MAIL_FROM: optional.transform((v) => v ?? 'Oplah <no-reply@inilah.com>'),
  APP_URL: z.string().url().default('http://localhost:5173'),
});

// Gagal jalan saat startup bila konfigurasi tidak valid (ARCHITECTURE §7).
export const env = schema.parse(process.env);
