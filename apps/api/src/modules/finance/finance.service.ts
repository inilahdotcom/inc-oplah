import type { Request } from 'express';
import { Prisma, type BillingStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  billingStatus as billingStatuses,
  billingStatusLabel,
  formatPeriodeSingkat,
  monthRange,
  moStatusLabel,
  today,
  type BillingDto,
  type DashboardDto,
  type MoListResponse,
  type MoListRow,
  type billingCreateSchema,
  type billingPaySchema,
  type moListQuery,
} from '@inc/shared';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/app-error';
import { writeAudit } from '../../lib/audit';
import { currentUser } from '../../middleware/authenticate';
import { lockMo } from '../media-orders/mo-status';

type Tx = Prisma.TransactionClient;
type Filter = z.output<typeof moListQuery>;

const org = (req: Request) => currentUser(req).orgId;
const day = (d: Date) => d.toISOString().slice(0, 10);
const D = Prisma.Decimal;

// ─────────────── Daftar MO (FR-FIN-01..03) ───────────────

/** Filter bersama daftar & ekspor. Mode periode = overlap: period_start ≤ akhir `to` dan period_end ≥ awal `from` (DATABASE §6.3). */
function listWhere(orgId: string, f: Filter, { withBilling = true } = {}): Prisma.MediaOrderWhereInput {
  const start = (m: string) => new Date(monthRange(m)[0]);
  const end = (m: string) => new Date(monthRange(m)[1]);
  const and: Prisma.MediaOrderWhereInput[] = [{ organizationId: orgId }];
  if (f.dateField === 'period') {
    if (f.to) and.push({ periodStart: { lte: end(f.to) } });
    if (f.from) and.push({ periodEnd: { gte: start(f.from) } });
  } else {
    if (f.from) and.push({ moDate: { gte: start(f.from) } });
    if (f.to) and.push({ moDate: { lte: end(f.to) } });
  }
  if (f.clientId) and.push({ clientId: f.clientId });
  if (f.salesId) and.push({ salesId: f.salesId });
  if (f.status) and.push({ status: f.status });
  if (withBilling && f.billingStatus) and.push({ billingStatus: f.billingStatus });
  if (f.fulfillment === 'none') and.push({ fulfillmentPct: 0 });
  if (f.fulfillment === 'partial') and.push({ fulfillmentPct: { gt: 0, lt: 100 } });
  if (f.fulfillment === 'full') and.push({ fulfillmentPct: { gte: 100 } });
  if (f.q) {
    and.push({
      OR: [
        { moNumber: { contains: f.q, mode: 'insensitive' } },
        { client: { companyName: { contains: f.q, mode: 'insensitive' } } },
        { sales: { name: { contains: f.q, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

const rowInclude = { sales: { select: { name: true } }, benefits: { select: { benefitTypeId: true, targetQty: true, realizedQty: true } } } satisfies Prisma.MediaOrderInclude;
type Row = Prisma.MediaOrderGetPayload<{ include: typeof rowInclude }>;

const toRow = (m: Row): MoListRow => ({
  id: m.id,
  moNumber: m.moNumber,
  moDate: day(m.moDate),
  periodStart: day(m.periodStart),
  periodEnd: day(m.periodEnd),
  companyName: (m.clientSnapshot as { companyName?: string } | null)?.companyName ?? null,
  salesName: m.sales.name,
  subtotal: m.subtotal.toFixed(0),
  ppnAmount: m.ppnAmount.toFixed(0),
  totalAmount: m.totalAmount.toFixed(0),
  fulfillmentPct: m.fulfillmentPct.toString(),
  status: m.status,
  billingStatus: m.billingStatus,
  benefits: Object.fromEntries(m.benefits.map((b) => [b.benefitTypeId, { targetQty: b.targetQty, realizedQty: b.realizedQty }])),
});

const orderBy: Prisma.MediaOrderOrderByWithRelationInput[] = [{ moDate: 'desc' }, { createdAt: 'desc' }];

export async function list(req: Request, f: Filter): Promise<MoListResponse> {
  const where = listWhere(org(req), f);
  const live = { status: { notIn: ['DRAFT', 'CANCELLED'] } } satisfies Prisma.MediaOrderWhereInput;
  const [rows, total, sums, groups] = await Promise.all([
    prisma.mediaOrder.findMany({ where, include: rowInclude, orderBy, skip: (f.page - 1) * f.limit, take: f.limit }),
    prisma.mediaOrder.count({ where }),
    // Footer tanpa MO dibatalkan (desain §3).
    prisma.mediaOrder.aggregate({ where: { AND: [where, { status: { not: 'CANCELLED' } }] }, _sum: { subtotal: true, ppnAmount: true, totalAmount: true } }),
    prisma.mediaOrder.groupBy({ by: ['billingStatus'], where: { AND: [listWhere(org(req), f, { withBilling: false }), live] }, _count: true }),
  ]);
  const money = (d: Prisma.Decimal | null) => (d ?? new D(0)).toFixed(0);
  return {
    data: rows.map(toRow),
    total,
    page: f.page,
    limit: f.limit,
    totals: { subtotal: money(sums._sum.subtotal), ppnAmount: money(sums._sum.ppnAmount), totalAmount: money(sums._sum.totalAmount) },
    billingCounts: Object.fromEntries(billingStatuses.map((s) => [s, groups.find((g) => g.billingStatus === s)?._count ?? 0])) as Record<BillingStatus, number>,
  };
}

// ─────────────── Ekspor (FR-FIN-06, ARCHITECTURE §4.7) ───────────────

// ponytail: workbook dibangun di memori; ganti ke ExcelJS streaming writer bila ekspor rutin > ~20 rb baris.
const EXPORT_LIMIT = 20_000;

export async function exportList(req: Request, f: Filter, format: 'xlsx' | 'csv') {
  const [rows, types] = await Promise.all([
    prisma.mediaOrder.findMany({ where: listWhere(org(req), f), include: rowInclude, orderBy, take: EXPORT_LIMIT }),
    prisma.benefitType.findMany({ where: { organizationId: org(req), isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  // Kolom sama dengan tabel Daftar MO di web; nominal & persen bertipe angka.
  const header = [
    'Nomor MO',
    'Tanggal MO',
    'Periode Tayang',
    'Perusahaan / Instansi',
    'Nama Sales',
    'Nominal sebelum PPN',
    'PPN',
    'Nominal setelah PPN',
    ...types.map((t) => `Benefit: ${t.name}`),
    '% Pemenuhan',
    'Status MO',
    'Status Penagihan',
  ];
  const values = rows.map((m) => {
    const r = toRow(m);
    return [
      r.moNumber ?? 'Draft',
      m.moDate,
      formatPeriodeSingkat(r.periodStart, r.periodEnd),
      r.companyName ?? '',
      r.salesName,
      Number(r.subtotal),
      Number(r.ppnAmount),
      Number(r.totalAmount),
      ...types.map((t) => (r.benefits[t.id] ? `${r.benefits[t.id].realizedQty}/${r.benefits[t.id].targetQty}` : '—')),
      Number(r.fulfillmentPct),
      moStatusLabel[r.status],
      billingStatusLabel[r.billingStatus],
    ];
  });
  const name = `daftar-mo-${today()}`;

  if (format === 'csv') {
    const cell = (v: unknown) => {
      const s = v instanceof Date ? day(v) : String(v);
      return /[",\n;]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const csv = [header, ...values].map((r) => r.map(cell).join(',')).join('\r\n');
    return { body: Buffer.from(`﻿${csv}`, 'utf8'), fileName: `${name}.csv`, type: 'text/csv; charset=utf-8' };
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daftar MO', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(header).font = { bold: true };
  values.forEach((v) => ws.addRow(v));
  ws.getColumn(2).numFmt = 'dd/mm/yyyy';
  [6, 7, 8].forEach((c) => (ws.getColumn(c).numFmt = '#,##0'));
  ws.getColumn(9 + types.length).numFmt = '0.00';
  ws.columns.forEach((c, i) => (c.width = [22, 12, 22, 32, 16, 18, 16, 18][i] ?? 14));
  const tfoot = ws.addRow(['Total', '', '', '', '', { formula: `SUM(F2:F${values.length + 1})` }, { formula: `SUM(G2:G${values.length + 1})` }, { formula: `SUM(H2:H${values.length + 1})` }]);
  tfoot.font = { bold: true };
  return { body: Buffer.from(await wb.xlsx.writeBuffer()), fileName: `${name}.xlsx`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

// ─────────────── Penagihan (FR-FIN-05) ───────────────

export const toBillingDto = (b: Prisma.BillingGetPayload<object>): BillingDto => ({
  id: b.id,
  invoiceNo: b.invoiceNo,
  invoiceDate: day(b.invoiceDate),
  amount: b.amount.toFixed(0),
  paidDate: b.paidDate ? day(b.paidDate) : null,
  paidAmount: b.paidAmount?.toFixed(0) ?? null,
  receiptNo: b.receiptNo,
  overrideReason: b.overrideReason,
  notes: b.notes,
});

/** PAID bila total dibayar ≥ total MO, selain itu BILLED (tagihan bertahap didukung). */
async function syncBillingStatus(tx: Tx, req: Request, moId: string) {
  const mo = await tx.mediaOrder.findUniqueOrThrow({ where: { id: moId }, include: { billings: true } });
  const paid = mo.billings.reduce((s, b) => s.add(b.paidAmount ?? 0), new D(0));
  const next: BillingStatus = paid.gte(mo.totalAmount) ? 'PAID' : 'BILLED';
  if (next !== mo.billingStatus) {
    await tx.mediaOrder.update({ where: { id: moId }, data: { billingStatus: next } });
    await writeAudit(tx, req, { entity: 'media_order', entityId: moId, action: 'STATUS_CHANGE', before: { billingStatus: mo.billingStatus }, after: { billingStatus: next } });
  }
}

const invalid = (field: string, message: string) => new AppError('VALIDATION_ERROR', message, 400, [{ field, message }]);

export async function createBilling(req: Request, moId: string, d: z.output<typeof billingCreateSchema>) {
  return prisma.$transaction(async (tx) => {
    const status = await lockMo(tx, org(req), moId);
    if (status === 'DRAFT' || status === 'CANCELLED') throw new AppError('INVALID_STATUS', 'Hanya MO yang sudah disubmit yang bisa ditagih', 409);
    const mo = await tx.mediaOrder.findUniqueOrThrow({ where: { id: moId }, include: { billings: true } });
    const remaining = mo.totalAmount.sub(mo.billings.reduce((s, b) => s.add(b.amount), new D(0)));
    if (new D(d.amount).gt(remaining)) throw invalid('amount', `Melebihi sisa yang belum ditagih (Rp ${remaining.toFixed(0)})`);
    // PRD §4: menagih sebelum benefit 100% boleh, tetapi wajib alasan.
    const override = mo.billingStatus === 'NOT_READY';
    if (override && !d.overrideReason) throw invalid('overrideReason', 'Alasan wajib diisi karena benefit belum terpenuhi 100%');

    const b = await tx.billing.create({
      data: { ...d, overrideReason: override ? d.overrideReason : null, mediaOrderId: moId, invoiceDate: new Date(d.invoiceDate), createdBy: currentUser(req).sub },
    });
    await writeAudit(tx, req, { entity: 'billing', entityId: b.id, action: 'CREATE', after: b });
    await syncBillingStatus(tx, req, moId);
    if (override) {
      const admins = await tx.user.findMany({ where: { organizationId: mo.organizationId, role: 'SUPER_ADMIN', isActive: true, deletedAt: null }, select: { id: true } });
      const payload = { moId, moNumber: mo.moNumber, companyName: (mo.clientSnapshot as { companyName?: string } | null)?.companyName ?? null };
      await tx.notification.createMany({ data: admins.map((u) => ({ userId: u.id, type: 'MO_BILLING_OVERRIDE' as const, payload })) });
    }
    return toBillingDto(b);
  });
}

export async function payBilling(req: Request, id: string, d: z.output<typeof billingPaySchema>) {
  const before = await prisma.billing.findFirst({ where: { id, mediaOrder: { organizationId: org(req) } } });
  if (!before) throw new AppError('NOT_FOUND', 'Tagihan tidak ditemukan', 404);
  return prisma.$transaction(async (tx) => {
    await lockMo(tx, org(req), before.mediaOrderId);
    const b = await tx.billing.update({ where: { id }, data: { paidDate: new Date(d.paidDate), paidAmount: d.paidAmount, receiptNo: d.receiptNo } });
    await writeAudit(tx, req, { entity: 'billing', entityId: id, action: 'UPDATE', before, after: b });
    await syncBillingStatus(tx, req, before.mediaOrderId);
    return toBillingDto(b);
  });
}

// ─────────────── Dashboard (FR-FIN-07) ───────────────

export async function dashboard(req: Request, yearParam?: number): Promise<DashboardDto> {
  const orgId = org(req);
  const year = yearParam ?? Number(today().slice(0, 4));
  const inYear = { organizationId: orgId, status: { notIn: ['DRAFT', 'CANCELLED'] }, moDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } satisfies Prisma.MediaOrderWhereInput;
  const now = new Date(today());
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const snap = (m: { clientSnapshot: Prisma.JsonValue }) => (m.clientSnapshot as { companyName?: string } | null)?.companyName ?? null;

  const [agg, readyCount, [recv], months, ready, ending] = await Promise.all([
    prisma.mediaOrder.aggregate({ where: inYear, _count: true, _sum: { totalAmount: true } }),
    prisma.mediaOrder.count({ where: { organizationId: orgId, billingStatus: 'READY_TO_BILL', status: { not: 'CANCELLED' } } }),
    prisma.$queryRaw<{ v: Prisma.Decimal | null }[]>(Prisma.sql`
      SELECT SUM(b.amount - COALESCE(b.paid_amount, 0)) AS v FROM billings b JOIN media_orders m ON m.id = b.media_order_id
      WHERE m.organization_id = ${orgId}::uuid AND m.billing_status = 'BILLED' AND m.status <> 'CANCELLED'`),
    prisma.$queryRaw<{ month: number; count: number; total: Prisma.Decimal }[]>(Prisma.sql`
      SELECT EXTRACT(MONTH FROM mo_date)::int AS month, COUNT(*)::int AS count, SUM(total_amount) AS total FROM media_orders
      WHERE organization_id = ${orgId}::uuid AND status NOT IN ('DRAFT', 'CANCELLED') AND EXTRACT(YEAR FROM mo_date) = ${year}
      GROUP BY 1`),
    prisma.mediaOrder.findMany({ where: { organizationId: orgId, billingStatus: 'READY_TO_BILL', status: { not: 'CANCELLED' } }, orderBy: { moDate: 'asc' }, take: 10 }),
    prisma.mediaOrder.findMany({
      where: { organizationId: orgId, status: { in: ['SUBMITTED', 'ACTIVE'] }, periodEnd: { gte: now, lte: in30 }, fulfillmentPct: { lt: 100 } },
      orderBy: { periodEnd: 'asc' },
      take: 10,
    }),
  ]);
  return {
    year,
    moCount: agg._count,
    contractValue: (agg._sum.totalAmount ?? new D(0)).toFixed(0),
    readyCount,
    receivable: new D(recv?.v ?? 0).toFixed(0),
    months: Array.from({ length: 12 }, (_, i) => {
      const m = months.find((x) => x.month === i + 1);
      return { month: i + 1, count: m?.count ?? 0, total: new D(m?.total ?? 0).toFixed(0) };
    }),
    ready: ready.map((m) => ({ id: m.id, moNumber: m.moNumber, companyName: snap(m), totalAmount: m.totalAmount.toFixed(0) })),
    ending: ending.map((m) => ({ id: m.id, moNumber: m.moNumber, companyName: snap(m), periodEnd: day(m.periodEnd), fulfillmentPct: m.fulfillmentPct.toString() })),
  };
}
