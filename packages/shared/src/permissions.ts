import type { Role } from './enums';

/** Matriks izin PRD §3. Dipakai `requireRole` di API dan guard/nav di web. */
export const permissions = {
  manageUsers: ['SUPER_ADMIN'],
  manageMasterData: ['SUPER_ADMIN'],
  viewClients: ['SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE', 'VIEWER'],
  manageClients: ['SUPER_ADMIN', 'ADMIN_SALES'],
  editMo: ['SUPER_ADMIN', 'ADMIN_SALES'],
  submitMo: ['SUPER_ADMIN', 'ADMIN_SALES'],
  cancelMo: ['SUPER_ADMIN', 'ADMIN_SALES'],
  downloadMoPdf: ['SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE', 'VIEWER'],
  managePublications: ['SUPER_ADMIN', 'ADMIN_SALES'],
  viewMo: ['SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE', 'VIEWER'],
  manageBilling: ['SUPER_ADMIN', 'FINANCE'],
  export: ['SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE'],
  viewFinanceDashboard: ['SUPER_ADMIN', 'FINANCE', 'VIEWER'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof permissions;

export const can = (role: Role, permission: Permission): boolean =>
  (permissions[permission] as readonly Role[]).includes(role);
