import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  formatMoNumber,
  moPdfFileName,
  moDraftSchema,
  moSubmitSchema,
  today,
  type MediaOrderDto,
  type MoDraft,
  type calculateSchema,
} from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { logger } from '../../lib/logger';
import { renderPdf } from '../../lib/pdf';
import { getObject, putObject, signedUrl } from '../../lib/storage';
import { currentUser } from '../../middleware/authenticate';
import { calculateTax, type TaxRate } from '../tax/tax.service';
import { moHtml, type PdfImages } from './mo-pdf';
import { assertTransition, lockMo } from './mo-status';
import { recalcFulfillment } from '../publications/fulfillment.service';
import { toBillingDto } from '../finance/finance.service';

type Tx = Prisma.TransactionClient;

const include = {
  sales: true,
  createdBySignatory: true,
  acknowledgedBy: true,
  approvedBy: true,
  benefits: { orderBy: { sortOrder: 'asc' } },
  attachments: { orderBy: { createdAt: 'desc' } },
  billings: { orderBy: [{ invoiceDate: 'asc' }, { createdAt: 'asc' }] },
  revisionOf: { select: { id: true, moNumber: true } },
  revisedInto: { select: { id: true, moNumber: true } },
} satisfies Prisma.MediaOrderInclude;
type MoRow = Prisma.MediaOrderGetPayload<{ include: typeof include }>;

type Signer = { name: string; title: string; signatureKey: string | null; stampKey?: string | null };
type Signers = { createdBy: Signer; acknowledgedBy: Signer | null; approvedBy: Signer | null };

const org = (req: Request) => currentUser(req).orgId;
const day = (d: Date) => d.toISOString().slice(0, 10);
const notFound = () => new AppError('NOT_FOUND', 'Media Order tidak ditemukan', 404);
const locked = () => new AppError('MO_LOCKED', 'MO yang sudah disubmit tidak bisa diubah. Gunakan Revisi.', 409);

// ─────────────── Mapping ───────────────

const toDraft = (mo: MoRow): MoDraft => ({
  moSeq: mo.moSeq,
  moDate: day(mo.moDate),
  clientId: mo.clientId,
  salesId: mo.salesId,
  clientSnapshot: mo.clientSnapshot as MoDraft['clientSnapshot'],
  periodStart: day(mo.periodStart),
  periodEnd: mo.periodEnd && day(mo.periodEnd),
  description: mo.description,
  airingDateText: mo.airingDateText,
  selectedOptions: { AD_TYPE: [], COOP_TYPE: [], PLACEMENT: [], AD_LOCATION: [], ...(mo.selectedOptions as object) },
  benefits: mo.benefits.map((b) => ({ benefitTypeId: b.benefitTypeId, targetQty: b.targetQty, notes: b.notes })),
  cooperationDetail: mo.cooperationDetail,
  termsConditions: mo.termsConditions,
  paymentMethod: mo.paymentMethod,
  chequeNo: mo.chequeNo,
  receiptNo: mo.receiptNo,
  dueDateText: mo.dueDateText,
  adProduct: mo.adProduct,
  subtotal: mo.subtotal.toFixed(0),
  isTaxable: mo.isTaxable,
  createdBySignatoryId: mo.createdBySignatoryId,
  acknowledgedById: mo.acknowledgedById,
  approvedById: mo.approvedById,
});

/** Penandatangan: snapshot bila sudah submit, selain itu data master terkini. */
const signersOf = (mo: MoRow): Signers =>
  (mo.signatorySnapshot as Signers | null) ?? {
    // "Dibuat oleh" default sales; bisa diganti penandatangan mana pun.
    createdBy: (({ name, title, signatureKey }) => ({ name, title, signatureKey }))(mo.createdBySignatory ?? mo.sales),
    acknowledgedBy: mo.acknowledgedBy && { name: mo.acknowledgedBy.name, title: mo.acknowledgedBy.title, signatureKey: mo.acknowledgedBy.signatureKey },
    approvedBy: mo.approvedBy && {
      name: mo.approvedBy.name,
      title: mo.approvedBy.title,
      signatureKey: mo.approvedBy.signatureKey,
      stampKey: mo.approvedBy.stampKey,
    },
  };

async function toDto(mo: MoRow): Promise<MediaOrderDto> {
  const s = signersOf(mo);
  const pub = (x: Signer | null) => x && { name: x.name, title: x.title };
  return {
    ...toDraft(mo),
    id: mo.id,
    moNumber: mo.moNumber,
    status: mo.status,
    billingStatus: mo.billingStatus,
    dppAmount: mo.dppAmount.toFixed(0),
    ppnAmount: mo.ppnAmount.toFixed(0),
    totalAmount: mo.totalAmount.toFixed(0),
    ppnRate: mo.ppnRate.toString(),
    dppFactorNum: mo.dppFactorNum,
    dppFactorDen: mo.dppFactorDen,
    cancelReason: mo.cancelReason,
    submittedAt: mo.submittedAt?.toISOString() ?? null,
    sales: { name: mo.sales.name, code: mo.sales.code },
    signatories: { createdBy: pub(s.createdBy), acknowledgedBy: pub(s.acknowledgedBy), approvedBy: pub(s.approvedBy) },
    fulfillmentPct: mo.fulfillmentPct.toString(),
    benefitProgress: mo.benefits.map((b) => ({ id: b.id, benefitTypeId: b.benefitTypeId, targetQty: b.targetQty, realizedQty: b.realizedQty, bonusQty: b.bonusQty })),
    revisionOf: mo.revisionOf,
    revisedInto: mo.revisedInto,
    attachments: await Promise.all(
      mo.attachments.map(async (a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
        url: await signedUrl(a.fileKey),
      })),
    ),
    billings: mo.billings.map(toBillingDto),
  };
}

// ─────────────── Pendukung ───────────────

async function orgSettings(tx: Tx, orgId: string) {
  const o = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { settings: true } });
  const s = o.settings as unknown as { tax: TaxRate; numbering: { template: string; seqPad?: number } };
  return { tax: s.tax, numbering: s.numbering };
}

/** Kolom MO dari data form; nominal pajak selalu dihitung ulang di backend (FR-MO-03). */
function toData({ benefits: _b, moDate, periodStart, periodEnd, ...rest }: MoDraft, rate: TaxRate) {
  const tax = calculateTax(rest.subtotal, rest.isTaxable, rate);
  return {
    ...rest,
    moDate: new Date(moDate),
    periodStart: new Date(periodStart),
    periodEnd: periodEnd ? new Date(periodEnd) : null,
    dppAmount: tax.dpp,
    ppnAmount: tax.ppn,
    totalAmount: tax.total,
    ppnRate: tax.ppnRate,
    dppFactorNum: tax.dppNum,
    dppFactorDen: tax.dppDen,
  };
}

const benefitRows = (d: MoDraft) => d.benefits.map((b, i) => ({ ...b, sortOrder: i }));

/** Semua referensi harus milik organisasi user (FK saja tidak mencegah lintas organisasi). */
const invalid = (field: string, message: string) => new AppError('VALIDATION_ERROR', message, 400, [{ field, message }]);

/** SEQ unik per organisasi per tahun di antara MO yang sudah bernomor (manual maupun otomatis). */
const seqTaken = async (tx: Tx, orgId: string, year: number, seq: number) =>
  (await tx.mediaOrder.count({ where: { organizationId: orgId, moYear: year, moSeq: seq, moNumber: { not: null } } })) > 0;
const seqTakenError = () => invalid('moSeq', 'No. urut sudah dipakai tahun ini');

async function assertRefs(tx: Tx, orgId: string, d: MoDraft) {
  if (d.moSeq && (await seqTaken(tx, orgId, Number(d.moDate.slice(0, 4)), d.moSeq))) throw seqTakenError();
  if (!(await tx.client.count({ where: { id: d.clientId, organizationId: orgId, deletedAt: null } }))) throw invalid('clientId', 'Klien tidak ditemukan');
  if (!(await tx.sales.count({ where: { id: d.salesId, organizationId: orgId } }))) throw invalid('salesId', 'Sales tidak ditemukan');
  const typeIds = [...new Set(d.benefits.map((b) => b.benefitTypeId))];
  if ((await tx.benefitType.count({ where: { id: { in: typeIds }, organizationId: orgId } })) !== typeIds.length) {
    throw invalid('benefits', 'Jenis benefit tidak ditemukan');
  }
  const sigIds = [d.createdBySignatoryId, d.acknowledgedById, d.approvedById].filter((x): x is string => !!x);
  if ((await tx.signatory.count({ where: { id: { in: sigIds }, organizationId: orgId } })) !== new Set(sigIds).size) {
    throw invalid('acknowledgedById', 'Penandatangan tidak ditemukan');
  }
}

async function createDraft(tx: Tx, req: Request, d: MoDraft, revisionOfMoId: string | null = null) {
  const user = currentUser(req);
  const { tax } = await orgSettings(tx, user.orgId);
  const mo = await tx.mediaOrder.create({
    data: { ...toData(d, tax), organizationId: user.orgId, createdBy: user.sub, revisionOfMoId, benefits: { create: benefitRows(d) } },
    include,
  });
  await writeAudit(tx, req, { entity: 'media_order', entityId: mo.id, action: 'CREATE', after: mo });
  return mo;
}

const findMo = (tx: Tx, orgId: string, id: string) => tx.mediaOrder.findFirst({ where: { id, organizationId: orgId }, include });

// ─────────────── CRUD draft ───────────────

export async function calculate(req: Request, { subtotal, isTaxable }: z.output<typeof calculateSchema>) {
  const { tax } = await orgSettings(prisma, org(req));
  return calculateTax(subtotal, isTaxable, tax);
}

export async function get(req: Request, id: string) {
  const mo = await findMo(prisma, org(req), id);
  if (!mo) throw notFound();
  return toDto(mo);
}

export async function create(req: Request, d: MoDraft) {
  const mo = await prisma.$transaction(async (tx) => {
    await assertRefs(tx, org(req), d);
    return createDraft(tx, req, d);
  });
  return toDto(mo);
}

export async function update(req: Request, id: string, body: unknown) {
  const mo = await prisma.$transaction(async (tx) => {
    if ((await lockMo(tx, org(req), id)) !== 'DRAFT') throw locked();
    const d = moDraftSchema.parse(body);
    await assertRefs(tx, org(req), d);
    const before = await tx.mediaOrder.findUniqueOrThrow({ where: { id }, include });
    const { tax } = await orgSettings(tx, org(req));
    await tx.moBenefit.deleteMany({ where: { mediaOrderId: id } });
    const after = await tx.mediaOrder.update({ where: { id }, data: { ...toData(d, tax), benefits: { create: benefitRows(d) } }, include });
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'UPDATE', before, after });
    return after;
  });
  return toDto(mo);
}

/** Hanya Draft yang boleh dihapus fisik (DATABASE.md §1). */
export async function remove(req: Request, id: string) {
  await prisma.$transaction(async (tx) => {
    if ((await lockMo(tx, org(req), id)) !== 'DRAFT') throw locked();
    const before = await tx.mediaOrder.delete({ where: { id } });
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'DELETE', before });
  });
}

// ─────────────── Submit, batal, revisi, duplikat ───────────────

/**
 * FR-MO-08 / ARCHITECTURE §4.4: validasi penuh, pajak & penandatangan di-snapshot, nomor dari `mo_sequences`.
 * Upsert mengunci baris urutan tahun itu sampai commit, jadi submit bersamaan antre dan tidak pernah bentrok.
 */
export async function submit(req: Request, id: string) {
  const orgId = org(req);
  const mo = await prisma.$transaction(async (tx) => {
    if ((await lockMo(tx, orgId, id)) !== 'DRAFT') throw locked();
    const before = await tx.mediaOrder.findUniqueOrThrow({ where: { id }, include });
    const d = moSubmitSchema.parse(toDraft(before)); // ZodError → 400 per field
    await assertRefs(tx, orgId, d);
    const { tax, numbering } = await orgSettings(tx, orgId);
    // Baris urutan tahun itu selalu dikunci agar submit manual & otomatis antre.
    // SEQ manual tidak menggeser counter; SEQ otomatis melompati yang sudah dipakai manual.
    const year = Number(d.moDate.slice(0, 4));
    const next = async (step: number) =>
      (
        await tx.$queryRaw<{ seq: number }[]>(Prisma.sql`
      INSERT INTO mo_sequences (organization_id, year, last_seq) VALUES (${orgId}::uuid, ${year}, ${step})
      ON CONFLICT (organization_id, year) DO UPDATE SET last_seq = mo_sequences.last_seq + ${step}
      RETURNING last_seq AS seq`)
      )[0].seq;
    let seq: number;
    if (d.moSeq) {
      await next(0);
      if (await seqTaken(tx, orgId, year, d.moSeq)) throw seqTakenError();
      seq = d.moSeq;
    } else {
      // ponytail: satu query per SEQ terpakai; cukup selama SEQ manual jarang.
      do seq = await next(1);
      while (await seqTaken(tx, orgId, year, seq));
    }
    assertTransition(before.status, 'SUBMITTED');
    const after = await tx.mediaOrder.update({
      where: { id },
      data: {
        ...toData(d, tax),
        status: 'SUBMITTED',
        moNumber: formatMoNumber(numbering.template, { seq, pad: numbering.seqPad, salesCode: before.sales.code, moDate: d.moDate }),
        moSeq: seq,
        moYear: year,
        signatorySnapshot: signersOf(before),
        submittedAt: new Date(),
        submittedBy: currentUser(req).sub,
      },
      include,
    });
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'SUBMIT', before, after });
    // Draft revisi membawa realisasi MO lama: status & pemenuhan langsung dihitung ulang.
    if (before.benefits.some((b) => b.realizedQty + b.bonusQty > 0)) {
      await recalcFulfillment(tx, req, id);
      return tx.mediaOrder.findUniqueOrThrow({ where: { id }, include });
    }
    return after;
  });
  // Di luar transaksi: gagal render/unggah tidak membatalkan submit; `/pdf` merender saat diminta.
  await storePdf(mo).catch((err) => logger.warn({ err, moId: id }, 'PDF final belum tersimpan'));
  return toDto(mo);
}

export async function cancel(req: Request, id: string, reason: string) {
  const mo = await prisma.$transaction(async (tx) => {
    assertTransition(await lockMo(tx, org(req), id), 'CANCELLED');
    const after = await tx.mediaOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() }, include });
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'CANCEL', after: { status: after.status, cancelReason: reason } });
    return after;
  });
  return toDto(mo);
}

/** FR-MO-09: MO lama dibatalkan ("Direvisi"), Draft salinan dibuat; realisasi publikasi ikut pindah. */
export async function revise(req: Request, id: string) {
  const mo = await prisma.$transaction(async (tx) => {
    assertTransition(await lockMo(tx, org(req), id), 'CANCELLED');
    const old = await tx.mediaOrder.findUniqueOrThrow({ where: { id }, include });
    if (old.billingStatus === 'BILLED' || old.billingStatus === 'PAID') {
      throw new AppError('MO_BILLED', 'MO yang sudah ditagih tidak bisa direvisi', 409);
    }
    await tx.mediaOrder.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: 'Direvisi', cancelledAt: new Date() } });
    const draft = await createDraft(tx, req, { ...toDraft(old), moSeq: null, moDate: today() }, id);
    for (const b of old.benefits) {
      const nb = draft.benefits.find((x) => x.benefitTypeId === b.benefitTypeId)!;
      await tx.publication.updateMany({ where: { moBenefitId: b.id }, data: { mediaOrderId: draft.id, moBenefitId: nb.id } });
    }
    await recalcFulfillment(tx, req, draft.id); // Draft: hanya angka pemenuhan, status tetap
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'REVISE', after: { revisedInto: draft.id } });
    return tx.mediaOrder.findUniqueOrThrow({ where: { id: draft.id }, include });
  });
  return toDto(mo);
}

/** FR-MO-10: Draft baru dari MO mana pun, bertanggal hari ini. */
export async function duplicate(req: Request, id: string) {
  const mo = await prisma.$transaction(async (tx) => {
    const src = await findMo(tx, org(req), id);
    if (!src) throw notFound();
    return createDraft(tx, req, { ...toDraft(src), moSeq: null, moDate: today() });
  });
  return toDto(mo);
}

// ─────────────── Lampiran ───────────────

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** FR-MO-12. Lampiran pertama pada MO SUBMITTED menjadikannya ACTIVE (PRD §4). */
export async function addAttachment(req: Request, id: string, file: Express.Multer.File) {
  const orgId = org(req);
  const current = await prisma.mediaOrder.findFirst({ where: { id, organizationId: orgId }, select: { status: true } });
  if (!current) throw notFound();
  if (current.status === 'DRAFT' || current.status === 'CANCELLED') {
    throw new AppError('INVALID_STATUS', 'Lampiran hanya untuk MO yang sudah disubmit', 409);
  }
  const key = `org/${orgId}/mo/${id}/attachments/${randomUUID()}.${EXT[file.mimetype]}`;
  await putObject(key, file.buffer, file.mimetype);

  await prisma.$transaction(async (tx) => {
    const status = await lockMo(tx, orgId, id);
    const a = await tx.moAttachment.create({
      data: { mediaOrderId: id, fileKey: key, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, uploadedBy: currentUser(req).sub },
    });
    if (status === 'SUBMITTED') {
      assertTransition(status, 'ACTIVE');
      await tx.mediaOrder.update({ where: { id }, data: { status: 'ACTIVE' } });
    }
    await writeAudit(tx, req, { entity: 'media_order', entityId: id, action: 'UPDATE', after: { attachment: a, status: status === 'SUBMITTED' ? 'ACTIVE' : status } });
  });
  return get(req, id);
}

// ─────────────── PDF ───────────────

async function renderMo(mo: MoRow) {
  const [o, options] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: mo.organizationId } }),
    prisma.formOption.findMany({ where: { organizationId: mo.organizationId }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const images: PdfImages = {};
  if (mo.status !== 'DRAFT') {
    const s = signersOf(mo);
    const uri = async (key?: string | null) => {
      const buf = key ? await getObject(key) : null;
      return buf ? `data:image/png;base64,${buf.toString('base64')}` : undefined;
    };
    [images.createdBy, images.acknowledgedBy, images.approvedBy, images.stamp] = await Promise.all([
      uri(s.createdBy.signatureKey),
      uri(s.acknowledgedBy?.signatureKey),
      uri(s.approvedBy?.signatureKey),
      uri(s.approvedBy?.stampKey),
    ]);
  }
  return renderPdf(moHtml(await toDto(mo), o, options, images));
}

/** PDF final disimpan agar unduhan selalu sama (PRD §8). */
async function storePdf(mo: MoRow) {
  const key = `org/${mo.organizationId}/mo/${mo.id}/pdf/${mo.moNumber!.replaceAll('/', '-')}.pdf`;
  await putObject(key, await renderMo(mo), 'application/pdf');
  await prisma.mediaOrder.update({ where: { id: mo.id }, data: { pdfKey: key } });
}

export async function pdf(req: Request, id: string) {
  const mo = await findMo(prisma, org(req), id);
  if (!mo) throw notFound();
  // Tersimpan dipakai kecuali Draft (belum final) dan Dibatalkan (perlu watermark).
  const stored = mo.pdfKey && mo.status !== 'DRAFT' && mo.status !== 'CANCELLED' ? await getObject(mo.pdfKey) : null;
  const snap = mo.clientSnapshot as MoDraft['clientSnapshot'];
  return {
    body: stored ?? (await renderMo(mo)),
    fileName: moPdfFileName({ moNumber: mo.moNumber, companyName: snap.companyName ?? 'KLIEN', periodStart: day(mo.periodStart), periodEnd: mo.periodEnd && day(mo.periodEnd) }),
  };
}

/** Tombol "Generate ulang" Super Admin (PRD §8). */
export async function regeneratePdf(req: Request, id: string) {
  const mo = await findMo(prisma, org(req), id);
  if (!mo) throw notFound();
  if (mo.status === 'DRAFT') throw new AppError('INVALID_STATUS', 'PDF final hanya untuk MO yang sudah disubmit', 409);
  await storePdf(mo);
}

// ─────────────── Riwayat (FR-AUD-01) ───────────────

type AuditRow = { id: string; entity: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; user_name: string | null; created_at: Date };

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Dibuat',
  UPDATE: 'Diubah',
  DELETE: 'Dihapus',
  SUBMIT: 'Disubmit',
  CANCEL: 'Dibatalkan',
  REVISE: 'Direvisi',
  STATUS_CHANGE: 'Status berubah',
};

/** Ringkasan satu baris untuk tampilan riwayat; detail lengkap tetap di kolom JSONB audit_logs. */
function auditSummary(r: AuditRow): string | null {
  const v = r.after ?? r.before ?? {};
  if (r.entity === 'publication') return `Realisasi: ${String(v.url ?? '')}`;
  if (r.entity === 'billing') return r.action === 'CREATE' ? `Tagihan ${String(v.invoiceNo)} Rp ${String(v.amount)}` : `Pembayaran ${String(v.invoiceNo)} Rp ${String(v.paidAmount ?? '')}`;
  if (r.action === 'STATUS_CHANGE') return Object.entries(r.after ?? {}).map(([k, to]) => `${k}: ${String((r.before ?? {})[k])} → ${String(to)}`).join(', ');
  if (r.action === 'CANCEL') return `Alasan: ${String(v.cancelReason ?? '')}`;
  if (r.action === 'SUBMIT') return `Nomor ${String(v.moNumber ?? '')}`;
  if (v.attachment) return `Lampiran: ${String((v.attachment as { fileName?: string }).fileName ?? '')}`;
  return null;
}

/** Audit MO beserta realisasi & tagihannya (dicocokkan lewat `mediaOrderId` di snapshot JSON). */
export async function history(req: Request, id: string) {
  if (!(await prisma.mediaOrder.count({ where: { id, organizationId: org(req) } }))) throw notFound();
  const rows = await prisma.$queryRaw<AuditRow[]>(Prisma.sql`
    SELECT a.id, a.entity, a.action, a.before, a.after, u.name AS user_name, a.created_at
    FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.organization_id = ${org(req)}::uuid
      AND ((a.entity = 'media_order' AND a.entity_id = ${id}::uuid)
        OR (a.entity IN ('publication', 'billing') AND COALESCE(a.after->>'mediaOrderId', a.before->>'mediaOrderId') = ${id}))
    ORDER BY a.created_at DESC LIMIT 200`);
  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    action: ACTION_LABEL[r.action] ?? r.action,
    userName: r.user_name,
    createdAt: r.created_at.toISOString(),
    summary: auditSummary(r),
  }));
}
