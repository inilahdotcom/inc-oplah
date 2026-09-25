import type { Request } from 'express';
import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import type { createUserSchema, updateUserSchema } from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { currentUser } from '../../middleware/authenticate';

const BCRYPT_COST = 12;

// passwordHash tidak pernah keluar dari API maupun masuk audit log.
const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  salesId: true,
  lastLoginAt: true,
  sales: { select: { name: true, code: true } },
} satisfies Prisma.UserSelect;

export function list(req: Request) {
  return prisma.user.findMany({ where: { organizationId: currentUser(req).orgId, deletedAt: null }, select: publicFields, orderBy: { name: 'asc' } });
}

async function assertSales(tx: Prisma.TransactionClient, orgId: string, salesId: string | null | undefined) {
  if (salesId && !(await tx.sales.findFirst({ where: { id: salesId, organizationId: orgId } }))) {
    throw new AppError('VALIDATION_ERROR', 'Sales tidak ditemukan', 400, [{ field: 'salesId', message: 'Tidak valid' }]);
  }
}

export function create(req: Request, { password, ...data }: z.output<typeof createUserSchema>) {
  const orgId = currentUser(req).orgId;
  return prisma.$transaction(async (tx) => {
    await assertSales(tx, orgId, data.salesId);
    const user = await tx.user.create({
      data: { ...data, organizationId: orgId, passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
      select: publicFields,
    });
    await writeAudit(tx, req, { entity: 'user', entityId: user.id, action: 'CREATE', after: user });
    return user;
  });
}

export function update(req: Request, id: string, { password, ...data }: z.output<typeof updateUserSchema>) {
  const me = currentUser(req);
  if (id === me.sub && (data.isActive === false || (data.role && data.role !== me.role))) {
    throw new AppError('SELF_LOCKOUT', 'Anda tidak bisa menonaktifkan atau mengubah role akun sendiri', 409);
  }
  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findFirst({ where: { id, organizationId: me.orgId, deletedAt: null }, select: publicFields });
    if (!before) throw new AppError('NOT_FOUND', 'Pengguna tidak ditemukan', 404);
    await assertSales(tx, me.orgId, data.salesId);
    const user = await tx.user.update({
      where: { id },
      data: { ...data, ...(password && { passwordHash: await bcrypt.hash(password, BCRYPT_COST) }) },
      select: publicFields,
    });
    // FR-AUTH-03: nonaktif atau ganti password → semua sesi dicabut.
    if (data.isActive === false || password) {
      await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await writeAudit(tx, req, { entity: 'user', entityId: id, action: 'UPDATE', before, after: { ...user, passwordChanged: !!password } });
    return user;
  });
}
