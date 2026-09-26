import { z } from 'zod';
import { billingStatus, moStatus } from '../enums';
import { optionalText } from './common';
import { rupiahString } from './media-order';

const month = z.string().regex(/^\d{4}-\d{2}$/, 'Bulan tidak valid');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndefined, s.optional());

/** FR-FIN-01: filter Daftar MO; dipakai juga ekspor (ARCHITECTURE §4.7). Bulan `YYYY-MM`. */
export const moListQuery = z.object({
  dateField: z.enum(['mo_date', 'period']).default('mo_date'),
  from: opt(month),
  to: opt(month),
  clientId: opt(z.string().uuid()),
  salesId: opt(z.string().uuid()),
  status: opt(z.enum(moStatus)),
  billingStatus: opt(z.enum(billingStatus)),
  fulfillment: opt(z.enum(['none', 'partial', 'full'])),
  q: opt(z.string().trim().max(100)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type MoListQuery = z.input<typeof moListQuery>;

export const exportQuery = moListQuery.extend({ format: z.enum(['xlsx', 'csv']).default('xlsx') });

/** FR-FIN-05: tandai BILLED. Alasan wajib bila benefit belum 100% (dicek server). */
export const billingCreateSchema = z.object({
  invoiceNo: z.string().trim().min(1, 'No. invoice wajib diisi').max(100),
  invoiceDate: date,
  amount: rupiahString.refine((v) => BigInt(v) > 0n, 'Nominal harus lebih dari 0'),
  overrideReason: optionalText(500),
  notes: optionalText(500),
});

/** FR-FIN-05: catat pembayaran pada satu tagihan. */
export const billingPaySchema = z.object({
  paidDate: date,
  paidAmount: rupiahString.refine((v) => BigInt(v) > 0n, 'Nominal harus lebih dari 0'),
  receiptNo: optionalText(100),
});

export const dashboardQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
