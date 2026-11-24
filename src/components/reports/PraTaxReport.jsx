import React, { useMemo } from 'react';
import SummaryCard from '@/components/reports/SummaryCard';
import { formatMoney } from '@/lib/money';
import { mrnDisplay } from '@/lib/formatId';
import { PRA_TAX_NOTE } from '@/lib/praTax';

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// One line per visit: the consultation charge and the PRA tax already inside it.
export default function PraTaxReport({ loading, invoices = [] }) {
  const totals = useMemo(() => invoices.reduce((acc, inv) => {
    acc.consultation += Number(inv.consultation_fee || 0);
    acc.tax += Number(inv.tax_amount || 0);
    return acc;
  }, { consultation: 0, tax: 0 }), [invoices]);

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Patients Seen" value={invoices.length} tone="zinc" />
        <SummaryCard label="Consultation Charges" value={formatMoney(totals.consultation)} tone="primary" />
        <SummaryCard label="PRA Tax Payable" value={formatMoney(totals.tax)} tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading report…</div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">No consultations invoiced in this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">MRN</th>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Visit</th>
                  <th className="px-4 py-3 text-right">Consultation</th>
                  <th className="px-4 py-3 text-right">PRA Tax</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDate(inv.visit_date)}</td>
                    <td className="px-4 py-3 font-medium">{inv.patient_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{mrnDisplay(inv.mrn) || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.doctor_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.visit_type === 'followup' ? 'Follow-up' : 'Consultation'}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(inv.consultation_fee)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">
                      {formatMoney(inv.tax_amount)}
                      <span className="ml-1 text-xs text-muted-foreground">@{Number(inv.tax_rate || 0)}%</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="px-4 py-3" colSpan={5}>Total for the period</td>
                  <td className="px-4 py-3 text-right">{formatMoney(totals.consultation)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{formatMoney(totals.tax)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">PRA tax payable to the authority: <span className="text-primary">{formatMoney(totals.tax)}</span></p>
        <p className="mt-1 text-xs italic text-muted-foreground">
          {PRA_TAX_NOTE} — consultation charges are quoted inclusive of PRA tax, so the tax shown is the portion already contained in each charge, not an added amount.
        </p>
      </div>
    </>
  );
}