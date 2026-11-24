import React, { useState } from 'react';
import { ChevronDown, Copy, Check, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const confidenceTone = (c) => {
  if (c == null) return null;
  if (c >= 80) return { label: `High confidence · ${Math.round(c)}%`, cls: 'bg-emerald-100 text-emerald-800' };
  if (c >= 60) return { label: `Fair confidence · ${Math.round(c)}%`, cls: 'bg-sky-100 text-sky-800' };
  return { label: `Low confidence — check carefully · ${Math.round(c)}%`, cls: 'bg-amber-100 text-amber-900' };
};

export const OcrConfidenceBadge = ({ confidence, className }) => {
  const tone = confidenceTone(confidence);
  if (!tone) return null;
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tone.cls, className)}>
      {tone.label}
    </span>
  );
};

// The raw text the OCR read from the chart, for checking and copying.
export default function OcrTextPanel({ text, confidence, pages }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  if (text == null) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* clipboard unavailable */ }
  };

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScanText className="h-4 w-4 text-primary" /> OCR text
          {pages ? <span className="text-xs font-normal text-muted-foreground">· {pages} {pages === 1 ? 'page' : 'pages'}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <OcrConfidenceBadge confidence={confidence} />
            <Button type="button" variant="outline" size="sm" onClick={copy} className="h-7 gap-1.5 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
            {text.trim() || 'No text was recognised on this scan.'}
          </pre>
        </div>
      )}
    </div>
  );
}
