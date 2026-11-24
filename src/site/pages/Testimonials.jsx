import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/site/components/PageHeader';
import Stars from '@/site/components/Stars';
import { primaryBtn } from '@/site/components/buttons';
import { testimonials } from '@/site/content';
import { usePageTitle } from '@/site/SiteData';

export default function Testimonials() {
  usePageTitle('Testimonials');
  const hasSamples = testimonials.some((t) => t.sample);
  return (
    <>
      <PageHeader
        title="What patients say"
        lead={hasSamples ? 'Patient reviews will be published here.' : 'Reviews shared with permission by patients of the clinic.'}
      />
      <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:py-16">
        {testimonials.length === 0 ? (
          <p className="text-[var(--ink-soft)]">Patient reviews will appear here soon.</p>
        ) : (
          <ul>
            {testimonials.map((t, i) => (
              <li key={`${t.name}-${i}`} className="border-b border-[var(--hairline)] py-10 first:pt-4">
                <figure>
                  <Stars rating={t.rating} />
                  <blockquote className="mt-4 font-display text-[clamp(1.3rem,2.4vw,1.65rem)] font-light leading-[1.45] text-[var(--teal)]">
                    “{t.text}”
                  </blockquote>
                  <figcaption className="mt-4 text-[15px] text-[var(--ink-soft)]">
                    {t.name}
                    {t.sample && <span className="ml-2 rounded-full bg-[var(--rose)] px-2 py-0.5 text-[12px] text-[var(--plum)]">Sample review</span>}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-[var(--ink-soft)]">Been treated with us? We would like to hear how it went.</p>
          <Link to="/contact" className={primaryBtn}>Share your experience</Link>
        </div>
      </section>
    </>
  );
}
