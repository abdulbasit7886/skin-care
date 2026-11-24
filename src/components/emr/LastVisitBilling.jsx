import React from 'react';
import { formatMoney } from '@/lib/money';

const paymentLabels = {
  cash: 'Cash',
  online_transfer: 'Online transfer',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
};

function Row({ label, value, strong, danger }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className={strong ? 'text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}>{label}</span>
      <span className={`text-right text-sm tabular-nums ${danger ? 'font-medium text-rose-600' : strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// What the previous visit was billed and paid.
export default function LastVisitBilling({ invoice }) {
  if (!invoice) return null;
  const balance = Number(invoice.balance || 0);

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Billing</p>
      <Row label={invoice.visit_type === 'followup' ? 'Follow-up fee' : 'Consultation fee'} value={formatMoney(invoice.consultation_fee)} />
      {Number(invoice.services_total || 0) > 0 && (
        <Row
          label={`Services${(invoice.service_items || []).length ? ` — ${invoice.service_items.join(', ')}` : ''}`}
          value={formatMoney(invoice.services_total)}
        />
      )}
      {Number(invoice.procedures_total || 0) > 0 && (
        <Row
          label={`Procedures${(invoice.procedure_items || []).length ? ` — ${invoice.procedure_items.join(', ')}` : ''}`}
          value={formatMoney(invoice.procedures_total)}
        />
      )}
      {Number(invoice.discount_amount || 0) > 0 && (
        <Row label="Discount" value={`- ${formatMoney(invoice.discount_amount)}`} />
      )}
      <div className="my-1 border-t border-border" />
      <Row label="Total" value={formatMoney(invoice.total)} strong />
      {Number(invoice.tax_amount || 0) > 0 && (
        <p className="pb-1 text-xs text-muted-foreground">
          Includes PRA tax {formatMoney(invoice.tax_amount)} ({invoice.tax_rate}%) within the consultation fee.
        </p>
      )}
      <Row label="Paid" value={formatMoney(invoice.amount_paid)} />
      <Row label="Balance" value={formatMoney(balance)} danger={balance > 0} />
      <p className="pt-1 text-xs text-muted-foreground">
        {invoice.payment_mode ? `${paymentLabels[invoice.payment_mode] || invoice.payment_mode} · ` : ''}
        {invoice.status === 'paid' ? 'Paid in full' : 'Unpaid'}
      </p>
    </div>
  );
}