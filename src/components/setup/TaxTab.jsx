import React, { useEffect, useState } from 'react';
import { Percent, Plus, Lock, History } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { todayISO } from '@/lib/clinicDate';
import { getEffectiveTaxRate } from '@/lib/tax';

const todayStr = () => todayISO();
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function TaxTab({ canEditCharges }) {
  const { toast } = useToast();
  const [rates, setRates] = useState([]);
  const [current, setCurrent] = useState(0);
  const [form, setForm] = useState({ rate: 0, effective_date: todayStr(), note: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [res, eff] = await Promise.all([
        api.entities.TaxRate.list({ sort: '-effective_date', limit: 100 }),
        getEffectiveTaxRate(todayStr()),
      ]);
      setRates(res.items || []);
      setCurrent(eff);
    } catch (e) {
      toast({ title: 'Could not load tax rates', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const rate = Number(form.rate);
    if (isNaN(rate) || rate < 0) {
      toast({ title: 'Tax rate must be 0 or greater', variant: 'destructive' });
      return;
    }
    if (!form.effective_date) {
      toast({ title: 'Effective date is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.entities.TaxRate.create({ rate, effective_date: form.effective_date, note: form.note });
      toast({ title: 'Tax rate saved', description: `${rate}% from ${fmtDate(form.effective_date)}` });
      setForm({ rate: 0, effective_date: todayStr(), note: '' });
      load();
    } catch (err) {
      toast({ title: 'Could not save tax rate', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">PRA Tax on Consultations</h2>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rate effective today</p>
            <p className="font-display text-3xl font-semibold text-primary">{current}%</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          PRA tax is charged on consultation fees only, and is inclusive: the fee already contains it, so it is shown on the invoice and reported monthly but never added on top. Invoices created from the effective date onward use this rate; past invoices keep the rate saved at their creation. When no rate is saved, 8% applies.
        </p>
      </div>

      {!canEditCharges ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Lock className="h-3.5 w-3.5" /> Only administrators can change the tax rate.
        </div>
      ) : loading ? null : (
        <form onSubmit={save} className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 font-display text-base font-semibold">Set a new tax rate</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tax rate (%)</Label>
              <Input type="number" min="0" step="0.1" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Effective from</Label>
              <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Sales tax activation" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2">
              <Plus className="h-4 w-4" /> {saving ? 'Saving…' : 'Save tax rate'}
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card">
        <div className="inline-flex items-center gap-2 border-b border-border px-5 py-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">Rate history</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rates.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No tax rates saved — the default PRA tax of 8% applies.</div>
        ) : (
          <div className="divide-y divide-border">
            {rates.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium">{Number(r.rate)}%</p>
                  <p className="text-xs text-muted-foreground">Effective {fmtDate(r.effective_date)}{r.note ? ` · ${r.note}` : ''}</p>
                </div>
                {Number(r.rate) === current && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Active</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}