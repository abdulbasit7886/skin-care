import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/site/components/PageHeader';
import { primaryBtn } from '@/site/components/buttons';
import { about } from '@/site/content';
import { usePageTitle, useSiteData } from '@/site/SiteData';

export default function About() {
  usePageTitle('About');
  const { clinic } = useSiteData();
  return (
    <>
      <PageHeader title={about.heading} lead={clinic.tagline} />

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.2fr_0.8fr] lg:py-20">
        <div className="space-y-5 text-[1.05rem] leading-[1.75]">
          {about.paragraphs.map((p) => <p key={p.slice(0, 32)} className="max-w-[62ch]">{p}</p>)}
        </div>
        <aside className="self-start rounded-2xl bg-[var(--rose)] p-7">
          <h2 className="text-[1.5rem]">{about.firstVisit.title}</h2>
          <p className="mt-3 text-[15px] text-[var(--ink-soft)]">{about.firstVisit.text}</p>
          <Link to="/contact" className={`${primaryBtn} mt-6`}>Book a consultation</Link>
        </aside>
      </section>

      <section className="border-t border-[var(--hairline)] bg-[var(--linen)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <h2 className="text-[clamp(2rem,3.6vw,2.75rem)] leading-tight">How we work</h2>
          <dl className="mt-10 grid gap-x-12 gap-y-2 md:grid-cols-2">
            {about.values.map((v) => (
              <div key={v.title} className="border-t border-[var(--hairline)] py-6">
                <dt className="font-display text-[1.35rem] text-[var(--teal)]">{v.title}</dt>
                <dd className="mt-2 max-w-[48ch] text-[var(--ink-soft)]">{v.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
