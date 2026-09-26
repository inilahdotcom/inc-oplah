import { Prisma } from '@prisma/client';
import { today } from '@inc/shared';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

/**
 * ARCHITECTURE §4.8 `period-ending-reminder`: MO ACTIVE/SUBMITTED yang berakhir ≤ 30 hari lagi dengan
 * pemenuhan < 100% → notifikasi ke pembuat MO, sekali per MO (`period_ending_notified_at`).
 */
export async function periodEndingReminder(now = new Date(today())) {
  return prisma.$transaction(async (tx) => {
    const due = await tx.mediaOrder.findMany({
      where: {
        status: { in: ['SUBMITTED', 'ACTIVE'] },
        periodEnd: { gte: now, lte: new Date(now.getTime() + 30 * 86_400_000) },
        fulfillmentPct: { lt: 100 },
        periodEndingNotifiedAt: null,
      },
      select: { id: true, moNumber: true, clientSnapshot: true, createdBy: true },
    });
    if (!due.length) return 0;
    await tx.notification.createMany({
      data: due.map((m) => ({
        userId: m.createdBy,
        type: 'MO_PERIOD_ENDING' as const,
        payload: { moId: m.id, moNumber: m.moNumber, companyName: (m.clientSnapshot as { companyName?: string } | null)?.companyName ?? null },
      })),
    });
    await tx.mediaOrder.updateMany({ where: { id: { in: due.map((m) => m.id) } }, data: { periodEndingNotifiedAt: new Date() } });
    return due.length;
  });
}

/** `cleanup-refresh-tokens`: hapus refresh token kedaluwarsa. */
export const cleanupRefreshTokens = () => prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

const JOB_LOCK = 4_210_001; // kunci advisory: hanya satu instance API yang menjalankan job

async function runJobs() {
  try {
    await prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>(Prisma.sql`SELECT pg_try_advisory_xact_lock(${JOB_LOCK}) AS locked`);
      if (!locked) return;
      const [notified, { count }] = await Promise.all([periodEndingReminder(), cleanupRefreshTokens()]);
      if (notified || count) logger.info({ notified, tokensRemoved: count }, 'job terjadwal selesai');
    }, { timeout: 60_000 });
  } catch (err) {
    logger.error({ err }, 'job terjadwal gagal');
  }
}

/**
 * ponytail: interval dalam proses (tiap jam, idempoten) menggantikan cron 08:00/02:00 di ARCHITECTURE §4.8;
 * pindah ke cron/scheduler eksternal bila jam kirim harus tepat.
 */
export function startJobs() {
  void runJobs();
  return setInterval(runJobs, 60 * 60 * 1000).unref();
}
