import React from 'react';
import { Link } from 'react-router-dom';
import { primaryBtn } from '@/site/components/buttons';
import { usePageTitle } from '@/site/SiteData';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <section className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <h1 className="text-[clamp(2.4rem,5vw,3.5rem)] leading-tight">This page does not exist</h1>
      <p className="mt-4 max-w-[52ch] text-[var(--ink-soft)]">
        The link may be out of date. Use the menu above, or go back to the home page.
      </p>
      <Link to="/" className={`${primaryBtn} mt-8`}>Go to the home page</Link>
    </section>
  );
}
