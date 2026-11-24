import { api } from '@/api/client';

// Returns the tax percentage effective for the given date (YYYY-MM-DD),
// i.e. the most recent rate whose effective_date is on or before that date.
// Falls back to 0 when no rate applies.
export const getEffectiveTaxRate = async (forDate) => {
  try {
    const { items } = await api.entities.TaxRate.list({ sort: '-effective_date', limit: 100 });
    const applicable = (items || []).find((t) => !t.effective_date || t.effective_date <= forDate);
    return applicable ? Number(applicable.rate || 0) : 0;
  } catch (e) {
    return 0;
  }
};

export const computeTax = (subtotal, rate) => Math.round(Number(subtotal || 0) * Number(rate || 0)) / 100;