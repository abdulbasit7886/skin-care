import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const emptyRow = () => ({ date: '', presenting_complaint: '', diagnosis: '', management_procedure: '' });

export default function VisitRowsEditor({ visits, onChange }) {
  const update = (i, key, val) => onChange(visits.map((v, idx) => (idx === i ? { ...v, [key]: val } : v)));
  const add = () => onChange([...visits, emptyRow()]);
  const remove = (i) => onChange(visits.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Label className="text-sm font-medium">Visit history rows</Label>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add row
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-3 w-32">Date</th>
              <th className="pb-2 pr-3">Presenting Complaint</th>
              <th className="pb-2 pr-3">Diagnosis</th>
              <th className="pb-2 pr-3">Management / Procedure</th>
              <th className="pb-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {visits.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No visit rows detected. Add one manually if needed.</td></tr>
            )}
            {visits.map((v, i) => (
              <tr key={i} className="align-top">
                <td className="pb-2 pr-3">
                  <Input type="date" value={v.date || ''} onChange={(e) => update(i, 'date', e.target.value)} className="h-9" />
                </td>
                <td className="pb-2 pr-3">
                  <Input value={v.presenting_complaint || ''} onChange={(e) => update(i, 'presenting_complaint', e.target.value)} />
                </td>
                <td className="pb-2 pr-3">
                  <Input value={v.diagnosis || ''} onChange={(e) => update(i, 'diagnosis', e.target.value)} />
                </td>
                <td className="pb-2 pr-3">
                  <Input value={v.management_procedure || ''} onChange={(e) => update(i, 'management_procedure', e.target.value)} />
                </td>
                <td className="pb-2 pl-1">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}