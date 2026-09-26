import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { isHttpUrl, normalizeUrl, type PublicationBulkResult, type PublicationDto, type publicationBulkSchema, type publicationSchema } from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { putObject, signedUrl } from '../../lib/storage';
import { currentUser } from '../../middleware/authenticate';
import { lockMo } from '../media-orders/mo-status';
import { recalcFulfillment } from './fulfillment.service';

type Tx = Prisma.TransactionClient;
type Input = z.output<typeof publicationSchema>;

const org = (req: Request) => currentUser(req).orgId;
const include = { moBenefit: { select: { benefitTypeId: true } } } satisfies Prisma.PublicationInclude;
type Row = Prisma.PublicationGetPayload<{ include: typeof include }>;

const toDto = async (p: Row): Promise<PublicationDto> => ({
  id: p.id,
  moBenefitId: p.moBenefitId,
  benefitTypeId: p.moBenefit.benefitTypeId,
  publishedDate: p.publishedDate.toISOString().slice(0, 10),
  title: p.title,
  url: p.url,
  notes: p.notes,
  isBonus: p.isBonus,
  screenshotUrl: await signedUrl(p.screenshotKey),
  createdAt: p.createdAt.toISOString(),
});

const fieldError = (code: string, field: string, message: string, status = 400) => new AppError(code, message, status, [{ field, message }]);

/** FR-PUB-01/06: realisasi hanya untuk MO yang sudah disubmit dan belum ditagih. Baris MO dikunci agar kuota tidak bocor. */
async function editableMo(tx: Tx, orgId: string, moId: string) {
  const status = await lockMo(tx, orgId, moId);
  if (status === 'DRAFT' || status === 'CANCELLED') {
    throw new AppError('INVALID_STATUS', 'Realisasi hanya untuk MO yang sudah disubmit', 409);
  }
  const mo = await tx.mediaOrder.findUniqueOrThrow({ where: { id: moId }, select: { billingStatus: true, benefits: { select: { id: true, targetQty: true } } } });
  if (mo.billingStatus === 'BILLED' || mo.billingStatus === 'PAID') {
    throw new AppError('MO_BILLED', 'MO sudah ditagih; realisasi tidak bisa diubah', 409);
  }
  return mo;
}

const benefitOf = (mo: { benefits: { id: string; targetQty: number }[] }, id: string) => {
  const b = mo.benefits.find((x) => x.id === id);
  if (!b) throw fieldError('VALIDATION_ERROR', 'moBenefitId', 'Jenis benefit tidak ada di MO ini');
  return b;
};

/** FR-PUB-04: realisasi non-bonus tidak boleh melebihi target. */
async function assertQuota(tx: Tx, benefit: { id: string; targetQty: number }, isBonus: boolean, exceptId?: string) {
  if (isBonus) return;
  const used = await tx.publication.count({ where: { moBenefitId: benefit.id, isBonus: false, ...(exceptId && { id: { not: exceptId } }) } });
  if (used >= benefit.targetQty) {
    throw fieldError('QUOTA_EXCEEDED', 'isBonus', `Kuota benefit sudah terpenuhi (${used}/${benefit.targetQty}). Centang "Bonus / melebihi kontrak" untuk mencatat lebih.`, 409);
  }
}

/** FR-PUB-03: URL yang sama (setelah dinormalisasi) tidak boleh dua kali di MO yang sama. */
async function assertUniqueUrl(tx: Tx, moId: string, urlNormalized: string, exceptId?: string) {
  if (await tx.publication.count({ where: { mediaOrderId: moId, urlNormalized, ...(exceptId && { id: { not: exceptId } }) } })) {
    throw fieldError('DUPLICATE_URL', 'url', 'URL ini sudah tercatat di MO ini', 409);
  }
}

async function findOwned(req: Request, id: string) {
  const p = await prisma.publication.findFirst({ where: { id, mediaOrder: { organizationId: org(req) } }, include });
  if (!p) throw new AppError('NOT_FOUND', 'Realisasi tidak ditemukan', 404);
  return p;
}

export async function list(req: Request, moId: string) {
  if (!(await prisma.mediaOrder.count({ where: { id: moId, organizationId: org(req) } }))) throw new AppError('NOT_FOUND', 'Media Order tidak ditemukan', 404);
  const rows = await prisma.publication.findMany({ where: { mediaOrderId: moId }, include, orderBy: [{ publishedDate: 'desc' }, { createdAt: 'desc' }] });
  return Promise.all(rows.map(toDto));
}

export async function create(req: Request, moId: string, d: Input) {
  return prisma.$transaction(async (tx) => {
    const mo = await editableMo(tx, org(req), moId);
    const benefit = benefitOf(mo, d.moBenefitId);
    const urlNormalized = normalizeUrl(d.url);
    await assertUniqueUrl(tx, moId, urlNormalized);
    await assertQuota(tx, benefit, d.isBonus);
    const p = await tx.publication.create({
      data: { ...d, mediaOrderId: moId, publishedDate: new Date(d.publishedDate), urlNormalized, createdBy: currentUser(req).sub },
      include,
    });
    await writeAudit(tx, req, { entity: 'publication', entityId: p.id, action: 'CREATE', after: p });
    return { publication: await toDto(p), ...(await recalcFulfillment(tx, req, moId)) };
  });
}

/** FR-PUB-02: setiap URL divalidasi sendiri; yang lolos disimpan, sisanya dikembalikan beserta alasannya. */
export async function bulk(req: Request, moId: string, d: z.output<typeof publicationBulkSchema>) {
  return prisma.$transaction(async (tx) => {
    const mo = await editableMo(tx, org(req), moId);
    const benefit = benefitOf(mo, d.moBenefitId);
    const taken = new Set((await tx.publication.findMany({ where: { mediaOrderId: moId }, select: { urlNormalized: true } })).map((p) => p.urlNormalized));
    let remaining = d.isBonus ? Infinity : benefit.targetQty - (await tx.publication.count({ where: { moBenefitId: benefit.id, isBonus: false } }));
    const rows: Prisma.PublicationCreateManyInput[] = [];
    const rejected: PublicationBulkResult['rejected'] = [];
    for (const url of d.urls.filter(Boolean)) {
      const reason = !isHttpUrl(url)
        ? 'URL tidak valid'
        : taken.has(normalizeUrl(url))
          ? 'URL sudah tercatat / ganda'
          : remaining <= 0
            ? 'Melebihi kuota benefit (centang Bonus untuk mencatat lebih)'
            : null;
      if (reason) {
        rejected.push({ url, reason });
        continue;
      }
      taken.add(normalizeUrl(url));
      remaining--;
      rows.push({ id: randomUUID(), mediaOrderId: moId, moBenefitId: benefit.id, publishedDate: new Date(d.publishedDate), url, urlNormalized: normalizeUrl(url), isBonus: d.isBonus, createdBy: currentUser(req).sub });
    }
    await tx.publication.createMany({ data: rows });
    if (rows.length) await writeAudit(tx, req, { entity: 'media_order', entityId: moId, action: 'UPDATE', after: { publicationsAdded: rows.map((r) => r.url) } });
    return { created: rows.length, rejected, ...(await recalcFulfillment(tx, req, moId)) };
  });
}

export async function update(req: Request, id: string, d: Input) {
  const before = await findOwned(req, id);
  return prisma.$transaction(async (tx) => {
    const mo = await editableMo(tx, org(req), before.mediaOrderId);
    const benefit = benefitOf(mo, d.moBenefitId);
    const urlNormalized = normalizeUrl(d.url);
    await assertUniqueUrl(tx, before.mediaOrderId, urlNormalized, id);
    await assertQuota(tx, benefit, d.isBonus, id);
    const p = await tx.publication.update({ where: { id }, data: { ...d, publishedDate: new Date(d.publishedDate), urlNormalized }, include });
    await writeAudit(tx, req, { entity: 'publication', entityId: id, action: 'UPDATE', before, after: p });
    return { publication: await toDto(p), ...(await recalcFulfillment(tx, req, before.mediaOrderId)) };
  });
}

export async function remove(req: Request, id: string) {
  const before = await findOwned(req, id);
  return prisma.$transaction(async (tx) => {
    await editableMo(tx, org(req), before.mediaOrderId);
    await tx.publication.delete({ where: { id } });
    await writeAudit(tx, req, { entity: 'publication', entityId: id, action: 'DELETE', before });
    return recalcFulfillment(tx, req, before.mediaOrderId);
  });
}

/** Bukti screenshot opsional (gambar ≤ 5 MB, ARCHITECTURE §4.6). */
export async function uploadScreenshot(req: Request, id: string, file: Express.Multer.File) {
  const before = await findOwned(req, id);
  const key = `org/${org(req)}/publications/${id}/${randomUUID()}.${file.mimetype === 'image/png' ? 'png' : 'jpg'}`;
  await prisma.$transaction(async (tx) => editableMo(tx, org(req), before.mediaOrderId));
  await putObject(key, file.buffer, file.mimetype);
  const p = await prisma.$transaction(async (tx) => {
    const after = await tx.publication.update({ where: { id }, data: { screenshotKey: key }, include });
    await writeAudit(tx, req, { entity: 'publication', entityId: id, action: 'UPDATE', before, after });
    return after;
  });
  return toDto(p);
}
