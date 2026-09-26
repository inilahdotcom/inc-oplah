import { Prisma } from '@prisma/client';
import type { TaxResult } from '@inc/shared';

export interface TaxRate {
  ppnRate: string;
  dppNum: number;
  dppDen: number;
}

const D = Prisma.Decimal;
const halfUp = (d: Prisma.Decimal) => d.toDecimalPlaces(0, D.ROUND_HALF_UP);

/**
 * Satu-satunya rumus pajak (PRD §7, AGENT.md §3):
 * DPP = ROUND_HALF_UP(Subtotal × num/den), PPN = ROUND_HALF_UP(DPP × rate/100), Total = Subtotal + PPN.
 * Tidak kena PPN → DPP & PPN 0. Aritmetika desimal (decimal.js milik Prisma), tanpa float.
 */
export function calculateTax(subtotal: string, isTaxable: boolean, rate: TaxRate): TaxResult {
  const sub = new D(subtotal);
  const dpp = isTaxable ? halfUp(sub.mul(rate.dppNum).div(rate.dppDen)) : new D(0);
  const ppn = isTaxable ? halfUp(dpp.mul(rate.ppnRate).div(100)) : new D(0);
  return {
    subtotal: sub.toFixed(0),
    dpp: dpp.toFixed(0),
    ppn: ppn.toFixed(0),
    total: sub.add(ppn).toFixed(0),
    ppnRate: rate.ppnRate,
    dppNum: rate.dppNum,
    dppDen: rate.dppDen,
  };
}
