export const TZ = 'Asia/Jakarta';

const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const tanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });

/** "20000000.00" | 20000000 → "20.000.000". Nominal dari API berupa string; tidak dihitung ulang di sini. */
export const formatRupiah = (value: string | number): string => {
  const [int] = String(value).split('.');
  return rupiah.format(BigInt(int));
};

/** "2026-05-22" | Date → "22 Mei 2026" */
export const formatTanggal = (value: string | Date): string =>
  tanggal.format(typeof value === 'string' && value.length === 10 ? new Date(`${value}T00:00:00+07:00`) : new Date(value));

/** Tanggal hari ini di Asia/Jakarta, `YYYY-MM-DD`. */
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

/** "3174000000005678" → "************5678" */
export const maskNik = (nik: string) => nik.slice(-4).padStart(nik.length, '*');

const bulan = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** "2026-06-01" → "Juni 2026" (tanggal tanpa jam, tidak digeser zona waktu). */
export const formatBulan = (date: string) => bulan.format(new Date(date.slice(0, 10)));

/** Masa periode MO: "Juni 2026 - Mei 2027". */
/** Periode akhir opsional: tanpa akhir hanya bulan awal. */
export const formatPeriode = (start: string, end?: string | null) => (end ? `${formatBulan(start)} - ${formatBulan(end)}` : formatBulan(start));

/** "2026-06" → ["2026-06-01", "2026-06-30"] (periode disimpan awal & akhir bulan). */
export const monthRange = (month: string): [string, string] => {
  const [y, m] = month.split('-').map(Number);
  return [`${month}-01`, `${month}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`];
};

/** PRD §5.5: `{SEQ}` / `{SEQ:3}`, `{SALES_CODE}`, `{MONTH_ROMAN}`, `{YEAR}` dari Tanggal MO. */
export const formatMoNumber = (template: string, v: { seq: number; pad?: number; salesCode: string; moDate: string }) => {
  const [year, month] = v.moDate.split('-');
  return template
    .replace(/\{SEQ(?::(\d+))?\}/g, (_, pad?: string) => String(v.seq).padStart(Number(pad ?? v.pad ?? 3), '0'))
    .replaceAll('{SALES_CODE}', v.salesCode)
    .replaceAll('{MONTH_ROMAN}', ROMAN[Number(month) - 1])
    .replaceAll('{YEAR}', year);
};

/** PRD §8: `MO_{nomor-strip}_{PERUSAHAAN}_{Periode}.pdf`. Isi kurung dibuang dari nama perusahaan. */
export const moPdfFileName = (mo: { moNumber: string | null; companyName: string; periodStart: string; periodEnd: string | null }) => {
  const slug = (s: string) => s.replace(/\(.*?\)/g, '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const period = formatPeriode(mo.periodStart, mo.periodEnd).replaceAll(' - ', '-').replaceAll(' ', '_');
  return `MO_${(mo.moNumber ?? 'DRAFT').replaceAll('/', '-')}_${slug(mo.companyName).toUpperCase()}_${period}.pdf`;
};

const bulanPendek = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' });
/** Kolom Periode Tayang daftar MO (PRD §5.8): "Jun 2026 – Mei 2027". */
export const formatPeriodeSingkat = (start: string, end?: string | null) => {
  const f = (d: string) => bulanPendek.format(new Date(d.slice(0, 10)));
  return end ? `${f(start)} – ${f(end)}` : f(start);
};
