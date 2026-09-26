import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { toCode, today, type benefitTypeSchema, type formOptionSchema, type salesSchema, type settingsSchema, type signatorySchema } from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { putObject, signedUrl } from '../../lib/storage';
import { currentUser } from '../../middleware/authenticate';

type Out<T extends z.ZodTypeAny> = z.output<T>;
const org = (req: Request) => currentUser(req).orgId;
const notFound = (what: string) => new AppError('NOT_FOUND', `${what} tidak ditemukan`, 404);

// ─────────────── Sales ───────────────

export async function listSales(req: Request) {
  const rows = await prisma.sales.findMany({
    where: { organizationId: org(req) },
    include: { _count: { select: { mediaOrders: true } } },
    orderBy: { name: 'asc' },
  });
  return Promise.all(
    rows.map(async ({ _count, ...s }) => ({ ...s, moCount: _count.mediaOrders, signatureUrl: await signedUrl(s.signatureKey) })),
  );
}

export function createSales(req: Request, data: Out<typeof salesSchema>) {
  return prisma.$transaction(async (tx) => {
    const sales = await tx.sales.create({ data: { ...data, organizationId: org(req) } });
    await writeAudit(tx, req, { entity: 'sales', entityId: sales.id, action: 'CREATE', after: sales });
    return sales;
  });
}

export function updateSales(req: Request, id: string, data: Out<typeof salesSchema>) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.sales.findFirst({ where: { id, organizationId: org(req) } });
    if (!before) throw notFound('Sales');
    const sales = await tx.sales.update({ where: { id }, data });
    await writeAudit(tx, req, { entity: 'sales', entityId: id, action: 'UPDATE', before, after: sales });
    return sales;
  });
}

// ─────────────── Penandatangan ───────────────

export async function listSignatories(req: Request) {
  const rows = await prisma.signatory.findMany({ where: { organizationId: org(req) }, orderBy: [{ docRole: 'asc' }, { name: 'asc' }] });
  return Promise.all(rows.map(async (s) => ({ ...s, signatureUrl: await signedUrl(s.signatureKey), stampUrl: await signedUrl(s.stampKey) })));
}

// Satu default aktif per peran (index unik parsial signatories_one_default_per_role).
const clearOtherDefaults = (tx: Prisma.TransactionClient, orgId: string, data: Out<typeof signatorySchema>, exceptId?: string) =>
  data.isDefault && data.isActive
    ? tx.signatory.updateMany({
        where: { organizationId: orgId, docRole: data.docRole, isDefault: true, ...(exceptId && { id: { not: exceptId } }) },
        data: { isDefault: false },
      })
    : null;

export function createSignatory(req: Request, data: Out<typeof signatorySchema>) {
  return prisma.$transaction(async (tx) => {
    await clearOtherDefaults(tx, org(req), data);
    const s = await tx.signatory.create({ data: { ...data, organizationId: org(req) } });
    await writeAudit(tx, req, { entity: 'signatory', entityId: s.id, action: 'CREATE', after: s });
    return s;
  });
}

export function updateSignatory(req: Request, id: string, data: Out<typeof signatorySchema>) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.signatory.findFirst({ where: { id, organizationId: org(req) } });
    if (!before) throw notFound('Penandatangan');
    await clearOtherDefaults(tx, org(req), data, id);
    const s = await tx.signatory.update({ where: { id }, data });
    await writeAudit(tx, req, { entity: 'signatory', entityId: id, action: 'UPDATE', before, after: s });
    return s;
  });
}

// ─────────────── Upload tanda tangan & stempel ───────────────

type ImageTarget = { kind: 'sales'; field: 'signatureKey' } | { kind: 'signatory'; field: 'signatureKey' | 'stampKey' };

export async function uploadImage(req: Request, id: string, target: ImageTarget, file: Express.Multer.File) {
  const orgId = org(req);
  const before =
    target.kind === 'sales'
      ? await prisma.sales.findFirst({ where: { id, organizationId: orgId } })
      : await prisma.signatory.findFirst({ where: { id, organizationId: orgId } });
  if (!before) throw notFound(target.kind === 'sales' ? 'Sales' : 'Penandatangan');
  if (target.field === 'stampKey' && 'docRole' in before && before.docRole !== 'APPROVED_BY') {
    throw new AppError('STAMP_NOT_ALLOWED', 'Stempel hanya untuk penandatangan "Disetujui oleh"', 400);
  }

  const name = target.field === 'stampKey' ? 'stamp' : 'signature';
  // Nama unik per upload agar signed URL lama tidak menampilkan gambar yang sudah diganti dari cache.
  const key = `org/${orgId}/${target.kind === 'sales' ? 'sales' : 'signatories'}/${id}/${name}-${Date.now()}.png`;
  await putObject(key, file.buffer, 'image/png');

  await prisma.$transaction(async (tx) => {
    const after =
      target.kind === 'sales'
        ? await tx.sales.update({ where: { id }, data: { signatureKey: key } })
        : await tx.signatory.update({ where: { id }, data: { [target.field]: key } });
    await writeAudit(tx, req, { entity: target.kind, entityId: id, action: 'UPDATE', before, after });
  });
  return { key, url: await signedUrl(key) };
}

// ─────────────── Jenis benefit ───────────────

export function listBenefitTypes(req: Request) {
  return prisma.benefitType.findMany({ where: { organizationId: org(req) }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}

export function createBenefitType(req: Request, data: Out<typeof benefitTypeSchema>) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.benefitType.aggregate({ where: { organizationId: org(req) }, _max: { sortOrder: true } });
    const bt = await tx.benefitType.create({
      data: { ...data, code: data.code ?? toCode(data.name), sortOrder: data.sortOrder ?? (last._max.sortOrder ?? 0) + 1, organizationId: org(req) },
    });
    await writeAudit(tx, req, { entity: 'benefit_type', entityId: bt.id, action: 'CREATE', after: bt });
    return bt;
  });
}

export function updateBenefitType(req: Request, id: string, data: Out<typeof benefitTypeSchema>) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.benefitType.findFirst({ where: { id, organizationId: org(req) } });
    if (!before) throw notFound('Jenis benefit');
    // Kode tidak diubah setelah dibuat: dipakai sebagai kunci kolom laporan Finance.
    const bt = await tx.benefitType.update({ where: { id }, data: { ...data, code: before.code, sortOrder: data.sortOrder ?? before.sortOrder } });
    await writeAudit(tx, req, { entity: 'benefit_type', entityId: id, action: 'UPDATE', before, after: bt });
    return bt;
  });
}

// ─────────────── Opsi formulir ───────────────

export function listFormOptions(req: Request) {
  return prisma.formOption.findMany({ where: { organizationId: org(req) }, orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }] });
}

const invalidParent = (message: string) => new AppError('VALIDATION_ERROR', message, 400, [{ field: 'parentCode', message: 'Tidak valid' }]);

/** Hierarki hanya satu tingkat: induk harus opsi akar di grup yang sama, bukan dirinya, dan opsi yang punya anak tidak boleh jadi anak. */
async function assertParent(tx: Prisma.TransactionClient, orgId: string, data: Out<typeof formOptionSchema>, selfCode?: string) {
  if (!data.parentCode) return;
  if (data.parentCode === selfCode) throw invalidParent('Opsi tidak bisa menjadi induk dirinya sendiri');
  const parent = await tx.formOption.findFirst({ where: { organizationId: orgId, group: data.group, code: data.parentCode, parentCode: null } });
  if (!parent) throw invalidParent('Opsi induk tidak ditemukan di grup yang sama');
  if (selfCode && (await tx.formOption.count({ where: { organizationId: orgId, group: data.group, parentCode: selfCode } }))) {
    throw invalidParent('Opsi yang punya anak tidak bisa dijadikan anak');
  }
}

export function createFormOption(req: Request, data: Out<typeof formOptionSchema>) {
  return prisma.$transaction(async (tx) => {
    await assertParent(tx, org(req), data);
    const last = await tx.formOption.aggregate({ where: { organizationId: org(req), group: data.group }, _max: { sortOrder: true } });
    const opt = await tx.formOption.create({
      data: { ...data, code: data.code ?? toCode(data.label), sortOrder: data.sortOrder ?? (last._max.sortOrder ?? 0) + 1, organizationId: org(req) },
    });
    await writeAudit(tx, req, { entity: 'form_option', entityId: opt.id, action: 'CREATE', after: opt });
    return opt;
  });
}

export function updateFormOption(req: Request, id: string, data: Out<typeof formOptionSchema>) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.formOption.findFirst({ where: { id, organizationId: org(req) } });
    if (!before) throw notFound('Opsi formulir');
    await assertParent(tx, org(req), { ...data, group: before.group }, before.code);
    // Grup & kode tetap: kode tersimpan di selected_options MO.
    const opt = await tx.formOption.update({
      where: { id },
      data: { label: data.label, parentCode: data.parentCode, isActive: data.isActive, sortOrder: data.sortOrder ?? before.sortOrder },
    });
    await writeAudit(tx, req, { entity: 'form_option', entityId: id, action: 'UPDATE', before, after: opt });
    return opt;
  });
}

// ─────────────── Pengaturan (pajak, penomoran, profil) ───────────────

const currentYear = () => Number(today().slice(0, 4));

export async function getSettings(req: Request) {
  const o = await prisma.organization.findUniqueOrThrow({ where: { id: org(req) } });
  const year = currentYear();
  const seq = await prisma.moSequence.findUnique({ where: { organizationId_year: { organizationId: o.id, year } } });
  const s = o.settings as Record<string, unknown>;
  return {
    company: { name: o.name, address: o.address, bankName: o.bankName, bankAccountNo: o.bankAccountNo, bankAccountName: o.bankAccountName },
    tax: s.tax,
    numbering: s.numbering,
    termsTemplates: s.termsTemplates ?? [],
    nextSeq: { year, seq: (seq?.lastSeq ?? 0) + 1 },
  };
}

export async function updateSettings(req: Request, data: Out<typeof settingsSchema>) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({ where: { id: org(req) } });
    const prev = before.settings as Record<string, unknown>;
    const after = await tx.organization.update({
      where: { id: before.id },
      data: {
        ...data.company,
        // Kunci lain (mis. requiredClientFields, seqPad) dipertahankan.
        settings: {
          ...prev,
          tax: { ...(prev.tax as object), ...data.tax },
          numbering: { ...(prev.numbering as object), ...data.numbering },
          termsTemplates: data.termsTemplates,
        },
      },
    });
    await writeAudit(tx, req, { entity: 'organization', entityId: before.id, action: 'UPDATE', before, after });
  });
  return getSettings(req);
}
