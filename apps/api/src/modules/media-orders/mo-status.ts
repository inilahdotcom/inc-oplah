import { Prisma, type MoStatus } from '@prisma/client';
import { moStatusLabel } from '@inc/shared';
import { AppError } from '../../lib/app-error';

// Transisi status MO (PRD §4, ARCHITECTURE §4.3). Semua perubahan kolom `status` lewat `assertTransition`.
const transitions: Record<MoStatus, MoStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ACTIVE'], // realisasi dihapus sebelum ditagih
  CANCELLED: [],
};

export function assertTransition(from: MoStatus, to: MoStatus) {
  if (!transitions[from].includes(to)) {
    throw new AppError('INVALID_STATUS', `MO berstatus ${moStatusLabel[from]} tidak bisa menjadi ${moStatusLabel[to]}`, 409);
  }
}

/** Kunci baris MO sampai transaksi selesai; mencegah edit/submit/batal/realisasi bersamaan. 404 bila bukan milik org. */
export async function lockMo(tx: Prisma.TransactionClient, orgId: string, id: string): Promise<MoStatus> {
  const rows = await tx.$queryRaw<{ status: MoStatus }[]>(
    Prisma.sql`SELECT status FROM media_orders WHERE id = ${id}::uuid AND organization_id = ${orgId}::uuid FOR UPDATE`,
  );
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Media Order tidak ditemukan', 404);
  return rows[0].status;
}
