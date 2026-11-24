import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard page shell + header so every portal page has the same width, padding and title layout.
 *
 * <Page>                       — max-width container with responsive padding
 *   <PageHeader icon={Users} title="Registration" description="…" actions={<Button/>} />
 *   …content
 * </Page>
 */
export function Page({ children, className, width = 'max-w-6xl' }) {
  return <div className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10', width, className)}>{children}</div>;
}

export function PageHeader({ icon: Icon, eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-primary/70">{eyebrow}</p>}
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          {Icon && <Icon className="h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" aria-hidden="true" />}
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>}
    </div>
  );
}

/** Card-style section with an optional title row. */
export function Section({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card', className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export default PageHeader;
