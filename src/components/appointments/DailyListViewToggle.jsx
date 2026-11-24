import React from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'worklist', label: 'Daily Worklist' },
  { value: 'dashboard', label: 'Dashboard' },
];

// Radio switcher shown to doctors and front desk staff on the Daily List page.
export default function DailyListViewToggle({ value, onChange }) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className="flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            value === opt.value ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-accent'
          )}
        >
          <RadioGroupItem value={opt.value} />
          {opt.label}
        </label>
      ))}
    </RadioGroup>
  );
}