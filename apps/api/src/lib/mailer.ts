import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

/** Kirim email teks biasa. Tanpa SMTP_URL email tidak dikirim; di luar produksi isinya ditulis ke log. */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) {
    // Isi email bisa berisi link reset, jadi tidak boleh masuk log produksi.
    return logger.warn({ to, subject, ...(env.NODE_ENV !== 'production' && { body: text }) }, 'SMTP_URL kosong, email tidak dikirim');
  }
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
}
