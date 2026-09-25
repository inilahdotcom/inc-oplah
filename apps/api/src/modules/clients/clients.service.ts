import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { can, isSimilarCompany, maskNik as mask, type clientListQuery, type clientSchema, type similarClientQuery } from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { currentUser } from '../../middleware/authenticate';

type ClientData = z.output<typeof clientSchema>;

const notFound = () => new AppError('NOT_FOUND', 'Klien tidak ditemukan', 404);

// NIK hanya utuh untuk role yang boleh mengelola klien; selain itu dimasking kecuali 4 digit terakhir.
const maskNikFor = <T extends { nik: string | null }>(req: Request, c: T): T =>
  c.nik && !can(currentUser(req).role, 'manageClients') ? { ...c, nik: mask(c.nik) } : c;

const scope = (req: Request) => ({ organizationId: currentUser(req).orgId, deletedAt: null });

export async function list(req: Request, { q, page, limit }: z.output<typeof clientListQuery>) {
  const where: Prisma.ClientWhereInput = {
    ...scope(req),
    ...(q && {
      OR: [{ companyName: { contains: q, mode: 'insensitive' } }, { picName: { contains: q, mode: 'insensitive' } }],
    }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.client.findMany({
      where,
      include: { _count: { select: { mediaOrders: true } } },
      orderBy: { companyName: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);
  return {
    data: rows.map(({ _count, ...c }) => ({ ...maskNikFor(req, c), moCount: _count.mediaOrders })),
    total,
    page,
    limit,
  };
}

// ponytail: scan semua nama klien org di memori; ganti ke pg_trgm similarity() bila klien > ~50rb.
export async function similar(req: Request, { name, excludeId }: z.output<typeof similarClientQuery>) {
  const clients = await prisma.client.findMany({ where: scope(req), select: { id: true, companyName: true } });
  return clients.filter((c) => c.id !== excludeId && isSimilarCompany(name, c.companyName)).slice(0, 5);
}

export async function get(req: Request, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, ...scope(req) },
    include: {
      mediaOrders: {
        select: { id: true, moNumber: true, moDate: true, periodStart: true, periodEnd: true, totalAmount: true, status: true, billingStatus: true },
        orderBy: { moDate: 'desc' },
      },
    },
  });
  if (!client) throw notFound();
  return maskNikFor(req, client);
}

export async function create(req: Request, data: ClientData) {
  const user = currentUser(req);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { ...data, organizationId: user.orgId, createdBy: user.sub } });
    await writeAudit(tx, req, { entity: 'client', entityId: client.id, action: 'CREATE', after: client });
    return client;
  });
}

export async function update(req: Request, id: string, data: ClientData) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.client.findFirst({ where: { id, ...scope(req) } });
    if (!before) throw notFound();
    const client = await tx.client.update({ where: { id }, data });
    await writeAudit(tx, req, { entity: 'client', entityId: id, action: 'UPDATE', before, after: client });
    return client;
  });
}

export async function remove(req: Request, id: string) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.client.findFirst({ where: { id, ...scope(req) } });
    if (!before) throw notFound();
    await tx.client.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, req, { entity: 'client', entityId: id, action: 'DELETE', before });
  });
}
