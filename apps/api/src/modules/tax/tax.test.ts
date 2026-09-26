import { describe, expect, it } from 'vitest';
import { calculateTax } from './tax.service';

const rate = { ppnRate: '12', dppNum: 11, dppDen: 12 };
const t = (subtotal: string, taxable = true) => {
  const { dpp, ppn, total } = calculateTax(subtotal, taxable, rate);
  return [dpp, ppn, total];
};

describe('calculateTax (PRD §7)', () => {
  it('contoh MO acuan: 20.000.000 → 18.333.333 / 2.200.000 / 22.200.000', () => {
    expect(t('20000000')).toEqual(['18333333', '2200000', '22200000']);
  });
  it('batas pembulatan', () => {
    expect(t('1')).toEqual(['1', '0', '1']); // DPP 0,9167 → 1; PPN 0,12 → 0
    expect(t('12')).toEqual(['11', '1', '13']); // PPN 1,32 → 1
    expect(t('999999999')).toEqual(['916666666', '110000000', '1109999999']); // DPP …665,75 → …666; PPN …999,92 → 110.000.000
  });
  it('tidak kena PPN', () => {
    expect(t('20000000', false)).toEqual(['0', '0', '20000000']);
  });
});
