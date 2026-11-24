import React from 'react';

// Title block for inner pages: a large display heading with an optional lead paragraph.
export default function PageHeader({ title, lead, children }) {
  return (
    <div className="border-b border-[var(--hairline)] bg-[var(--linen)]">
      <div className="mx-auto max-w-6xl px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20">
        <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,3.75rem)] leading-[1.05]">{title}</h1>
        {lead && <p className="mt-5 max-w-[60ch] text-lg text-[var(--ink-soft)]">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
