import React from 'react';

const TONES = {
  primary: 'text-primary',
  amber: 'text-amber-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  zinc: 'text-zinc-700',
};

export default function SummaryCard({ label, value, tone = 'primary' }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${TONES[tone]}`}>{value}</p>
    </div>
  );
}