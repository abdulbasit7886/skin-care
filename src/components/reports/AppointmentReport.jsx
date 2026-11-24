import React, { useMemo } from 'react';
import SummaryCard from '@/components/reports/SummaryCard';
import AppointmentSummaryTable from '@/components/reports/AppointmentSummaryTable';
import AppointmentDetailTable from '@/components/reports/AppointmentDetailTable';
import { formatMoney, invoicedTotal } from '@/lib/money';

export default function AppointmentReport({ loading, appointments, invoices = {}, config }) {
  const { byDoctor, totalInvoiced } = useMemo(() => {
    const map = new Map();
    let total = 0;
    appointments.forEach((a) => {
      const key = a.doctor_name || '—';
      const row = map.get(key) || { doctor_name: key, count: 0, invoiced: 0 };
      const amount = invoicedTotal(invoices[a.id]);
      row.count += 1;
      row.invoiced += amount;
      total += amount;
      map.set(key, row);
    });
    return { byDoctor: [...map.values()].sort((a, b) => b.count - a.count), totalInvoiced: total };
  }, [appointments, invoices]);

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label={config.totalLabel} value={appointments.length} tone="zinc" />
        <SummaryCard label="Doctors" value={byDoctor.length} tone="amber" />
        <SummaryCard label="Invoiced" value={formatMoney(totalInvoiced)} tone="primary" />
      </div>

      <AppointmentSummaryTable
        loading={loading}
        byDoctor={byDoctor}
        total={appointments.length}
        invoiced={totalInvoiced}
        config={config}
      />

      {!loading && appointments.length > 0 && (
        <AppointmentDetailTable
          appointments={appointments}
          invoices={invoices}
          title={config.detailTitle}
          showStatus={config.showStatus}
        />
      )}
    </>
  );
}