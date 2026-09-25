import type { AuditAction, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { currentUser } from '../middleware/authenticate';

type Tx = Prisma.TransactionClient;

// JSON aman untuk kolom JSONB (Date → ISO string, Decimal → string).
const toJson = (v: unknown) => (v == null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));

/** Catat mutasi ke audit_logs (FR-AUD-01). Dipanggil di dalam transaksi yang sama dengan mutasinya. */
export function writeAudit(
  tx: Tx,
  req: Request,
  entry: { entity: string; entityId: string; action: AuditAction; before?: unknown; after?: unknown },
) {
  const user = currentUser(req);
  return tx.auditLog.create({
    data: {
      organizationId: user.orgId,
      userId: user.sub,
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: toJson(entry.before),
      after: toJson(entry.after),
      ip: req.ip,
    },
  });
}
