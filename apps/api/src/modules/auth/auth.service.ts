import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { AuthUser, LoginInput, Role } from '@inc/shared';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
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

/** Rotasi: token lama dicabut, token baru diterbitkan. Token yang sudah dicabut dipakai ulang → semua sesi user dicabut. */
export async function refresh(token: string | undefined, userAgent?: string) {
  const invalid = new AppError('INVALID_REFRESH_TOKEN', 'Sesi berakhir, silakan login ulang', 401);
  if (!token) throw invalid;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: withOrg } } });
  if (!row) throw invalid;
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw invalid;
  }
  if (row.expiresAt < new Date() || !row.user.isActive || row.user.deletedAt) throw invalid;

  // updateMany + filter revokedAt agar dua refresh bersamaan tidak sama-sama lolos.
  const { count } = await prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count === 0) throw invalid;
  return issueTokens(row.user, userAgent);
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function me(userId: string, orgId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: orgId, ...activeUser }, include: withOrg });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sesi berakhir, silakan login ulang', 401);
  return toAuthUser(user);
}
