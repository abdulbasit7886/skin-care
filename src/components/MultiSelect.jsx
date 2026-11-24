import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Chip-based multi-select. options: string[]; value: string[]; onChange: (string[])=>void
export default function MultiSelect({ label, options, value = [], onChange, placeholder = 'Select…', disabled = false }) {
  const toggle = (opt) => {
    if (disabled) return;
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div>
      {label && <label className="mb-2 block text-sm font-medium text-foreground/80">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.length === 0 && <p className="text-sm text-muted-foreground">{placeholder}</p>}
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              disabled={disabled}
              onClick={() => toggle(opt)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
                disabled && 'cursor-not-allowed opacity-50',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground/70 hover:border-primary/40 hover:bg-accent/40'
              )}
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}