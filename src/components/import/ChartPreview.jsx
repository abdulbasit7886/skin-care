import React from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// A scanned chart shown on an A4 portrait sheet (210 × 297 mm).
// Images are fitted inside the page; PDFs use the browser's viewer when it can,
// otherwise a file card.
export default function ChartPreview({ url, file, pages, className }) {
  if (!url) return null;
  const isPdf = file ? file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '') : /\.pdf($|\?)/i.test(url);
  return (
    <div className={cn('mx-auto w-full max-w-sm', className)}>
      <div className="relative aspect-[210/297] w-full overflow-hidden rounded-sm border border-border bg-white shadow-[0_6px_24px_rgba(15,23,42,0.14)]">
        {isPdf ? (
          <object data={url} type="application/pdf" className="h-full w-full" aria-label="Chart PDF preview">
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-10 w-10 text-primary/60" />
              <p className="font-medium text-foreground">PDF{pages ? ` – ${pages} ${pages === 1 ? 'page' : 'pages'}` : ''}</p>
              <p className="text-xs">{file?.name || 'Scanned chart'}</p>
            </div>
          </object>
        ) : (
          <img src={url} alt="Scanned chart" className="h-full w-full object-contain" />
        )}
      </div>
      <p className="mt-2 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        A4 · {isPdf ? `PDF${pages ? ` – ${pages} ${pages === 1 ? 'page' : 'pages'}` : ''}` : 'Image'}
      </p>
    </div>
  );
}
