const TZ = 'Asia/Jakarta';

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

/** "3174000000005678" → "************5678" */
export const maskNik = (nik: string) => nik.slice(-4).padStart(nik.length, '*');
