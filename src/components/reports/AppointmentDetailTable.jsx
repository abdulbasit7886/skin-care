import React from 'react';
import { formatMoney, invoicedTotal } from '@/lib/money';

export default function AppointmentDetailTable({ appointments, invoices = {}, title, showStatus }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">MRN</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Type</th>
              {showStatus && <th className="px-4 py-3">Status</th>}
              <th className="px-4 py-3 text-right">Invoiced</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => {
              const inv = invoices[a.id];
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{a.date || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.start_time || '—'}</td>
                  <td className="px-4 py-3 font-medium">{a.patient_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.mrn || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.doctor_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.type === 'online' ? 'Online' : 'In-clinic'}</td>
                  {showStatus && <td className="px-4 py-3 capitalize text-muted-foreground">{(a.status || '').replace('_', ' ')}</td>}
                  <td className="px-4 py-3 text-right">{inv ? formatMoney(invoicedTotal(inv)) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}