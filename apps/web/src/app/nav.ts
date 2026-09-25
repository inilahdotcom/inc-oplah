import { can, type Permission, type Role } from '@inc/shared'

export interface NavItem {
  to: string
  label: string
  permission: Permission
}

// Menu mengikuti README desain "Global layout"; ditampilkan sesuai permissions (PRD §3).
const items: NavItem[] = [
  { to: '/', label: 'Dashboard', permission: 'viewFinanceDashboard' },
  { to: '/mo', label: 'Daftar MO', permission: 'viewMo' },
  { to: '/mo/baru', label: 'Buat MO', permission: 'editMo' },
  { to: '/klien', label: 'Klien', permission: 'viewClients' },
  { to: '/pengaturan', label: 'Master data', permission: 'manageMasterData' },
]

export const navFor = (role: Role) => items.filter((i) => can(role, i.permission))
