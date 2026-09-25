import { can, type Permission } from '@inc/shared'
import { useCurrentUser } from '@/lib/auth-store'

/** Tampilkan children hanya bila role user punya izin. Hanya UX; otorisasi tetap di backend. */
export function RoleGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  return can(useCurrentUser().role, permission) ? <>{children}</> : null
}
