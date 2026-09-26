import type { Request } from 'express';
import { Prisma, type MoStatus } from '@prisma/client';
import { writeAudit } from '../../lib/audit';
import { assertTransition } from '../media-orders/mo-status';

/**
 * PRD §5.7 / DATABASE.md §6.2. Dipanggil di transaksi yang sama setiap kali realisasi berubah:
 * hitung ulang realized/bonus per benefit & % MO, lalu status MO dan status penagihan.
 * Penagihan BILLED/PAID tidak pernah diubah otomatis. Menjadi READY_TO_BILL → notifikasi ke semua Finance.
 */
export async function recalcFulfillment(tx: Prisma.TransactionClient, req: Request, moId: string) {
  await tx.$executeRaw(Prisma.sql`
    UPDATE mo_benefits b SET
      realized_qty = LEAST(b.target_qty, (SELECT COUNT(*) FROM publications p WHERE p.mo_benefit_id = b.id AND p.is_bonus = false)),
      bonus_qty = (SELECT COUNT(*) FROM publications p WHERE p.mo_benefit_id = b.id AND p.is_bonus = true)
    WHERE b.media_order_id = ${moId}::uuid`);
  await tx.$executeRaw(Prisma.sql`
    UPDATE media_orders m SET fulfillment_pct = COALESCE((
      SELECT ROUND(SUM(realized_qty)::numeric * 100 / NULLIF(SUM(target_qty), 0), 2) FROM mo_benefits WHERE media_order_id = m.id), 0)
    WHERE m.id = ${moId}::uuid`);

  const mo = await tx.mediaOrder.findUniqueOrThrow({
    where: { id: moId },
    include: { benefits: true, _count: { select: { publications: true, attachments: true } } },
  });
  if (mo.status === 'DRAFT' || mo.status === 'CANCELLED') return { becameReady: false };

  const full = mo.benefits.length > 0 && mo.benefits.every((b) => b.realizedQty >= b.targetQty);
  const billed = mo.billingStatus === 'BILLED' || mo.billingStatus === 'PAID';
  let status: MoStatus = mo.status;
  const step = (to: MoStatus) => {
    assertTransition(status, to);
    status = to;
  };
  if (status === 'SUBMITTED' && mo._count.publications + mo._count.attachments > 0) step('ACTIVE');
  if (status === 'ACTIVE' && full) step('COMPLETED');
  if (status === 'COMPLETED' && !full && !billed) step('ACTIVE');
  const billingStatus = billed ? mo.billingStatus : full ? 'READY_TO_BILL' : 'NOT_READY';

  if (status === mo.status && billingStatus === mo.billingStatus) return { becameReady: false };
  await tx.mediaOrder.update({ where: { id: moId }, data: { status, billingStatus } });
  await writeAudit(tx, req, {
    entity: 'media_order',
    entityId: moId,
    action: 'STATUS_CHANGE',
    before: { status: mo.status, billingStatus: mo.billingStatus },
    after: { status, billingStatus },
  });

  const becameReady = billingStatus === 'READY_TO_BILL' && mo.billingStatus !== 'READY_TO_BILL';
  if (becameReady) {
    const finance = await tx.user.findMany({
      where: { organizationId: mo.organizationId, role: 'FINANCE', isActive: true, deletedAt: null },
      select: { id: true },
    });
    const payload = { moId, moNumber: mo.moNumber, companyName: (mo.clientSnapshot as { companyName?: string } | null)?.companyName ?? null };
    await tx.notification.createMany({ data: finance.map((u) => ({ userId: u.id, type: 'MO_READY_TO_BILL' as const, payload })) });
  }
  return { becameReady };
}
