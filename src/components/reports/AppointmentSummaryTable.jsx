import React from 'react';
import { Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/money';

export default function AppointmentSummaryTable({ loading, byDoctor, total, invoiced, config }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? (
        <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : byDoctor.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">{config.emptyLabel}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3 text-right">{config.countLabel}</th>
                <th className="px-4 py-3 text-right">Invoiced</th>
              </tr>
            </thead>
            <tbody>
              {byDoctor.map((r) => (
                <tr key={r.doctor_name} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.doctor_name}</td>
                  <td className="px-4 py-3 text-right">{r.count}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatMoney(r.invoiced)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-4 py-3">Grand Total</td>
                <td className="px-4 py-3 text-right">{total}</td>
                <td className="px-4 py-3 text-right">{formatMoney(invoiced)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}