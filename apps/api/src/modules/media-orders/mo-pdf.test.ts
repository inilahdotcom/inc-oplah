import { describe, expect, it } from 'vitest';
import type { MediaOrderDto } from '@inc/shared';
import { moHtml } from './mo-pdf';

const signer = { name: 'Alvin Alverdian', title: 'Chief Business Officer' };
const mo = {
  moNumber: '007/MO-BMO/INC/V/2026',
  status: 'SUBMITTED',
  moDate: '2026-05-22',
  clientSnapshot: { picName: 'Budi', companyName: 'PT Bukit Asam <Tbk>', npwp: null, address: null, city: null, postalCode: null, email: 'a@b.co', phone: '08' },
  periodStart: '2026-06-01',
  periodEnd: '2027-05-31',
  description: 'Publikasi Rilis Artikel',
  selectedOptions: { AD_TYPE: ['ARTIKEL'], COOP_TYPE: [], PLACEMENT: [], AD_LOCATION: ['SPOT_WEB', 'BILLBOARD'] },
  cooperationDetail: 'Artikel Release 12x',
  termsConditions: null,
  paymentMethod: 'TRANSFER',
  subtotal: '20000000',
  dppAmount: '18333333',
  ppnAmount: '2200000',
  totalAmount: '22200000',
  ppnRate: '12',
  dppFactorNum: 11,
  dppFactorDen: 12,
  isTaxable: true,
  signatories: { createdBy: { name: 'Bimo', title: 'Sales' }, acknowledgedBy: signer, approvedBy: signer },
} as unknown as MediaOrderDto;
const org = { name: 'PT. Indonesia News Center', address: 'Jakarta', bankName: 'Bank Mandiri', bankAccountNo: '173', bankAccountName: 'PT INC' };
const options = [
  { group: 'AD_TYPE' as const, code: 'BANNER', label: 'Banner', parentCode: null },
  { group: 'AD_TYPE' as const, code: 'ARTIKEL', label: 'Artikel', parentCode: null },
  { group: 'AD_LOCATION' as const, code: 'SPOT_WEB', label: 'Spot Ads Website', parentCode: null },
  { group: 'AD_LOCATION' as const, code: 'BILLBOARD', label: 'Billboard', parentCode: 'SPOT_WEB' },
];

describe('moHtml (PRD §8)', () => {
  it('AC M3: seluruh section dokumen acuan, urutan sama', () => {
    const html = moHtml(mo, org, options, {});
    const order = ['MEDIA ORDER', 'data-section="nomor"', 'data-section="klien"', 'data-section="periode"', 'data-section="detail-iklan"', 'data-section="pembayaran"', 'data-section="tanda-tangan"'];
    const at = order.map((s) => html.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('isi: nomor, periode, nominal, opsi tercentang, escaping, watermark', () => {
    const html = moHtml(mo, org, options, {});
    expect(html).toContain('007/MO-BMO/INC/V/2026');
    expect(html).toContain('Juni 2026 - Mei 2027');
    expect(html).toContain('Rp 22.200.000');
    expect(html).toContain('☑ Artikel');
    expect(html).toContain('☐ Banner');
    expect(html).toContain('☑ Billboard');
    expect(html).toContain('PT Bukit Asam &lt;Tbk&gt;');
    expect(html).not.toContain('class="wm"');
    expect(moHtml({ ...mo, status: 'DRAFT' }, org, options, {})).toContain('<span>DRAFT</span>');
    expect(moHtml({ ...mo, isTaxable: false }, org, options, {})).not.toContain('DPP 11/12');
  });
});
