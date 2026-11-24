import React, { useEffect, useState } from 'react';
import { Printer, Building2, Lock, Pencil, FileWarning } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { printInvoiceRecord } from '@/lib/invoicePrintFlow';
import { invoiceLabel } from '@/lib/invoicePrint';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { mrnDisplay } from '@/lib/formatId';
import { PRA_TAX_NOTE } from '@/lib/praTax';

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
const modeLabel = (m) => ({ cash: 'Cash', online_transfer: 'Online Transfer', debit_card: 'Debit Card', credit_card: 'Credit Card' }[m] || '—');
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function InvoiceViewDialog({ invoice, open, onOpenChange, onPrinted, onEdit, facility }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = isAdminRole(user?.effectiveRole || user?.role);
  const [printed, setPrinted] = useState(!!invoice?.printed);
  useEffect(() => { setPrinted(!!invoice?.printed); }, [invoice?.id, invoice?.printed]);

  if (!invoice) return null;
  const subtotal = Number(invoice.total || 0);
  const tax = Number(invoice.tax_amount || 0);
  const discount = Number(invoice.discount_amount || 0);
  // PRA tax is already inside the consultation charge.
  const grand = Math.max(0, subtotal - discount);
  const paid = Number(invoice.amount_paid || 0);
  const balance = Number(invoice.balance || 0);
  const isPaid = invoice.status === 'paid';
  const canPrint = isPaid && (!printed || isAdmin);
  const label = invoiceLabel(invoice);

  const handlePrint = async () => {
    const res = await printInvoiceRecord(invoice, {
      isAdmin,
      printed,
      facility,
      onPrinted: (u) => { setPrinted(true); onPrinted?.(u); },
    });
    if (res.error) {
      toast({ title: res.ok ? 'Printed, but the invoice could not be locked' : 'Could not print', description: res.error.message, variant: 'destructive' });
    }
  };

  const printLabel = !printed
    ? 'Print'
    : invoice.is_corrected ? 'Print corrected invoice' : 'Reprint (duplicate)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
            {label.title}
            {printed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <Lock className="h-3 w-3" /> Printed · locked
              </span>
            )}
            {label.corrected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                <FileWarning className="h-3 w-3" /> Corrected
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-border p-5">
          {/* Clinic header */}
          <div className="border-b border-border pb-4">
            <div className="inline-flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h3 className="font-display text-xl font-semibold text-primary">{facility?.name || 'Dr Safoora Skin Chemistry'}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{facility?.address || 'Dermatology & Aesthetic Medicine'}</p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-y-2 py-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-medium">{invoice.patient_name}</p><p className="text-xs text-muted-foreground">MRN {mrnDisplay(invoice.mrn) || '—'}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Attending Doctor</p><p className="font-medium">{invoice.doctor_name}</p></div>
            <div><p className="text-xs text-muted-foreground">Visit date</p><p className="font-medium">{fmtDate(invoice.visit_date)}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Visit time</p><p className="font-medium">{invoice.visit_time || '—'}</p></div>
          </div>

          {/* Services offered details */}
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Services offered</p>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between"><span>{invoice.visit_type === 'followup' ? 'Follow-up consultation' : 'Consultation'}</span><span>{money(invoice.consultation_fee)}</span></li>
              {(invoice.service_items || []).map((s, i) => (
                <li key={`s${i}`} className="flex justify-between text-muted-foreground"><span>· {s}</span><span>included</span></li>
              ))}
              {(invoice.procedure_items || []).map((p, i) => (
                <li key={`p${i}`} className="flex justify-between text-muted-foreground"><span>· {p}</span><span>included</span></li>
              ))}
            </ul>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoiced amount</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">PRA Tax @ {Number(invoice.tax_rate || 0)}% (included in consultation)</span><span>{money(tax)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-rose-700">- {money(discount)}</span></div>
            )}
            <div className="flex justify-between font-display text-base font-semibold"><span>Total payable</span><span className="text-primary">{money(grand)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid ({modeLabel(invoice.payment_mode)})</span><span className="text-emerald-700">{money(paid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Balance</span><span>{money(balance)}</span></div>
            <p className="pt-1 text-right text-xs italic text-muted-foreground">{PRA_TAX_NOTE}</p>
          </div>
        </div>

        {!canPrint && (
          <p className="text-center text-xs text-muted-foreground">
            {isPaid
              ? 'This invoice is printed and locked. Only an admin can amend or reprint it.'
              : 'Collect payment before printing the invoice.'}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>Close</Button>
          {isAdmin && onEdit && (
            <Button variant="outline" className="gap-2" onClick={() => onEdit(invoice)}>
              <Pencil className="h-4 w-4" /> {printed ? 'Amend (corrected invoice)' : 'Edit'}
            </Button>
          )}
          <Button className="gap-2" onClick={handlePrint} disabled={!canPrint}>
            <Printer className="h-4 w-4" /> {printLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
