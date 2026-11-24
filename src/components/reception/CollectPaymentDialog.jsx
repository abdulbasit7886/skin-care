import React, { useEffect, useState } from 'react';
import { Receipt, Printer } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { invoiceErrorMessage, printInvoiceRecord } from '@/lib/invoicePrintFlow';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { PRA_TAX_NOTE } from '@/lib/praTax';

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;

export default function CollectPaymentDialog({ invoice, open, onOpenChange, onSettled, facility }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.effectiveRole || user?.role);
  const [amountPaid, setAmountPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [mode, setMode] = useState('cash');
  const [saving, setSaving] = useState(false);

  const subtotal = Number(invoice?.total || 0);
  const tax = Number(invoice?.tax_amount || 0);
  const discountAmount = Number(discount || 0);
  // PRA tax is already inside the consultation charge.
  const grand = Math.max(0, subtotal - discountAmount);
  const alreadyPaid = Number(invoice?.amount_paid || 0);
  const owing = Math.max(0, grand - alreadyPaid);
  const balanceAfter = Math.max(0, grand - (alreadyPaid + Number(amountPaid || 0)));
  const canEditDiscount = alreadyPaid <= 0;

  useEffect(() => {
    if (open && invoice) {
      setDiscount(Number(invoice.discount_amount || 0));
      setAmountPaid(0);
      setMode(invoice.payment_mode || 'cash');
    }
  }, [open, invoice?.id]);

  useEffect(() => {
    if (open && invoice) {
      const g = Math.max(0, Number(invoice.total || 0) - Number(discount || 0));
      const ap = Number(invoice.amount_paid || 0);
      setAmountPaid(Math.max(0, g - ap));
    }
  }, [discount, open, invoice?.id]);

  if (!invoice) return null;

  const settle = async () => {
    const collected = Number(amountPaid || 0);
    if (collected < 0) {
      toast({ title: 'Amount paid cannot be negative', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const newPaid = alreadyPaid + collected;
      const finalPaid = newPaid >= grand ? grand : newPaid;
      const finalBalance = Math.max(0, grand - finalPaid);
      const settled = finalBalance <= 0;
      const payload = {
        discount_amount: discountAmount,
        amount_paid: finalPaid,
        balance: finalBalance,
        payment_mode: mode,
        status: settled ? 'paid' : 'unpaid',
      };
      let updated = await api.entities.Invoice.update(invoice.id, payload);
      let printedOk = true;
      if (settled) {
        // The invoice is printed only once payment is collected in full, and it
        // locks (printed: true) only after the print window actually opened.
        const res = await printInvoiceRecord(
          { ...invoice, ...payload, ...(updated || {}) },
          { isAdmin, printed: !!invoice?.printed, facility, onPrinted: (u) => { if (u) updated = u; } },
        );
        printedOk = res.ok;
      }
      toast({
        title: settled ? (printedOk ? 'Payment settled & invoice printed' : 'Payment settled') : 'Partial payment recorded',
        description: settled
          ? (printedOk ? 'Balance marked zero. The invoice is now locked.' : 'Allow pop-ups for this site, then print from View invoice.')
          : `Balance ${money(finalBalance)}`,
      });
      onSettled?.(updated);
      onOpenChange?.(false);
    } catch (e) {
      toast({ title: 'Could not record payment', description: invoiceErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 font-display text-xl">
            <Receipt className="h-5 w-5 text-primary" /> Collect Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl bg-muted/60 p-4 text-sm">
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Patient</span><span className="font-medium">{invoice.patient_name}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Doctor</span><span className="font-medium">{invoice.doctor_name}</span></div>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Invoiced amount</span><span className="font-medium">{money(subtotal)}</span></div>
            <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">PRA Tax @ {Number(invoice.tax_rate || 0)}% (included in consultation)</span><span className="font-medium">{money(tax)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Discount</span><span className="text-rose-700">- {money(discountAmount)}</span></div>
            )}
            <div className="flex justify-between px-4 py-2.5"><span className="font-display font-semibold">Total payable</span><span className="font-display font-semibold text-primary">{money(grand)}</span></div>
            {alreadyPaid > 0 && (
              <div className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted-foreground">Already paid</span><span className="text-emerald-700">{money(alreadyPaid)}</span></div>
            )}
            <p className="px-4 py-2 text-xs italic text-muted-foreground">{PRA_TAX_NOTE}</p>
          </div>

          {canEditDiscount && (
            <div className="space-y-1.5">
              <Label>Discount (Rs)</Label>
              <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Amount paid (Rs)</Label>
              <Input type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Mode of payment</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online_transfer">Online Transfer</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between rounded-xl bg-card px-4 py-2.5 text-sm border border-border">
            <span className="text-muted-foreground">Balance after payment</span>
            <span className={`font-semibold ${balanceAfter <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{money(balanceAfter)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>Cancel</Button>
          <Button onClick={settle} disabled={saving} className="gap-2">
            <Printer className="h-4 w-4" /> {saving ? 'Saving…' : (balanceAfter <= 0 ? 'Print & Settle' : 'Record Payment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}