import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayISO, addDaysISO } from '@/lib/clinicDate';

// Dates are clinic-local 'YYYY-MM-DD' strings throughout the app.
const toDate = (iso) => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toISO = (date) => {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const fmt = (iso, withYear = true) => {
  if (!iso) return '';
  return toDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
};
const monthStart = (iso) => `${iso.slice(0, 7)}-01`;
const monthEnd = (iso) => {
  const d = toDate(monthStart(iso));
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000) + 1;

export const DATE_PRESETS = {
  today: { label: 'Today', range: (t) => ({ from: t, to: t }) },
  yesterday: { label: 'Yesterday', range: (t) => ({ from: addDaysISO(t, -1), to: addDaysISO(t, -1) }) },
  last7: { label: 'Last 7 days', range: (t) => ({ from: addDaysISO(t, -6), to: t }) },
  last30: { label: 'Last 30 days', range: (t) => ({ from: addDaysISO(t, -29), to: t }) },
  thisMonth: { label: 'This month', range: (t) => ({ from: monthStart(t), to: t }) },
  lastMonth: {
    label: 'Last month',
    range: (t) => { const prev = addDaysISO(monthStart(t), -1); return { from: monthStart(prev), to: monthEnd(prev) }; },
  },
  next7: { label: 'Next 7 days', range: (t) => ({ from: t, to: addDaysISO(t, 6) }) },
};

/** Human label for a range, e.g. "1 – 25 Nov 2026". */
export function formatRange(value) {
  if (!value?.from) return '';
  const { from, to } = value;
  if (!to || from === to) return fmt(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(0, 7) === to.slice(0, 7);
  if (sameMonth) return `${Number(from.slice(8))} – ${fmt(to)}`;
  return `${fmt(from, !sameYear)} – ${fmt(to)}`;
}

const useIsWide = () => {
  const query = '(min-width: 640px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
};

/**
 * One button that opens presets + a calendar for picking a date range.
 *
 * value: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } | null
 * onChange(range | null)
 * presets: keys of DATE_PRESETS (default today, yesterday, last 7, last 30, this month, last month)
 * maxDays: longest allowed range (e.g. 31)
 * clearable: show an "All dates" option that calls onChange(null)
 */
export function DateRangeFilter({
  value, onChange, presets = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth'],
  maxDays, clearable = false, placeholder = 'All dates', label = 'Date', className, align = 'start', disableFuture = false,
}) {
  const wide = useIsWide();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(undefined);
  const today = todayISO();

  useEffect(() => {
    if (open) setDraft(value?.from ? { from: toDate(value.from), to: toDate(value.to || value.from) } : undefined);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const activePreset = useMemo(() => {
    if (!value?.from) return null;
    return presets.find((k) => {
      const r = DATE_PRESETS[k]?.range(today);
      return r && r.from === value.from && r.to === (value.to || value.from);
    }) || null;
  }, [value, presets, today]);

  const pick = (range) => { onChange?.(range); setOpen(false); };

  const draftFrom = toISO(draft?.from);
  const draftTo = toISO(draft?.to || draft?.from);
  const tooLong = maxDays && draftFrom && draftTo && daysBetween(draftFrom, draftTo) > maxDays;

  const text = value?.from ? (activePreset ? `${DATE_PRESETS[activePreset].label} · ${formatRange(value)}` : formatRange(value)) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${text}`}
          className={cn(
            'inline-flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[15rem]',
            className
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className={cn('flex-1 truncate', !value?.from && 'text-muted-foreground')}>{text}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[calc(100vw-2rem)] max-w-[44rem] p-0 sm:w-auto" collisionPadding={16}>
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1.5 overflow-x-auto border-b border-border p-2 sm:w-40 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {clearable && (
              <PresetButton active={!value?.from} onClick={() => pick(null)}>All dates</PresetButton>
            )}
            {presets.map((k) => DATE_PRESETS[k] && (
              <PresetButton key={k} active={activePreset === k} onClick={() => pick(DATE_PRESETS[k].range(today))}>
                {DATE_PRESETS[k].label}
              </PresetButton>
            ))}
          </div>
          <div className="flex flex-col">
            <Calendar
              mode="range"
              numberOfMonths={wide ? 2 : 1}
              selected={draft}
              onSelect={setDraft}
              defaultMonth={draft?.from || toDate(addDaysISO(today, wide ? -30 : 0))}
              disabled={disableFuture ? { after: toDate(today) } : undefined}
              className="mx-auto"
            />
            <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className={cn('text-xs', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
                {tooLong ? `Choose at most ${maxDays} days.` : draftFrom ? formatRange({ from: draftFrom, to: draftTo }) : 'Pick a start and end date'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="flex-1 sm:flex-none">Cancel</Button>
                <Button size="sm" disabled={!draftFrom || tooLong} onClick={() => pick({ from: draftFrom, to: draftTo })} className="flex-1 sm:flex-none">Apply</Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

/**
 * Single-day picker with previous / next day arrows, matching DateRangeFilter.
 * value: 'YYYY-MM-DD', onChange(iso)
 */
export function DatePicker({ value, onChange, className, showArrows = true, showToday = true, label = 'Date' }) {
  const [open, setOpen] = useState(false);
  const today = todayISO();
  const nice = value ? toDate(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Pick a date';
  return (
    <div className={cn('flex w-full items-center gap-1.5 sm:w-auto', className)}>
      {showArrows && (
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label="Previous day" onClick={() => onChange?.(addDaysISO(value || today, -1))}>
          <ChevronDown className="h-4 w-4 rotate-90" />
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${nice}`}
            className="inline-flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-w-[13rem] sm:flex-none"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="flex-1 truncate text-left">{nice}</span>
            {value === today && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Today</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0" collisionPadding={16}>
          <Calendar mode="single" selected={toDate(value)} defaultMonth={toDate(value)} onSelect={(d) => { if (d) { onChange?.(toISO(d)); setOpen(false); } }} />
        </PopoverContent>
      </Popover>
      {showArrows && (
        <Button type="button" size="icon" variant="outline" className="h-10 w-10 shrink-0" aria-label="Next day" onClick={() => onChange?.(addDaysISO(value || today, 1))}>
          <ChevronDown className="h-4 w-4 -rotate-90" />
        </Button>
      )}
      {showToday && value !== today && (
        <Button type="button" variant="ghost" className="h-10 shrink-0 px-3" onClick={() => onChange?.(today)}>Today</Button>
      )}
    </div>
  );
}

/** Small "clear" chip used next to filters. */
export function ClearFiltersButton({ onClick, className }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className={cn('h-10 gap-1.5 text-muted-foreground', className)}>
      <X className="h-4 w-4" /> Clear
    </Button>
  );
}

export default DateRangeFilter;
