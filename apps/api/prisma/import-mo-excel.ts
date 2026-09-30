/**
 * Import satu kali "MEDIA ORDER REPORT - DEPT. MARKETING - <tahun>.xlsx" ke tabel clients, sales, media_orders, mo_benefits.
 * Idempoten: MO di-upsert berdasarkan mo_number, klien/sales dicari dulu sebelum dibuat.
 *
 *   DATABASE_URL=... tsx prisma/import-mo-excel.ts "<file.xlsx>" [--dry-run]
 */
import ExcelJS from 'exceljs';
import { PrismaClient, type MoStatus } from '@prisma/client';

const prisma = new PrismaClient();
const ORG_ID = '00000000-0000-4000-8000-000000000001';
const SIG_ACK_ID = '00000000-0000-4000-8000-000000000011';
const SIG_APPROVE_ID = '00000000-0000-4000-8000-000000000012';
const BENEFIT_CODES = ['ARTIKEL_RILIS', 'INSTAGRAM', 'INSTAGRAM_STORY', 'TIKTOK', 'FACEBOOK', 'X', 'VIDEOTORIAL_WEBSITE'];

// Nama sales di Excel (lowercase) → master sales. Kode diambil dari kode yang paling sering dipakai di nomor MO.
const SALES_ALIASES: Record<string, { name: string; code: string }> = {
  bimo: { name: 'Bimo', code: 'BMO' },
  cinta: { name: 'Cinta', code: 'RR' },
  cbo: { name: 'CBO', code: 'CBO' },
  'sukarya wiguna': { name: 'Sukarya Wiguna', code: 'SKW' },
  iskandar: { name: 'Iskandar', code: 'IS' },
  'iwan p dan iskandar': { name: 'Iskandar', code: 'IS' },
  addo: { name: 'Addo', code: 'AL' },
  'iwan purwantono': { name: 'Iwan Purwantono', code: 'IP' },
  'iwan.p': { name: 'Iwan Purwantono', code: 'IP' },
  'm. ibnu naufal': { name: 'M. Ibnu Naufal', code: 'IBN' },
  ibnu: { name: 'M. Ibnu Naufal', code: 'IBN' },
  it: { name: 'IT', code: 'IT' },
  farah: { name: 'Farah', code: 'FM' },
  nebby: { name: 'Nebby', code: 'NBY' },
  'sri ernawati': { name: 'Sri Ernawati', code: 'E' },
  tyas: { name: 'Tyas', code: 'TYS' },
  indira: { name: 'Indira', code: 'IL' },
  'rana setiawan': { name: 'Rana Setiawan', code: 'RNS' },
  'ali. f': { name: 'Ali F', code: 'AF' },
  ratu: { name: 'Ratu', code: 'RTU' },
  chaterine: { name: 'Chaterine', code: 'CAT' },
  tommy: { name: 'Tommy', code: 'TMY' },
  'mia umi kartikawati': { name: 'Mia Umi Kartikawati', code: 'MUK' },
  rebby: { name: 'Rebby', code: 'RBN' },
  joel: { name: 'Joel', code: 'JLK' },
  wulandari: { name: 'Wulandari', code: 'WLN' },
};

// Kunci nama klien ternormalisasi (lihat clientKey) → nama kanonik. Beda huruf/spasi/tanda baca sudah tergabung otomatis.
const CLIENT_ALIASES: Record<string, string> = {
  'dompet duafa': 'Dompet Dhuafa',
  kemensos: 'Kementerian Sosial RI',
  'perusahaan listrik negara': 'PLN',
  bulog: 'Perum Bulog',
  'jogya website': 'Jogja Website',
  'yogya website': 'Jogja Website',
  angkasa: 'PT Angkasa Digital Nusantara',
  'angkasa digital': 'PT Angkasa Digital Nusantara',
  'pt angkasa digital': 'PT Angkasa Digital Nusantara',
  dais: 'Dais Digital Media',
  toprank: 'Toprank Digital Indonesia',
  'insight invest management': 'Insight Investments Management',
  'pt pertamina patra niaga': 'Pertamina Patra Niaga',
  'pt doran sukses indonesia jete': 'PT Doran Sukses Indonesia',
  'pt goto gojek tokopedia tbk': 'PT GoTo Tokopedia Tbk',
  goto: 'PT GoTo Tokopedia Tbk',
  'goto group': 'PT GoTo Tokopedia Tbk',
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
const MONTH_EN: Record<string, number> = { may: 4, aug: 7, ags: 7, oct: 9, dec: 11 };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const clientKey = (s: string) =>
  clean(s.toLowerCase().replace(/[^a-z0-9+]+/g, ' '));
const monthOf = (word: string) => {
  const p = word.toLowerCase().slice(0, 3);
  const i = MONTHS.indexOf(p);
  return i >= 0 ? i : (MONTH_EN[p] ?? -1);
};
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const fixYear = (y: string | undefined) => (y ? (y.length === 2 ? 2000 + +y : +y) : undefined);

/** Token tanggal "[hari] bulan [tahun]" dalam teks bebas. */
function dateTokens(text: string) {
  const out: { day?: number; month: number; year?: number }[] = [];
  for (const m of text.matchAll(/(\d{1,2})?\s*([A-Za-z]{3,})\s*(\d{4}|\d{2}(?!\d))?/g)) {
    const month = monthOf(m[2]);
    if (month >= 0) out.push({ day: m[1] ? +m[1] : undefined, month, year: fixYear(m[3]) });
  }
  return out;
}

/** "Januari - April", "13 Jan 2026 - 13 Feb 2026", "Maret 2026 - Maret 2027", "Feb - Des", "Mei Juni". */
function parsePeriod(text: string, defYear: number): { start: Date; end: Date } | null {
  const t = dateTokens(text);
  if (!t.length) return null;
  const a = t[0], b = t[t.length - 1];
  const ys = a.year ?? (b.year && b.month < a.month ? b.year - 1 : b.year) ?? defYear;
  let ye = b.year ?? ys;
  if (!b.year && b.month < a.month) ye++;
  return {
    start: utc(ys, a.month, a.day ?? 1),
    end: utc(ye, b.month, t.length > 1 && b.day ? b.day : lastDay(ye, b.month)),
  };
}

/** "01 Mei", "11 Juni 26", "1 Juli 2026" atau Date dari sel. */
function parseMoDate(v: unknown, defYear: number): Date | null {
  if (v instanceof Date) return utc(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
  if (typeof v !== 'string') return null;
  const [t] = dateTokens(v);
  return t ? utc(t.year ?? defYear, t.month, t.day ?? 1) : null;
}

/** Nilai sel exceljs → primitif (formula → result, rich text → teks). */
function val(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return val(v.result as ExcelJS.CellValue);
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
}
const num = (v: unknown) => (typeof v === 'number' ? v : null);
const str = (v: unknown) => (v == null ? '' : clean(String(v)));
const money = (n: number) => n.toFixed(2);

interface Row {
  sheet: string;
  line: number;
  moNumber: string | null;
  seq?: number;
  year: number;
  moDate: Date;
  periodText: string;
  period: { start: Date; end: Date };
  company: string;
  salesName: string;
  subtotal: number;
  ppn: number;
  total: number;
  benefits: { code: string; qty: number }[];
  description: string | null;
  status: MoStatus;
  coop: string[];
}

async function readRows(file: string, warn: (m: string) => void): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const rows: Row[] = [];
  for (const ws of wb.worksheets) {
    if (monthOf(ws.name) < 0) continue; // Summary dll.
    const header = ws.getRow(5);
    let benefitCol = 0;
    // Sel merge mengembalikan nilai yang sama di setiap kolom → ambil kolom pertama.
    header.eachCell((c, i) => { if (!benefitCol && /benefit/i.test(str(val(c.value)))) benefitCol = i; });
    if (!benefitCol) throw new Error(`Sheet ${ws.name}: kolom Benefit tidak ditemukan`);
    const categoryCol = benefitCol > 10 ? 10 : 0; // sheet Mei: kolom J berisi kategori brand/gov

    ws.eachRow((r, line) => {
      if (line < 7) return;
      const c = (i: number) => val(r.getCell(i).value);
      if (typeof c(1) !== 'number' || !str(c(5))) return;
      const where = `${ws.name}!${line}`;

      const moNumber = str(c(2)) || null;
      const year = +(moNumber?.match(/(\d{4})$/)?.[1] ?? 2026);
      const roman = moNumber?.match(/\/([IVX]+)\/\d{4}$/)?.[1];
      const seqStr = moNumber?.match(/^(\d+)/)?.[1];
      const cells = [...Array(benefitCol + 9).keys()].map((i) => str(c(i + 1))).join(' | ');
      const cancelled = /\b(batal|cancel)\b/i.test(cells);
      const fullBarter = /full barter/i.test([c(7), c(8), c(9)].map(str).join(' '));

      let moDate = parseMoDate(c(3), year);
      if (!moDate) {
        moDate = utc(year, roman ? ROMAN.indexOf(roman) : 0, 1);
        warn(`${where} ${moNumber}: Tanggal MO kosong → ${moDate.toISOString().slice(0, 10)}`);
      }
      const periodText = str(c(4));
      let period = parsePeriod(periodText, year);
      if (!period) {
        period = { start: moDate, end: moDate };
        warn(`${where} ${moNumber}: Periode "${periodText}" tidak terbaca → tanggal MO`);
      }

      // Nama perusahaan multi-baris (Artotel): baris pertama nama, sisanya keterangan.
      const [companyRaw, ...companyNote] = String(c(5)).split('\n');
      const subtotal = num(c(7)) ?? 0;
      let ppn = num(c(8));
      let total = num(c(9));
      if (fullBarter || cancelled) { ppn ??= 0; total ??= subtotal + ppn; }
      if (total == null) {
        ppn ??= Math.round(subtotal * 0.11);
        total = subtotal + ppn;
        warn(`${where} ${moNumber}: PPN/Total kosong → dihitung 11% (${money(ppn)} / ${money(total)})`);
      }
      ppn ??= total - subtotal;
      if (Math.abs(subtotal + ppn - total) > 1) warn(`${where} ${moNumber}: subtotal + PPN ≠ total (${subtotal} + ${ppn} ≠ ${total})`);

      const benefits = BENEFIT_CODES.flatMap((code, i) => {
        const q = num(c(benefitCol + i));
        return q && q > 0 ? [{ code, qty: Math.round(q) }] : [];
      });
      const notes = [
        categoryCol ? str(c(categoryCol)) && `Kategori: ${str(c(categoryCol))}` : '',
        str(c(benefitCol + 7)),
        clean(companyNote.join(' ')),
      ].filter(Boolean);

      rows.push({
        sheet: ws.name,
        line,
        moNumber,
        seq: seqStr ? +seqStr : undefined,
        year,
        moDate,
        periodText,
        period,
        company: clean(companyRaw),
        salesName: str(c(6)),
        subtotal,
        ppn,
        total,
        benefits,
        description: notes.join('\n') || null,
        status: cancelled ? 'CANCELLED' : moNumber ? 'ACTIVE' : 'DRAFT',
        coop: fullBarter ? ['FULL_BARTER'] : /barter/i.test(String(c(5))) ? ['SEMI_BARTER'] : [],
      });
    });
  }
  return rows;
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error('Pakai: tsx prisma/import-mo-excel.ts <file.xlsx> [--dry-run]');
  const dryRun = flag === '--dry-run';
  const warnings: string[] = [];
  const rows = await readRows(file, (m) => warnings.push(m));

  const unknownSales = [...new Set(rows.map((r) => r.salesName.toLowerCase()).filter((s) => !SALES_ALIASES[s]))];
  if (unknownSales.length) throw new Error(`Nama sales belum dipetakan di SALES_ALIASES: ${unknownSales.join(', ')}`);

  // mo_seq hanya diisi bila unik dalam setahun (Excel punya nomor urut ganda, mis. 118/MO-CBO & 118/MO-RR).
  const seqCount = new Map<string, number>();
  for (const r of rows) if (r.moNumber && r.seq) seqCount.set(`${r.year}-${r.seq}`, (seqCount.get(`${r.year}-${r.seq}`) ?? 0) + 1);
  for (const [k, n] of seqCount) if (n > 1) warnings.push(`Nomor urut ${k} dipakai ${n} MO → mo_seq dikosongkan`);
  // Nomor urut yang sudah dipakai MO lain di DB (bukan dari Excel ini) juga tidak boleh diisi ulang.
  const excelNumbers = rows.flatMap((r) => (r.moNumber ? [r.moNumber] : []));
  for (const m of await prisma.mediaOrder.findMany({
    where: { organizationId: ORG_ID, moSeq: { not: null }, OR: [{ moNumber: null }, { moNumber: { notIn: excelNumbers } }] },
    select: { moYear: true, moSeq: true, moNumber: true },
  })) {
    const k = `${m.moYear}-${m.moSeq}`;
    if (seqCount.get(k) === 1) warnings.push(`Nomor urut ${k} sudah dipakai ${m.moNumber} di DB → mo_seq dikosongkan`);
    if (seqCount.has(k)) seqCount.set(k, Infinity);
  }

  const superadmin = await prisma.user.findUniqueOrThrow({
    where: { organizationId_email: { organizationId: ORG_ID, email: 'superadmin@inilah.local' } },
  });
  const benefitTypes = await prisma.benefitType.findMany({ where: { organizationId: ORG_ID } });
  const benefitId = Object.fromEntries(benefitTypes.map((b) => [b.code, b.id]));

  const stats = { clientsCreated: [] as string[], salesCreated: [] as string[], moCreated: 0, moUpdated: 0 };
  const merged = new Map<string, Set<string>>();

  try {
    await prisma.$transaction(
      async (tx) => {
        // Sales
        const salesId: Record<string, string> = {};
        for (const { name, code } of Object.values(SALES_ALIASES)) {
          if (salesId[code]) continue;
          const existing = await tx.sales.findUnique({ where: { organizationId_code: { organizationId: ORG_ID, code } } });
          if (!existing) stats.salesCreated.push(`${name} (${code})`);
          salesId[code] = (existing ?? (await tx.sales.create({ data: { organizationId: ORG_ID, name, code } }))).id;
        }

        // Klien: cocokkan dengan klien yang sudah ada berdasarkan kunci ternormalisasi.
        const existingClients = await tx.client.findMany({ where: { organizationId: ORG_ID, deletedAt: null } });
        const clientByKey = new Map(existingClients.map((c) => [clientKey(c.companyName), c]));
        const clientOf = async (company: string) => {
          const canonical = CLIENT_ALIASES[clientKey(company)] ?? company;
          const key = clientKey(canonical);
          merged.set(canonical, (merged.get(canonical) ?? new Set()).add(company));
          let c = clientByKey.get(key);
          if (!c) {
            c = await tx.client.create({ data: { organizationId: ORG_ID, companyName: canonical, picName: '-', createdBy: superadmin.id } });
            clientByKey.set(key, c);
            stats.clientsCreated.push(canonical);
          }
          return c;
        };

        for (const r of rows) {
          const client = await clientOf(r.company);
          const sales = SALES_ALIASES[r.salesName.toLowerCase()];
          const uniqueSeq = r.moNumber && r.seq && seqCount.get(`${r.year}-${r.seq}`) === 1;
          const data = {
            organizationId: ORG_ID,
            moNumber: r.moNumber,
            moSeq: uniqueSeq ? r.seq : null,
            moYear: r.moNumber ? r.year : null,
            moDate: r.moDate,
            clientId: client.id,
            clientSnapshot: {
              picName: client.picName, companyName: client.companyName, nik: client.nik, npwp: client.npwp,
              address: client.address, city: client.city, postalCode: client.postalCode, email: client.email, phone: client.phone,
            },
            salesId: salesId[sales.code],
            periodStart: r.period.start,
            periodEnd: r.period.end,
            airingDateText: r.periodText || null,
            description: r.description,
            selectedOptions: { AD_TYPE: [], COOP_TYPE: r.coop, PLACEMENT: [], AD_LOCATION: [] },
            isTaxable: r.ppn > 0,
            subtotal: money(r.subtotal),
            dppAmount: money(r.ppn > 0 ? Math.round((r.subtotal * 11) / 12) : 0),
            ppnAmount: money(r.ppn),
            totalAmount: money(r.total),
            acknowledgedById: SIG_ACK_ID,
            approvedById: SIG_APPROVE_ID,
            status: r.status,
            billingStatus: 'NOT_READY' as const,
            cancelReason: r.status === 'CANCELLED' ? 'Batal (import Excel)' : null,
            cancelledAt: r.status === 'CANCELLED' ? new Date() : null,
            submittedAt: r.status === 'DRAFT' ? null : new Date(),
            submittedBy: r.status === 'DRAFT' ? null : superadmin.id,
            createdBy: superadmin.id,
          };

          const existing = r.moNumber
            ? await tx.mediaOrder.findUnique({ where: { organizationId_moNumber: { organizationId: ORG_ID, moNumber: r.moNumber } } })
            : await tx.mediaOrder.findFirst({
                where: { organizationId: ORG_ID, moNumber: null, clientId: client.id, salesId: data.salesId, moDate: r.moDate, subtotal: data.subtotal },
              });
          const { cancelledAt, submittedAt, ...updateData } = data; // pertahankan timestamp run pertama
          const mo = existing
            ? await tx.mediaOrder.update({ where: { id: existing.id }, data: updateData })
            : await tx.mediaOrder.create({ data });
          existing ? stats.moUpdated++ : stats.moCreated++;

          await tx.moBenefit.deleteMany({ where: { mediaOrderId: mo.id } });
          if (r.benefits.length)
            await tx.moBenefit.createMany({
              data: r.benefits.map((b, i) => ({ mediaOrderId: mo.id, benefitTypeId: benefitId[b.code], targetQty: b.qty, sortOrder: i })),
            });
        }

        // Pastikan nomor otomatis berikutnya tidak bertabrakan dengan nomor dari Excel.
        const maxSeq = new Map<number, number>();
        for (const r of rows) if (r.moNumber && r.seq) maxSeq.set(r.year, Math.max(maxSeq.get(r.year) ?? 0, r.seq));
        for (const [year, seq] of maxSeq)
          await tx.$executeRaw`
            INSERT INTO mo_sequences (organization_id, year, last_seq) VALUES (${ORG_ID}::uuid, ${year}, ${seq})
            ON CONFLICT (organization_id, year) DO UPDATE SET last_seq = GREATEST(mo_sequences.last_seq, EXCLUDED.last_seq)`;

        if (dryRun) throw new DryRun();
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }

  // Laporan
  const bySheet = new Map<string, { n: number; sub: number; total: number }>();
  for (const r of rows) {
    const s = bySheet.get(r.sheet) ?? { n: 0, sub: 0, total: 0 };
    bySheet.set(r.sheet, { n: s.n + 1, sub: s.sub + r.subtotal, total: s.total + r.total });
  }
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  console.log(`\n${dryRun ? '[DRY RUN — di-rollback] ' : ''}${rows.length} baris dibaca`);
  console.table([...bySheet].map(([sheet, s]) => ({ sheet, baris: s.n, 'sebelum PPN': fmt(s.sub), 'setelah PPN': fmt(s.total) })));
  console.log('Status:', Object.fromEntries(['ACTIVE', 'DRAFT', 'CANCELLED'].map((s) => [s, rows.filter((r) => r.status === s).length])));
  console.log(`MO dibuat: ${stats.moCreated}, diperbarui: ${stats.moUpdated}`);
  console.log(`Sales baru (${stats.salesCreated.length}): ${stats.salesCreated.join(', ')}`);
  console.log(`Klien baru (${stats.clientsCreated.length})`);
  console.log('\nKlien yang digabung dari beberapa ejaan:');
  for (const [name, variants] of merged) if (variants.size > 1 || !variants.has(name)) console.log(`  ${name} ← ${[...variants].join(' | ')}`);
  console.log(`\nPeringatan (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

class DryRun extends Error {}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
