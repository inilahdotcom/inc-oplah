import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { AuthUser, LoginInput, ResetPasswordInput, Role } from '@inc/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { logger } from '../../lib/logger';
import { sendMail } from '../../lib/mailer';
import { signAccessToken } from '../../middleware/authenticate';

export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Hash dummy agar waktu respons sama saat email tidak terdaftar.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 12);

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

type UserRow = { id: string; organizationId: string; name: string; email: string; role: Role; salesId: string | null; organization: { name: string } };

const toAuthUser = (u: UserRow): AuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  salesId: u.salesId,
  organizationName: u.organization.name,
});

async function issueTokens(u: UserRow, userAgent?: string) {
  const refreshToken = randomBytes(32).toString('base64url');
  await prisma.refreshToken.create({
    data: { userId: u.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS), userAgent },
  });
  const accessToken = signAccessToken({ sub: u.id, orgId: u.organizationId, role: u.role, salesId: u.salesId });
  return { accessToken, refreshToken, user: toAuthUser(u) };
}

const activeUser = { isActive: true, deletedAt: null } as const;
const withOrg = { organization: { select: { name: true } } } as const;

export async function login({ email, password }: LoginInput, ip?: string, userAgent?: string) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), ...activeUser }, include: withOrg });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new AppError('INVALID_CREDENTIALS', 'Email atau password salah', 401);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    prisma.auditLog.create({
      data: { organizationId: user.organizationId, userId: user.id, entity: 'user', entityId: user.id, action: 'LOGIN', ip },
    }),
  ]);
  return issueTokens(user, userAgent);
}

/**
 * Token yang dirotasi masih diterima selama `ROTATION_GRACE_MS` (kolom `revokedAt` diisi waktu di masa depan).
 * Tanpa ini, respons refresh yang tidak sampai ke browser (reload/pindah halaman saat request berjalan, dua tab,
 * jaringan putus) membuat cookie lama terkirim ulang, terdeteksi sebagai pencurian, dan semua sesi user dicabut.
 */
const ROTATION_GRACE_MS = 30_000;
const live = () => ({ OR: [{ revokedAt: null }, { revokedAt: { gt: new Date() } }] });

/** Cabut semua sesi user sekarang juga (logout paksa, nonaktif, ganti password, token dicuri). */
export const revokeAllSessions = (db: Pick<typeof prisma, 'refreshToken'>, userId: string) =>
  db.refreshToken.updateMany({ where: { userId, ...live() }, data: { revokedAt: new Date() } });

/** Rotasi: token lama dicabut (setelah masa tenggang), token baru diterbitkan. Token yang sudah dicabut dipakai ulang → semua sesi user dicabut. */
export async function refresh(token: string | undefined, userAgent?: string) {
  const invalid = new AppError('INVALID_REFRESH_TOKEN', 'Sesi berakhir, silakan login ulang', 401);
  if (!token) throw invalid;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: withOrg } } });
  if (!row) throw invalid;
  if (row.revokedAt && row.revokedAt <= new Date()) {
    await revokeAllSessions(prisma, row.userId);
    throw invalid;
  }
  if (row.expiresAt < new Date() || !row.user.isActive || row.user.deletedAt) throw invalid;

  // Rotasi pertama memulai masa tenggang; refresh bersamaan dalam masa itu sama-sama mendapat token baru.
  await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date(Date.now() + ROTATION_GRACE_MS) } });
  return issueTokens(row.user, userAgent);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), ...live() }, data: { revokedAt: new Date() } });
}

export async function me(userId: string, orgId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: orgId, ...activeUser }, include: withOrg });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sesi berakhir, silakan login ulang', 401);
  return toAuthUser(user);
}

/**
 * Token reset stateless: JWT yang ditandatangani dengan secret + hash password user.
 * Setelah password diganti hash berubah, jadi token otomatis hangus (sekali pakai) tanpa tabel token.
 */
export const RESET_TTL = '30m';
export const resetSecret = (passwordHash: string) => env.JWT_ACCESS_SECRET + passwordHash;

/** Selalu selesai tanpa error agar tidak bisa dipakai menebak email yang terdaftar. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), ...activeUser } });
  if (!user) return;
  const token = jwt.sign({ sub: user.id, purpose: 'reset' }, resetSecret(user.passwordHash), { algorithm: 'HS256', expiresIn: RESET_TTL });
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  // Kegagalan SMTP hanya dicatat; respons tetap sama.
  await sendMail(
    user.email,
    'Reset password Oplah',
    `Halo ${user.name},\n\nBuka link berikut untuk mengatur ulang password Anda (berlaku 30 menit):\n${link}\n\nAbaikan email ini jika Anda tidak memintanya.`,
  ).catch((err) => logger.error({ err }, 'Gagal mengirim email reset password'));
}

export async function resetPassword({ token, password }: ResetPasswordInput, ip?: string) {
  const invalid = new AppError('INVALID_RESET_TOKEN', 'Link reset tidak valid atau kedaluwarsa', 400);
  const sub = (jwt.decode(token) as { sub?: unknown } | null)?.sub;
  if (typeof sub !== 'string') throw invalid;
  const user = await prisma.user.findFirst({ where: { id: sub, ...activeUser } });
  if (!user) throw invalid;
  try {
    const payload = jwt.verify(token, resetSecret(user.passwordHash), { algorithms: ['HS256'] }) as { purpose?: string };
    if (payload.purpose !== 'reset') throw invalid;
  } catch {
    throw invalid;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await revokeAllSessions(tx, user.id);
    await tx.auditLog.create({
      data: { organizationId: user.organizationId, userId: user.id, entity: 'user', entityId: user.id, action: 'UPDATE', after: { passwordReset: true }, ip },
    });
  });
}
