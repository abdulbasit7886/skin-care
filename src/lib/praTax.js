import { getEffectiveTaxRate } from '@/lib/tax';

// PRA (Punjab Revenue Authority) tax on consultation services.
export const DEFAULT_PRA_RATE = 8;

export const PRA_TAX_NOTE = 'Inclusive of PRA Tax';

// PRA tax is 8% of the consultation fee: Rs 240 on a Rs 3,000 consultation.
export const praTaxOf = (fee, rate = DEFAULT_PRA_RATE) => {
  const r = Number(rate || 0);
  if (!r) return 0;
  return Math.round(Number(fee || 0) * r) / 100;
};

// Rate is taken from the configured tax rate; with none saved it is 8%.
export const praRateFor = async (forDate) => {
  const configured = await getEffectiveTaxRate(forDate);
  return configured > 0 ? configured : DEFAULT_PRA_RATE;
};