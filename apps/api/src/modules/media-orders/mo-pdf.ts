import { readFileSync } from 'node:fs';
import { formatPeriode, formatRupiah, formatTanggal, type FormOptionGroup, type MediaOrderDto } from '@inc/shared';

export interface PdfOrg {
  name: string;
  address: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
}
export interface PdfOption {
  group: FormOptionGroup;
  code: string;
  label: string;
  parentCode: string | null;
}
/** Data URI gambar tanda tangan/stempel; hanya diisi untuk MO yang sudah submit. */
export type PdfImages = Partial<Record<'createdBy' | 'acknowledgedBy' | 'approvedBy' | 'stamp', string>>;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const box = (checked: boolean) => (checked ? '☑' : '☐');
const LOGO = `data:image/jpeg;base64,${readFileSync(new URL('./mo-logo.jpeg', import.meta.url)).toString('base64')}`;
/** Label kiri + nilai di atas garis titik-titik, seperti sel template xlsx. */
const row = (label: string, value: string, cls = '') => `<div class="row"><span class="k">${label}</span><span class="v ${cls}">${value}</span></div>`;
const ruled = (text: string | null, min: number) => {
  const lines = (text ?? '').split('\n');
  while (lines.length < min) lines.push('');
  return `<div class="ruled">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
};

/**
 * HTML cetak MO mengikuti template stakeholder `Draft MO 2026.xlsx` (sheet "Draft MO 2026").
 * Urutan section: header → nomor & tanggal → klien → periode → detail iklan → pembayaran → tanda tangan.
 */
export function moHtml(mo: MediaOrderDto, org: PdfOrg, options: PdfOption[], images: PdfImages): string {
  const c = mo.clientSnapshot;
  const picked = (g: FormOptionGroup) => new Set(mo.selectedOptions[g]);
  const opts = (g: FormOptionGroup, parentCode: string | null = null) =>
    options
      .filter((o) => o.group === g && o.parentCode === parentCode)
      .map((o) => `<span>${box(picked(g).has(o.code))} ${esc(o.label)}</span>`)
      .join('');
  const locations = options
    .filter((o) => o.group === 'AD_LOCATION' && !o.parentCode)
    .map((p) => {
      const children = opts('AD_LOCATION', p.code);
      return `<span>${box(picked('AD_LOCATION').has(p.code))} ${esc(p.label)}</span>${children ? `<div class="grid3">${children}</div>` : ''}`;
    })
    .join('');
  const signed = mo.status !== 'DRAFT';
  const signer = (label: string, s: MediaOrderDto['signatories']['createdBy'], img?: string, stamp?: string) => `
    <div class="sign">
      <span>${label}</span>
      <div class="sig">${signed && stamp ? `<img class="stamp" src="${stamp}">` : ''}${signed && img ? `<img src="${img}">` : ''}</div>
      <b>${esc(s?.name)}</b><span>${esc(s?.title)}</span>
    </div>`;
  const money = (label: string, value: string, suffix = '') =>
    `<div class="money"><span class="ml">${label}</span><span class="mv">${value}</span><span class="ms">${suffix}</span></div>`;
  // Pembayaran & subtotal opsional: yang tidak diisi tidak dicetak.
  const hasSubtotal = mo.subtotal !== '0';
  const hasCost = hasSubtotal || !!mo.adProduct;
  const watermark = mo.status === 'DRAFT' ? 'DRAFT' : mo.status === 'CANCELLED' ? 'DIBATALKAN' : '';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 12mm 6.35mm 12.7mm; }
* { box-sizing: border-box; }
body { margin: 0; font: 8.5pt/1.25 Arial, Helvetica, sans-serif; color: #000; }
.page { position: relative; }
header { display: grid; grid-template-columns: 17mm 1fr 1fr; background: #262626; color: #fff; height: 24mm; }
header .logo { background: #fff; display: flex; align-items: center; justify-content: center; height: 15mm; }
header .logo img { height: 14mm; }
header .org { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 6.5pt; font-weight: 700; line-height: 1.15; border-left: 0.2mm solid #3a3a3a; border-right: 0.2mm solid #3a3a3a; padding: 0 3mm; }
header .org b { font-size: 9pt; margin-bottom: 0.3mm; }
header h1 { margin: 0; align-self: center; text-align: center; font-size: 25pt; font-weight: 700; }
.rule { height: 2.8mm; background: #c00000; border: 0.2mm solid #262626; }
main { display: flex; flex-direction: column; gap: 2.2mm; margin-top: 2.2mm; }
section.box { border: 0.3mm solid #000; padding: 1.5mm 1mm; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8mm; }
.stack { display: flex; flex-direction: column; gap: 1.1mm; }
.row { display: flex; align-items: flex-end; gap: 1mm; }
.k { width: 36mm; flex: none; }
.v { flex: 1; min-height: 4.2mm; border-bottom: 0.3mm dotted #000; padding: 0 0.5mm; }
.cols .v { max-width: 55mm; }
.b { font-weight: 700; }
.opts { flex: 1; display: flex; flex-wrap: wrap; gap: 1mm 4mm; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8mm 3mm; padding: 0.8mm 0 0.8mm 4mm; }
.ul { font-size: 8pt; font-weight: 700; text-decoration: underline; width: 36mm; flex: none; text-align: center; }
.ruled { flex: 1; } .ruled div { border-bottom: 0.3mm dotted #000; min-height: 4.8mm; padding: 0.8mm 0.5mm 0; white-space: pre-wrap; }
.pay { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6mm 8mm; }
.money { display: grid; grid-template-columns: 28mm 34mm 6mm; white-space: nowrap; align-items: end; text-align: center; min-height: 4.4mm; }
.mv { border-bottom: 0.3mm solid #000; text-align: right; padding: 0 1mm; font-variant-numeric: tabular-nums; }
.total .ml, .total .mv { font-weight: 700; }
.approve { display: flex; flex-direction: column; align-items: center; text-align: center; }
.approve .space { height: 14mm; width: 60mm; border-bottom: 0.3mm dotted #000; }
.bank { margin-top: 2mm; line-height: 1.45; }
.bank u { font-size: 8pt; font-weight: 700; font-style: italic; }
.signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; text-align: center; break-inside: avoid; }
.sign { display: flex; flex-direction: column; align-items: center; gap: 0.6mm; }
.sig { position: relative; height: 18mm; width: 100%; display: flex; align-items: center; justify-content: center; }
.sig img { max-height: 20mm; max-width: 45mm; position: relative; }
.sig .stamp { position: absolute; max-height: 22mm; opacity: .9; left: 50%; transform: translateX(-80%); }
.wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.wm span { font-size: ${watermark === 'DRAFT' ? 130 : 88}pt; font-weight: 700; letter-spacing: 8pt; color: ${watermark === 'DRAFT' ? 'rgba(0,0,0,.07)' : 'rgba(192,0,0,.1)'}; transform: rotate(-30deg); }
</style></head><body><div class="page">
<header>
  <div class="logo"><img src="${LOGO}" alt="inilah.com"></div>
  <div class="org"><b>${esc(org.name).toUpperCase()}</b>${esc(org.address)}</div>
  <h1>MEDIA ORDER</h1>
</header>
<div class="rule"></div>
<main>
  <section class="box stack" data-section="nomor">
    ${row('No. Media Order', esc(mo.moNumber ?? ''), 'b')}
    ${row('Tanggal', formatTanggal(mo.moDate))}
  </section>
  <section class="box cols" data-section="klien">
    <div class="stack">${row('Nama', esc(c.picName))}${row('Perusahaan / Biro Iklan', esc(c.companyName), 'b')}${row('Nomor NPWP', esc(c.npwp))}${row('Alamat', esc(c.address))}</div>
    <div class="stack">${row('Kota', esc(c.city))}${row('Kode Pos', esc(c.postalCode))}${row('Email', esc(c.email))}${row('No. Telp', esc(c.phone))}</div>
  </section>
  <section class="box stack" data-section="periode">
    ${row('Masa Periode', formatPeriode(mo.periodStart, mo.periodEnd))}
    ${row('Keterangan', esc(mo.description))}
  </section>
  <section class="box stack" data-section="detail-iklan">
    ${row('Tanggal Tayang', esc(mo.airingDateText))}
    <div class="row"><span class="k">Jenis Iklan</span><span class="opts">${opts('AD_TYPE')}</span></div>
    <div class="row"><span class="k">Bentuk Kerjasama</span><span class="opts">${opts('COOP_TYPE')}</span></div>
    <div class="row"><span class="k">Penempatan Iklan</span><span class="opts">${opts('PLACEMENT')}</span></div>
    <div class="row" style="align-items:flex-start"><span class="k">Lokasi Iklan</span><span class="opts" style="flex-direction:column;flex-wrap:nowrap">${locations}</span></div>
    <div class="row" style="align-items:flex-start"><span class="ul">Detail Kerjasama</span>${ruled(mo.cooperationDetail, 5)}</div>
    <div class="row" style="align-items:flex-start"><span class="ul">Term and Conditions</span>${ruled(mo.termsConditions, 6)}</div>
  </section>
  <section class="box" data-section="pembayaran">
    <div class="pay">
      <div class="stack">${
        mo.paymentMethod
          ? `<div class="row"><span class="k">Cara Pembayaran</span><span>${box(mo.paymentMethod === 'TRANSFER')} Transfer</span></div>
        <div class="row"><span class="k"></span><span>${box(mo.paymentMethod === 'CHEQUE_BG')} Cek/BG No</span><span class="v">${esc(mo.chequeNo)}</span></div>`
          : ''
      }</div>
      <div class="stack">${mo.receiptNo ? row('Kwitansi No', esc(mo.receiptNo)) : ''}${mo.dueDateText ? row('Jatuh Tempo', esc(mo.dueDateText)) : ''}</div>
      <div>${
        hasCost
          ? `<div class="row" style="align-items:flex-start"><span class="k">Biaya Pemasangan</span><div style="flex:1">
        ${mo.adProduct ? money('Produk Iklan', esc(mo.adProduct)) : ''}
        ${
          hasSubtotal
            ? `${money('Subtotal', `Rp ${formatRupiah(mo.subtotal)}`)}
        ${mo.isTaxable ? `${money(`DPP ${mo.dppFactorNum}/${mo.dppFactorDen}`, `Rp ${formatRupiah(mo.dppAmount)}`)}${money(`PPN ${esc(mo.ppnRate)}%`, `Rp ${formatRupiah(mo.ppnAmount)}`, '(+)')}` : ''}
        <div class="total">${money('Total Payment', `Rp ${formatRupiah(mo.totalAmount)}`)}</div>`
            : ''
        }
      </div></div>`
          : ''
      }</div>
      <div class="approve"><span>Menyetujui,</span><span>Tanda Tangan / Stampel Pengiklan</span><div class="space"></div></div>
    </div>
    ${mo.paymentMethod || hasSubtotal ? `<div class="bank"><u>Pembayaran dapat ditransfer ke :</u><br>${esc(org.bankName)}<br>No. Rekening ${esc(org.bankAccountNo)}<br>A/n ${esc(org.bankAccountName)}</div>` : ''}
  </section>
  <section class="signs" data-section="tanda-tangan">
    ${signer('Dibuat oleh,', mo.signatories.createdBy, images.createdBy)}
    ${signer('Diketahui oleh,', mo.signatories.acknowledgedBy, images.acknowledgedBy)}
    ${signer('Disetujui oleh,', mo.signatories.approvedBy, images.approvedBy, images.stamp)}
  </section>
</main>
${watermark ? `<div class="wm"><span>${watermark}</span></div>` : ''}
</div></body></html>`;
}
