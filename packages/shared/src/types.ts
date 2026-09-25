import type { BillingStatus, FormOptionGroup, MoStatus, Role, SignatoryRole } from './enums';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  salesId: string | null;
  organizationName: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { field: string; message: string }[] };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ClientDto {
  id: string;
  companyName: string;
  picName: string;
  email: string | null;
  phone: string | null;
  nik: string | null; // dimasking untuk role tanpa izin manageClients
  npwp: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientListItem extends ClientDto {
  moCount: number;
}

export interface ClientMoHistoryItem {
  id: string;
  moNumber: string | null;
  moDate: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  status: MoStatus;
  billingStatus: BillingStatus;
}

export interface ClientDetailDto extends ClientDto {
  mediaOrders: ClientMoHistoryItem[];
}

export interface SalesDto {
  id: string;
  name: string;
  code: string;
  email: string | null;
  title: string;
  isActive: boolean;
  moCount: number;
  signatureUrl: string | null;
}

export interface SignatoryDto {
  id: string;
  name: string;
  title: string;
  docRole: SignatoryRole;
  isDefault: boolean;
  isActive: boolean;
  signatureUrl: string | null;
  stampUrl: string | null;
}

export interface BenefitTypeDto {
  id: string;
  code: string;
  name: string;
  pdfLabel: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FormOptionDto {
  id: string;
  group: FormOptionGroup;
  code: string;
  label: string;
  parentCode: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SettingsDto {
  company: { name: string; address: string; bankName: string; bankAccountNo: string; bankAccountName: string };
  tax: { ppnRate: string; dppNum: number; dppDen: number; rounding?: string };
  numbering: { template: string; seqPad?: number };
  termsTemplates: { name: string; body: string }[];
  nextSeq: { year: number; seq: number };
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  salesId: string | null;
  lastLoginAt: string | null;
  sales: { name: string; code: string } | null;
}
