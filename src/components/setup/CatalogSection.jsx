import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function CatalogSection({ title, entity, singular, withPrice, items, onChange, canEditCharges = true }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const payload = withPrice
        ? { name: name.trim(), price: price === '' ? 0 : Number(price), active: true }
        : { name: name.trim(), active: true };
      const created = await api.entities[entity].create(payload);
      onChange([...items, created]);
      setName('');
      setPrice('');
      toast({ title: `${singular} added` });
    } catch (e) {
      toast({ title: 'Could not add', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item) => {
    try {
      const updated = await api.entities[entity].update(item.id, { active: item.active === false });
      onChange(items.map((i) => (i.id === item.id ? updated : i)));
    } catch (e) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    }
  };

  const remove = async (item) => {
    if (!confirm(`Remove "${item.name}"?`)) return;
    try {
      await api.entities[entity].delete(item.id);
      onChange(items.filter((i) => i.id !== item.id));
    } catch (e) {
      toast({ title: 'Could not delete', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${singular} name`} />
        </div>
        {withPrice && (
          <div className="w-32 space-y-1.5">
            <Label>Charge (Rs)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canEditCharges} placeholder={canEditCharges ? '' : 'Admin only'} />
          </div>
        )}
        <Button onClick={add} disabled={busy} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              item.active === false ? 'border-border bg-muted/40 opacity-60' : 'border-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.name}</span>
              {withPrice && item.price != null && <span className="text-xs text-muted-foreground">Rs {item.price}</span>}
              {item.active === false && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => toggle(item)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  item.active === false ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted hover:bg-accent'
                }`}
              >
                {item.active === false ? 'Reactivate' : 'Deactivate'}
              </button>
              <button onClick={() => remove(item)} className="rounded-md p-1.5 text-destructive hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}