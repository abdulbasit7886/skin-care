import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Printer, AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import MultiSelect from '@/components/MultiSelect';
import { praTaxOf } from '@/lib/praTax';
import { formatMoney as money } from '@/lib/money';
import { invoiceErrorMessage, printInvoiceRecord } from '@/lib/invoicePrintFlow';

const priceOf = (list, name) => Number((list || []).find((x) => x.name === name)?.price || 0);
const sumOf = (list, names) => (names || []).reduce((s, n) => s + priceOf(list, n), 0);
const withExtras = (names, extras) => [...new Set([...(names || []), ...(extras || [])])];

// Admin-only amendment of an invoice. Amending an invoice that was already
// printed makes it a "Corrected Invoice" (the server sets is_corrected and
// bumps the revision); the corrected copy can then be printed straight away.
export default function EditInvoiceDialog({ invoice, open, onOpenChange, onSaved, facility }) {
  const { toast } = useToast();
  const [catalog, setCatalog] = useState({ services: [], procedures: [] });
  const [doctor, setDoctor] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!open || !invoice) return;
    setSaved(null);
    setForm({
      visit_type: invoice.visit_type || 'consultation',
      consultation_fee: Number(invoice.consultation_fee || 0),
      service_items: invoice.service_items || [],
      services_total: Number(invoice.services_total || 0),
      procedure_items: invoice.procedure_items || [],
      procedures_total: Number(invoice.procedures_total || 0),
      discount_amount: Number(invoice.discount_amount || 0),
      amount_paid: Number(invoice.amount_paid || 0),
      payment_mode: invoice.payment_mode || 'cash',
    });
    let active = true;
    (async () => {
      try {
        const [svc, proc, doc] = await Promise.all([
          api.entities.Service.list({ sort: 'name', limit: 500 }),
          api.entities.Procedure.list({ sort: 'name', limit: 500 }),
          invoice.doctor_id ? api.entities.Doctor.get(invoice.doctor_id).catch(() => null) : Promise.resolve(null),
        ]);
        if (!active) return;
        setCatalog({
          services: (svc.items || []).map((s) => ({ name: s.name, price: s.price, active: s.active !== false })),
          procedures: (proc.items || []).map((p) => ({ name: p.name, price: p.price, active: p.active !== false })),
        });
        setDoctor(doc);
      } catch (e) {
        toast({ title: 'Could not load the price list', description: e.message, variant: 'destructive' });
      }
    })();
    return () => { active = false; };
  }, [open, invoice?.id]);

  const serviceOptions = useMemo(
    () => withExtras(catalog.services.filter((s) => s.active).map((s) => s.name), invoice?.service_items),
    [catalog.services, invoice?.service_items]
  );
  const procedureOptions = useMemo(
    () => withExtras(catalog.procedures.filter((p) => p.active).map((p) => p.name), invoice?.procedure_items),
    [catalog.procedures, invoice?.procedure_items]
  );

  if (!invoice || !form) return null;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const fee = Number(form.consultation_fee || 0);
  const total = fee + Number(form.services_total || 0) + Number(form.procedures_total || 0);
  const discount = Math.max(0, Number(form.discount_amount || 0));
  const grand = Math.max(0, total - discount);
  const paid = Math.max(0, Number(form.amount_paid || 0));
  const balance = Math.max(0, grand - paid);
  const taxRate = Number(invoice.tax_rate || 0);
  const taxAmount = praTaxOf(fee, taxRate);
  const willCorrect = !!invoice.printed;

  const setVisitType = (visit_type) => {
    const docFee = visit_type === 'followup' ? doctor?.followup_fee : doctor?.consultation_fee;
    set({ visit_type, ...(docFee != null ? { consultation_fee: Number(docFee || 0) } : {}) });
  };

  const save = async () => {
    if (discount > total) {
      toast({ title: 'Discount cannot exceed the invoiced amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        visit_type: form.visit_type,
        consultation_fee: fee,
        service_items: form.service_items,
        services_total: Number(form.services_total || 0),
        procedure_items: form.procedure_items,
        procedures_total: Number(form.procedures_total || 0),
        total,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discount,
        amount_paid: Math.min(paid, grand),
        balance,
        payment_mode: form.payment_mode,
        status: balance <= 0 && (paid > 0 || grand === 0) ? 'paid' : 'unpaid',
      };
      const updated = await api.entities.Invoice.update(invoice.id, payload);
      setSaved(updated);
      onSaved?.(updated);
      toast({
        title: updated?.is_corrected ? 'Invoice corrected' : 'Invoice updated',
        description: updated?.is_corrected
          ? `Saved as revision ${updated.revision || 1}. Print the corrected invoice for the patient.`
          : 'Changes saved.',
      });
    } catch (e) {
      toast({ title: 'Could not save invoice', description: invoiceErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const printCorrected = async () => {
    const res = await printInvoiceRecord(saved, { isAdmin: true, facility, onPrinted: onSaved });
    if (!res.ok) {
      toast({
        title: 'Could not print',
        description: res.error?.message || 'Collect payment in full before printing the invoice.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 font-display text-xl">
            <Pencil className="h-5 w-5 text-primary" /> Amend invoice
          </DialogTitle>
          <DialogDescription>
            {invoice.patient_name} · {invoice.doctor_name} · {invoice.visit_date}
          </DialogDescription>
        </DialogHeader>

        {willCorrect && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This invoice has already been printed. Saving changes issues a <span className="font-semibold">Corrected Invoice</span>.
              The original values stay in the audit trail.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Visit type</Label>
            <Select value={form.visit_type} onValueChange={setVisitType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{form.visit_type === 'followup' ? 'Follow-up fee' : 'Consultation fee'} (Rs)</Label>
            <Input type="number" min="0" step="1" value={form.consultation_fee} onChange={(e) => set({ consultation_fee: e.target.value })} />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <MultiSelect
            label="Services"
            options={serviceOptions}
            value={form.service_items}
            onChange={(v) => set({ service_items: v, services_total: sumOf(catalog.services, v) })}
            placeholder="No services configured"
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Services subtotal (Rs)</span>
            <Input type="number" min="0" className="h-8 w-36 text-right" value={form.services_total} onChange={(e) => set({ services_total: e.target.value })} />
          </div>
          <MultiSelect
            label="Procedures"
            options={procedureOptions}
            value={form.procedure_items}
            onChange={(v) => set({ procedure_items: v, procedures_total: sumOf(catalog.procedures, v) })}
            placeholder="No procedures configured"
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Procedures subtotal (Rs)</span>
            <Input type="number" min="0" className="h-8 w-36 text-right" value={form.procedures_total} onChange={(e) => set({ procedures_total: e.target.value })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Discount (Rs)</Label>
            <Input type="number" min="0" value={form.discount_amount} onChange={(e) => set({ discount_amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount paid (Rs)</Label>
            <Input type="number" min="0" value={form.amount_paid} onChange={(e) => set({ amount_paid: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode of payment</Label>
            <Select value={form.payment_mode} onValueChange={(v) => set({ payment_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="online_transfer">Online Transfer</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border text-sm">
          <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Invoiced amount</span><span>{money(total)}</span></div>
          <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">PRA Tax @ {taxRate}% (included in consultation)</span><span>{money(taxAmount)}</span></div>
          <div className="flex justify-between px-4 py-2 font-semibold"><span>Total payable</span><span className="text-primary">{money(grand)}</span></div>
          <div className="flex justify-between px-4 py-2"><span className="text-muted-foreground">Balance</span><span className={balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>{money(balance)}</span></div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>{saved ? 'Close' : 'Cancel'}</Button>
          {saved && saved.status === 'paid' && (
            <Button variant="outline" onClick={printCorrected} className="gap-2">
              <Printer className="h-4 w-4" /> {saved.is_corrected ? 'Print corrected invoice' : 'Print invoice'}
            </Button>
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : willCorrect ? 'Save correction' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
