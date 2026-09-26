import { z } from 'zod';
import { paymentMethod } from '../enums';
import { clientSchema } from './client';
import { optionalText } from './common';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');
const codes = z.array(z.string().max(40)).max(50).default([]);
const lines = (s: string | null) => (s ? s.split('\n').length : 0);

/** Nominal Rupiah penuh sebagai string (AGENT.md §3: tanpa float). */
export const rupiahString = z.string().trim().regex(/^\d{1,15}$/, 'Nominal berupa angka Rupiah tanpa titik');

// Snapshot klien (DATABASE.md §5). Draft boleh kosong; saat submit divalidasi dengan aturan klien.
const clientSnapshotDraft = z.object({
  picName: optionalText(200),
  companyName: optionalText(200),
  nik: optionalText(50),
  address: optionalText(),
  city: optionalText(100),
  postalCode: optionalText(50),
  email: optionalText(200),
  phone: optionalText(30),
});
const clientSnapshotSubmit = clientSchema.pick({ picName: true, companyName: true, nik: true, address: true, city: true, postalCode: true, email: true, phone: true });

/** Draft: wajib hanya kolom NOT NULL di DB; validasi lengkap saat submit (FR-MO-07). */
export const moDraftSchema = z
  .object({
    moDate: date,
    clientId: z.string({ required_error: 'Pilih klien' }).uuid('Pilih klien'),
    salesId: z.string({ required_error: 'Pilih sales' }).uuid('Pilih sales'),
    clientSnapshot: clientSnapshotDraft,
    periodStart: date,
    periodEnd: date,
    description: optionalText(200),
    airingDateText: optionalText(200),
    selectedOptions: z.object({ AD_TYPE: codes, COOP_TYPE: codes, PLACEMENT: codes, AD_LOCATION: codes }),
    benefits: z
      .array(
        z.object({
          benefitTypeId: z.string().uuid('Pilih jenis benefit'),
          targetQty: z.coerce.number().int('Kuantitas bilangan bulat').min(1, 'Minimal 1').max(100_000),
          notes: optionalText(200),
        }),
      )
      .max(30)
      .default([]),
    cooperationDetail: optionalText(1000),
    termsConditions: optionalText(3000),
    paymentMethod: z.enum(paymentMethod).default('TRANSFER'),
    chequeNo: optionalText(100),
    receiptNo: optionalText(100),
    dueDateText: optionalText(100),
    adProduct: optionalText(200),
    subtotal: rupiahString.default('0'),
    isTaxable: z.boolean().default(true),
    acknowledgedById: z.string().uuid().nullish(),
    approvedById: z.string().uuid().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.periodEnd < v.periodStart) ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Akhir periode sebelum awal periode' });
    // Unik per MO di DB (mo_benefits), jadi dicek sejak draft.
    const types = v.benefits.map((b) => b.benefitTypeId);
    types.forEach((t, i) => {
      if (types.indexOf(t) !== i) ctx.addIssue({ code: 'custom', path: ['benefits', i, 'benefitTypeId'], message: 'Jenis benefit tidak boleh ganda' });
    });
  });
export type MoDraftInput = z.input<typeof moDraftSchema>;
export type MoDraft = z.output<typeof moDraftSchema>;

/** Aturan submit (prototipe desain: validate()). Dijalankan backend terhadap data draft tersimpan. */
export const moSubmitSchema = moDraftSchema.superRefine((v, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  const client = clientSnapshotSubmit.safeParse(v.clientSnapshot);
  if (!client.success) client.error.issues.forEach((i) => issue(['clientSnapshot', ...i.path], i.message));
  if (!v.description) issue(['description'], 'Keterangan wajib diisi');
  if (v.benefits.length === 0) issue(['benefits'], 'Minimal 1 benefit dengan kuantitas ≥ 1');
  if (!v.cooperationDetail) issue(['cooperationDetail'], 'Detail kerjasama wajib diisi');
  if (lines(v.cooperationDetail) > 4) issue(['cooperationDetail'], 'Detail kerjasama maksimal 4 baris');
  if (lines(v.termsConditions) > 10) issue(['termsConditions'], 'Term and Conditions maksimal 10 baris');
  if (v.paymentMethod === 'CHEQUE_BG' && !v.chequeNo) issue(['chequeNo'], 'No. Cek/BG wajib diisi');
  if (BigInt(v.subtotal) <= 0n) issue(['subtotal'], 'Subtotal harus lebih dari 0');
});

export const calculateSchema = z.object({ subtotal: rupiahString, isTaxable: z.boolean().default(true) });

export const cancelMoSchema = z.object({ reason: z.string().trim().min(1, 'Alasan wajib diisi').max(500) });
