import React from 'react';
import { Receipt } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { praTaxOf, DEFAULT_PRA_RATE, PRA_TAX_NOTE } from '@/lib/praTax';

export const computeBilling = ({ doctor, visitType, services, procedures, catalog }) => {
  const consultationFee = visitType === 'followup'
    ? Number(doctor?.followup_fee || 0)
    : Number(doctor?.consultation_fee || 0);
  const servicesTotal = (services || []).reduce((sum, name) => {
    const item = (catalog.services || []).find((s) => s.name === name);
    return sum + Number(item?.price || 0);
  }, 0);
  const proceduresTotal = (procedures || []).reduce((sum, name) => {
    const item = (catalog.procedures || []).find((p) => p.name === name);
    return sum + Number(item?.price || 0);
  }, 0);
  const total = consultationFee + servicesTotal + proceduresTotal;
  return { consultationFee, servicesTotal, proceduresTotal, total };
};

export const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

export default function BillingSection({
  doctor, visitType, setVisitType,
  services, procedures, catalog, locked = false,
  lockReason = 'invoice',
  praRate = DEFAULT_PRA_RATE,
}) {
  const { consultationFee, servicesTotal, proceduresTotal, total } = computeBilling({
    doctor, visitType, services, procedures, catalog,
  });
  const praTax = praTaxOf(consultationFee, praRate);

  const line = (label, amount, muted) => (
    <div className={`flex items-center justify-between py-2 text-sm ${muted ? 'text-muted-foreground' : ''}`}>
      <span>{label}</span>
      <span className="font-medium">{money(amount)}</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold">
          <Receipt className="h-5 w-5 text-primary" /> Billing & Invoice
        </h2>
      </div>

      {locked && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {lockReason === 'emr'
            ? 'Billing is read-only because this EMR is locked. An admin can amend the invoice from the Front Desk.'
            : 'This invoice has been printed and is locked. Only an admin can amend it from the Front Desk; the reprint is marked Corrected Invoice.'}
        </p>
      )}

      {/* Visit type */}
      <div className="mb-4 space-y-1.5">
        <Label>Visit type</Label>
        <div className="inline-flex rounded-lg border border-input p-1">
          {[
            { key: 'consultation', label: 'Consultation' },
            { key: 'followup', label: 'Follow-up' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={locked}
              onClick={() => setVisitType(opt.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                locked ? 'cursor-not-allowed opacity-60' : ''
              } ${
                visitType === opt.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Itemized */}
      <div className="divide-y divide-border">
        {line(
          visitType === 'followup' ? 'Follow-up fee' : 'Consultation fee',
          consultationFee,
        )}
        {(services || []).map((name) => {
          const item = (catalog.services || []).find((s) => s.name === name);
          return line(`Service · ${name}`, item?.price || 0, true);
        })}
        {(procedures || []).map((name) => {
          const item = (catalog.procedures || []).find((p) => p.name === name);
          return line(`Procedure · ${name}`, item?.price || 0, true);
        })}
      </div>

      {/* Totals */}
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Services subtotal</span><span>{money(servicesTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Procedures subtotal</span><span>{money(proceduresTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>PRA Tax @ {praRate}% (included in consultation)</span><span>{money(praTax)}</span>
        </div>
        <p className="text-xs italic text-muted-foreground">{PRA_TAX_NOTE}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="font-display text-lg font-semibold">Total</span>
          <span className="font-display text-lg font-semibold text-primary">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}