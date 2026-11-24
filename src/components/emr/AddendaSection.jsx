import React, { useEffect, useState } from 'react';
import { FilePlus2, Loader2, Clock } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatClinicDateTime } from '@/lib/clinicDate';

// Addenda: dated notes the attending doctor adds to a saved EMR. They never
// change the original record. The server stamps the date, time and doctor.
export default function AddendaSection({ emrId, canAdd = false, locked = false }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!emrId) return;
    let active = true;
    setLoading(true);
    api.entities.EMRAddendum.filter({ emr_id: emrId }, { sort: 'created_date', limit: 200 })
      .then((res) => { if (active) setItems(res.items || []); })
      .catch((e) => { if (active) toast({ title: 'Could not load addenda', description: e.message, variant: 'destructive' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [emrId]);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    try {
      const created = await api.entities.EMRAddendum.create({ emr_id: emrId, text: body });
      setItems((prev) => [...prev, created]);
      setText('');
      toast({ title: 'Addendum saved', description: `Recorded ${formatClinicDateTime(created?.created_date || new Date())}.` });
    } catch (e) {
      toast({ title: 'Could not save addendum', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!emrId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <FilePlus2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Addenda</h2>
        {items.length > 0 && <span className="text-xs text-muted-foreground">· {items.length}</span>}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {locked
          ? 'This record is locked. Add any missed information as an addendum — it is saved with the date and time and does not alter the original record.'
          : 'Add a dated note to this record. Addenda are permanent and cannot be edited or deleted.'}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading addenda…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No addenda yet.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatClinicDateTime(a.created_date)}</span>
                {a.doctor_name && <span>{a.doctor_name}</span>}
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">{a.text}</p>
            </li>
          ))}
        </ol>
      )}

      {canAdd && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Missed information, late results, clarifications…"
          />
          <div className="flex justify-end">
            <Button onClick={add} disabled={saving || !text.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Add addendum'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
