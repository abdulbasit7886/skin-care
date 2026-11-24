import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTE_TAG, SHORT } from '@/lib/prescription';

const dash = '—';

export default function PrescriptionGrid({ items, editingId, onEdit, onDelete, readOnly = false }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No medicines added yet — add the first one above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">#</th>
            <th className="px-3 py-2 text-left font-medium">Medicine</th>
            <th className="px-3 py-2 text-left font-medium">Route</th>
            <th className="px-3 py-2 text-left font-medium">Dose</th>
            <th className="px-3 py-2 text-left font-medium">Frequency</th>
            <th className="px-3 py-2 text-left font-medium">Duration</th>
            <th className="px-3 py-2 text-left font-medium">Instructions</th>
            {!readOnly && <th className="px-3 py-2 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const structured = Boolean(item.form || item.route);
            return (
              <tr
                key={item.id}
                className={`border-t border-border align-top ${editingId === item.id ? 'bg-accent/40' : ''}`}
              >
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">
                  {structured
                    ? [SHORT[item.form] || item.form, item.medicine, item.strength].filter(Boolean).join(' ')
                    : item.line}
                </td>
                <td className="px-3 py-2">{ROUTE_TAG[item.route] || item.route || dash}</td>
                <td className="px-3 py-2">{item.dose || dash}</td>
                <td className="px-3 py-2">{item.frequency || dash}</td>
                <td className="px-3 py-2">{item.duration ? `${item.duration} ${item.durationUnit}` : dash}</td>
                <td className="px-3 py-2">{item.instructions || dash}</td>
                {!readOnly && (
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" title="Edit" onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}