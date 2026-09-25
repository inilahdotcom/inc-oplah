export const roles = ['SUPER_ADMIN', 'ADMIN_SALES', 'FINANCE', 'VIEWER'] as const;
export type Role = (typeof roles)[number];

export const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_SALES: 'Admin Sales',
  FINANCE: 'Finance',
  VIEWER: 'Viewer',
};

export const moStatus = ['DRAFT', 'SUBMITTED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type MoStatus = (typeof moStatus)[number];

export const billingStatus = ['NOT_READY', 'READY_TO_BILL', 'BILLED', 'PAID'] as const;
export type BillingStatus = (typeof billingStatus)[number];

export const paymentMethod = ['TRANSFER', 'CHEQUE_BG'] as const;
export type PaymentMethod = (typeof paymentMethod)[number];

export const signatoryRole = ['ACKNOWLEDGED_BY', 'APPROVED_BY'] as const;
export type SignatoryRole = (typeof signatoryRole)[number];
export const signatoryRoleLabel: Record<SignatoryRole, string> = {
  ACKNOWLEDGED_BY: 'Diketahui oleh',
  APPROVED_BY: 'Disetujui oleh',
};

export const formOptionGroup = ['AD_TYPE', 'COOP_TYPE', 'PLACEMENT', 'AD_LOCATION'] as const;
export type FormOptionGroup = (typeof formOptionGroup)[number];
export const formOptionGroupLabel: Record<FormOptionGroup, string> = {
  AD_TYPE: 'Jenis iklan',
  COOP_TYPE: 'Bentuk kerjasama',
  PLACEMENT: 'Penempatan iklan',
  AD_LOCATION: 'Lokasi iklan',
};

export const moStatusLabel: Record<MoStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Terbit',
  ACTIVE: 'Berjalan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const billingStatusLabel: Record<BillingStatus, string> = {
  NOT_READY: 'Belum siap',
  READY_TO_BILL: 'Siap ditagih',
  BILLED: 'Sudah ditagih',
  PAID: 'Lunas',
};
