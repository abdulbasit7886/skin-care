import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/site/components/PageHeader';
import { primaryBtn } from '@/site/components/buttons';
import { usePageTitle, useSiteData } from '@/site/SiteData';

function ServiceList({ title, items }) {
  if (!items.length) return null;
  return (
    <section className="grid gap-8 border-t border-[var(--hairline)] py-12 md:grid-cols-[0.7fr_1.3fr]">
      <h2 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-tight">{title}</h2>
      <ul className="grid gap-x-10 sm:grid-cols-2">
        {items.map((s) => (
          <li key={s.id || s.name} className="border-b border-[var(--hairline)] py-4">
            <h3 className="text-[1.2rem] leading-snug">{s.name}</h3>
            {s.description && <p className="mt-1 text-[15px] text-[var(--ink-soft)]">{s.description}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Services() {
  usePageTitle('Services');
  const { services, procedures, loading } = useSiteData();
  return (
    <>
      <PageHeader
        title="Services and treatments"
        lead="Treatment always starts with a consultation. Your doctor will recommend what suits your skin and explain the cost before anything is done."
      />
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-4 sm:px-8 lg:pb-20">
        {loading ? (
          <p className="py-12 text-[var(--ink-soft)]" aria-busy="true">Loading services…</p>
        ) : (
          <>
            <ServiceList title="Consultations and treatments" items={services} />
            <ServiceList title="Procedures" items={procedures} />
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--hairline)] pt-8">
          <p className="text-[var(--ink-soft)]">Not sure what you need? Book a consultation and we will advise.</p>
          <Link to="/contact" className={primaryBtn}>Book a consultation</Link>
        </div>
      </div>
    </>
  );
}
