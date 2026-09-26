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
const row = (label: string, value: string, cls = '') => `<div class="row"><span class="k">${label}</span><span class="${cls}">${value}</span></div>`;
const ruled = (text: string | null, min: number) => {
  const lines = (text ?? '').split('\n');
  while (lines.length < min) lines.push('');
  return `<div class="ruled">${lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>`;
};

/**
 * HTML cetak MO (PRD §8, prototipe `docs/design/Oplah Media Order.dc.html` L705-785).
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
  const signer = (label: string, s: MediaOrderDto['signatories']['createdBy'], img?: string, stamp?: string, italic = false) => `
    <div class="sign">
      <span class="k">${label}</span>
      <div class="sig">${signed && stamp ? `<img class="stamp" src="${stamp}">` : ''}${signed && img ? `<img src="${img}">` : ''}</div>
      <b>${esc(s?.name)}</b><span class="${italic ? 'i' : ''}">${esc(s?.title)}</span>
    </div>`;
  const watermark = mo.status === 'DRAFT' ? 'DRAFT' : mo.status === 'CANCELLED' ? 'DIBATALKAN' : '';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font: 8.5pt/1.35 Inter, 'Helvetica Neue', Arial, sans-serif; color: #0d253d; }
.page { position: relative; min-height: 297mm; }
header { background: #1c1e54; color: #fff; padding: 6mm 8.5mm; display: flex; justify-content: space-between; align-items: center; }
header .brand { font-size: 17pt; font-weight: 500; letter-spacing: -0.3pt; }
header .org { display: flex; flex-direction: column; gap: 1mm; max-width: 110mm; }
header small { font-size: 7.5pt; color: rgba(255,255,255,.75); }
header h1 { margin: 0; font-size: 25pt; font-weight: 300; letter-spacing: -0.5pt; }
.rule { height: 1.2mm; background: #ea2261; }
main { padding: 4mm 8.5mm 5mm; display: flex; flex-direction: column; gap: 2.6mm; }
.box { border: 0.3mm solid #e3e8ee; border-radius: 1.6mm; }
.cols { display: grid; grid-template-columns: 1fr 1fr; }
.cols > div { padding: 2mm 3mm; display: flex; flex-direction: column; gap: 1mm; }
.cols > div + div { border-left: 0.3mm solid #e3e8ee; }
.pad { padding: 2mm 3mm; display: flex; flex-direction: column; gap: 1.5mm; }
.row { display: flex; gap: 2mm; }
.k { color: #64748d; width: 30mm; flex: none; }
.b { font-weight: 600; }
.opts { display: flex; flex-wrap: wrap; gap: 1mm 3.5mm; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8mm 3mm; padding: 0.8mm 0 0.8mm 3.5mm; }
.ruled { flex: 1; } .ruled div { border-bottom: 0.3mm solid #e3e8ee; min-height: 4.5mm; padding: 0.3mm 0; white-space: pre-wrap; }
.money { display: flex; justify-content: space-between; } .money span:last-child { font-variant-numeric: tabular-nums; }
.total { border-top: 0.3mm solid #0d253d; padding-top: 1mm; margin-top: 0.5mm; font-weight: 600; }
.approve { margin-top: 1.5mm; border: 0.3mm dashed #a8c3de; border-radius: 1.6mm; min-height: 18mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; justify-content: space-between; color: #64748d; }
.bank { margin-top: auto; padding: 2mm; background: #f6f9fc; border-radius: 1.6mm; font-size: 7.5pt; line-height: 1.5; }
.signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 1.5mm; text-align: center; break-inside: avoid; }
.sign { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
.sig { position: relative; height: 17mm; width: 100%; display: flex; align-items: center; justify-content: center; }
.sig img { max-height: 16mm; max-width: 45mm; position: relative; }
.sig .stamp { position: absolute; max-height: 20mm; opacity: .9; left: 50%; transform: translateX(-80%); }
.i { font-style: italic; }
.wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.wm span { font-size: ${watermark === 'DRAFT' ? 130 : 88}pt; font-weight: 500; letter-spacing: 8pt; color: ${watermark === 'DRAFT' ? 'rgba(13,37,61,.07)' : 'rgba(234,34,97,.1)'}; transform: rotate(-30deg); }
</style></head><body><div class="page">
<header>
  <div class="org"><span class="brand">inilah.com</span><span>${esc(org.name)}</span><small>${esc(org.address)}</small></div>
  <h1>MEDIA ORDER</h1>
</header>
<div class="rule"></div>
<main>
  <section class="box cols" data-section="nomor">
    <div>${row('No. Media Order', esc(mo.moNumber ?? '(otomatis)'), 'b')}</div>
    <div>${row('Tanggal', formatTanggal(mo.moDate))}</div>
  </section>
  <section class="box cols" data-section="klien">
    <div>${row('Nama', esc(c.picName))}${row('Perusahaan/Biro Iklan', esc(c.companyName), 'b')}${row('Nomor NIK', esc(c.nik))}${row('Alamat', esc(c.address))}</div>
    <div>${row('Kota', esc(c.city))}${row('Kode Pos', esc(c.postalCode))}${row('Email', esc(c.email))}${row('No. Telp', esc(c.phone))}</div>
  </section>
  <section class="box cols" data-section="periode">
    <div>${row('Masa Periode', formatPeriode(mo.periodStart, mo.periodEnd))}</div>
    <div>${row('Keterangan', esc(mo.description))}</div>
  </section>
  <section class="box pad" data-section="detail-iklan">
    ${row('Tanggal Tayang', esc(mo.airingDateText))}
    ${row('Jenis Iklan', `<span class="opts">${opts('AD_TYPE')}</span>`)}
    ${row('Bentuk Kerjasama', `<span class="opts">${opts('COOP_TYPE')}</span>`)}
    ${row('Penempatan Iklan', `<span class="opts">${opts('PLACEMENT')}</span>`)}
    ${row('Lokasi Iklan', `<span style="display:flex;flex-direction:column;gap:0.8mm;flex:1">${locations}</span>`)}
    <div class="row"><span class="k">Detail Kerjasama</span>${ruled(mo.cooperationDetail, 4)}</div>
    <div class="row"><span class="k">Term and Conditions</span>${ruled(mo.termsConditions, 3)}</div>
  </section>
  <section class="box cols" data-section="pembayaran">
    <div>
      ${row('Cara Pembayaran', `${box(mo.paymentMethod === 'CHEQUE_BG')} Cek/BG No: ${esc(mo.chequeNo)}`)}
      ${row('', `${box(mo.paymentMethod === 'TRANSFER')} Transfer`)}
      ${row('Kwitansi No', esc(mo.receiptNo))}
      ${row('Jatuh Tempo', esc(mo.dueDateText))}
      <div class="approve"><span>Menyetujui,</span><span style="font-size:7.5pt">Tanda Tangan / Stampel Pengiklan</span></div>
    </div>
    <div>
      <span class="b">Biaya Pemasangan</span>
      <div class="money"><span class="k">Produk Iklan</span><span>${esc(mo.adProduct)}</span></div>
      <div class="money"><span class="k">Subtotal</span><span>Rp ${formatRupiah(mo.subtotal)}</span></div>
      ${
        mo.isTaxable
          ? `<div class="money"><span class="k">DPP ${mo.dppFactorNum}/${mo.dppFactorDen}</span><span>Rp ${formatRupiah(mo.dppAmount)}</span></div>
      <div class="money"><span class="k">PPN ${esc(mo.ppnRate)}%</span><span>Rp ${formatRupiah(mo.ppnAmount)} (+)</span></div>`
          : ''
      }
      <div class="money total"><span>Total Payment</span><span>Rp ${formatRupiah(mo.totalAmount)}</span></div>
      <div class="bank">Transfer ke: ${esc(org.bankName)}<br>No. Rek ${esc(org.bankAccountNo)}<br>a/n ${esc(org.bankAccountName)}</div>
    </div>
  </section>
  <section class="signs" data-section="tanda-tangan">
    ${signer('Dibuat oleh', mo.signatories.createdBy, images.createdBy)}
    ${signer('Diketahui oleh', mo.signatories.acknowledgedBy, images.acknowledgedBy)}
    ${signer('Disetujui oleh', mo.signatories.approvedBy, images.approvedBy, images.stamp, true)}
  </section>
</main>
${watermark ? `<div class="wm"><span>${watermark}</span></div>` : ''}
</div></body></html>`;
}
