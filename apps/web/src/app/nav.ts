import { FilePlus2, FileText, LayoutDashboard, Settings, Users, type LucideIcon } from 'lucide-react'
import { can, type Permission, type Role } from '@inc/shared'

export interface NavItem {
  to: string
  label: string
  permission: Permission
  icon: LucideIcon
}

// Menu mengikuti README desain "Global layout"; ditampilkan sesuai permissions (PRD §3).
const items: NavItem[] = [
  { to: '/', label: 'Dashboard', permission: 'viewFinanceDashboard', icon: LayoutDashboard },
  { to: '/mo', label: 'Daftar MO', permission: 'viewMo', icon: FileText },
  { to: '/mo/baru', label: 'Buat MO', permission: 'editMo', icon: FilePlus2 },
  { to: '/klien', label: 'Klien', permission: 'viewClients', icon: Users },
  { to: '/pengaturan', label: 'Master data', permission: 'manageMasterData', icon: Settings },
]

export const navFor = (role: Role) => items.filter((i) => can(role, i.permission))
