import React, { useEffect, useRef, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PrescriptionGrid from '@/components/emr/PrescriptionGrid';
import {
  ROUTE_FORMS,
  FREQUENCIES,
  DURATION_UNITS,
  DOSES,
  LIQUID_FORMS,
  LIQUID_DOSES,
  emptyMedicine,
  medicineFields,
  nextId,
  composeLine,
  parsePrescription,
  serializeItems,
} from '@/lib/prescription';

const pickFields = (item) =>
  medicineFields.reduce((acc, key) => ({ ...acc, [key]: item[key] ?? emptyMedicine[key] }), {});

export default function PrescriptionBuilder({ value, onChange, flushRef, readOnly = false }) {
  const [items, setItems] = useState(() => parsePrescription(value));
  const [draft, setDraft] = useState({ ...emptyMedicine });
  const [editingId, setEditingId] = useState(null);
  // The row as it was before editing, so Cancel can put it back untouched.
  const [editingOrigin, setEditingOrigin] = useState(null);
  const lastEmitted = useRef(value || '');

  // Re-read the saved prescription when it arrives from the server.
  useEffect(() => {
    if ((value || '') !== lastEmitted.current) {
      setItems(parsePrescription(value));
      lastEmitted.current = value || '';
    }
  }, [value]);

  // Keep the saved prescription text in step with the grid.
  useEffect(() => {
    const text = serializeItems(items);
    if (text === lastEmitted.current) return;
    lastEmitted.current = text;
    onChange(text);
  }, [items]);

  const set = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const forms = ROUTE_FORMS[draft.route] || [];

  // Topical doses are typed; liquids are measured in spoons; solids are counted.
  const doseMode = (route, form) => {
    if (route === 'Topical') return 'custom';
    return LIQUID_FORMS.includes(form) ? 'liquid' : 'solid';
  };
  const doseModeNow = doseMode(draft.route, draft.form);
  const doseOptions = doseModeNow === 'liquid' ? LIQUID_DOSES : DOSES;
  // A stat dose is given once, so a course length makes no sense.
  const singleDose = draft.frequency === 'Stat';

  const buildEntry = (id) => ({ ...pickFields(draft), line: composeLine(draft), id });

  // A row being edited follows the composer as the doctor types, so the saved
  // prescription always holds the edit — nothing waits on a button press.
  useEffect(() => {
    if (!editingId || !draft.medicine.trim()) return;
    setItems((list) => list.map((item) => (item.id === editingId ? buildEntry(editingId) : item)));
  }, [draft, editingId]);

  // Applies the composer's current contents to a list of medicines.
  const applyDraft = (list) =>
    editingId
      ? list.map((item) => (item.id === editingId ? buildEntry(editingId) : item))
      : [...list, buildEntry(nextId())];

  const commit = () => {
    if (!draft.medicine.trim()) return;
    setItems(applyDraft);
    setDraft({ ...emptyMedicine });
    setEditingId(null);
    setEditingOrigin(null);
  };

  // Lets the parent fold a medication still sitting in the composer into the
  // saved prescription, so pressing Save never drops it.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = () => {
      // An edit is already part of the prescription as it is typed.
      if (editingId) return serializeItems(items);
      if (!draft.medicine.trim()) return null;
      const nextItems = [...items, buildEntry(nextId())];
      setItems(nextItems);
      setDraft({ ...emptyMedicine });
      return serializeItems(nextItems);
    };
  });

  const startEdit = (item) => {
    setDraft(pickFields(item));
    setEditingId(item.id);
    setEditingOrigin(item);
  };

  // Cancel puts the row back exactly as it was before the edit.
  const cancelEdit = () => {
    if (editingOrigin) {
      setItems((list) => list.map((item) => (item.id === editingOrigin.id ? editingOrigin : item)));
    }
    setDraft({ ...emptyMedicine });
    setEditingId(null);
    setEditingOrigin(null);
  };

  const remove = (id) => {
    setItems((list) => list.filter((item) => item.id !== id));
    if (editingId === id) {
      setDraft({ ...emptyMedicine });
      setEditingId(null);
      setEditingOrigin(null);
    }
  };

  if (readOnly) return <PrescriptionGrid items={items} readOnly />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {editingId ? 'Edit medication' : 'Add medication'}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="route">Route</Label>
            <Select value={draft.route} onValueChange={(v) => setDraft((d) => ({ ...d, route: v, form: '', dose: '' }))}>
              <SelectTrigger id="route"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {Object.keys(ROUTE_FORMS).map((route) => (
                  <SelectItem key={route} value={route}>{route}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="form">Dosage form</Label>
            <Select
              value={draft.form}
              onValueChange={(v) => setDraft((d) => ({
                ...d,
                form: v,
                dose: doseMode(d.route, v) === doseMode(d.route, d.form) ? d.dose : '',
              }))}
              disabled={!draft.route}
            >
              <SelectTrigger id="form"><SelectValue placeholder={draft.route ? 'Select' : 'Pick route'} /></SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form} value={form}>{form}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="medicine">Medicine</Label>
            <Input id="medicine" value={draft.medicine} onChange={(e) => set('medicine', e.target.value)} placeholder="e.g. Doxycycline" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="strength">Strength</Label>
            <Input id="strength" value={draft.strength} onChange={(e) => set('strength', e.target.value)} placeholder="e.g. 100 mg / 0.05%" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="dose">Dose</Label>
            {doseModeNow === 'custom' ? (
              <Input
                id="dose"
                value={draft.dose}
                onChange={(e) => set('dose', e.target.value)}
                placeholder="e.g. thin layer, 1 FTU, pea-sized"
              />
            ) : (
              <Select value={draft.dose} onValueChange={(v) => set('dose', v)}>
                <SelectTrigger id="dose"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {doseOptions.map((dose) => (
                    <SelectItem key={dose} value={dose}>{dose}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="frequency">Frequency</Label>
            <Select
              value={draft.frequency}
              onValueChange={(v) => setDraft((d) => ({ ...d, frequency: v, duration: v === 'Stat' ? '' : d.duration }))}
            >
              <SelectTrigger id="frequency"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="duration">Duration</Label>
            <div className="flex gap-2">
              <Input
                id="duration"
                type="number"
                min="1"
                value={draft.duration}
                onChange={(e) => set('duration', e.target.value)}
                placeholder={singleDose ? 'Single dose' : 'e.g. 5'}
                className="w-20"
                disabled={singleDose}
              />
              <Select value={draft.durationUnit} onValueChange={(v) => set('durationUnit', v)} disabled={singleDose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="instructions">Instructions</Label>
            <Input id="instructions" value={draft.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. after meals" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {editingId && (
            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} className="gap-1.5">
              <X className="h-4 w-4" /> Cancel
            </Button>
          )}
          <Button type="button" size="sm" onClick={commit} disabled={!draft.medicine.trim()} className="gap-1.5">
            {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Update medication' : 'Add to prescription'}
          </Button>
        </div>
      </div>

      <PrescriptionGrid items={items} editingId={editingId} onEdit={startEdit} onDelete={remove} />
    </div>
  );
}