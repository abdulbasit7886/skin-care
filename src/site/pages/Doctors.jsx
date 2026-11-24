import React from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/site/components/PageHeader';
import DoctorCard from '@/site/components/DoctorCard';
import { primaryBtn } from '@/site/components/buttons';
import { usePageTitle, useSiteData } from '@/site/SiteData';

export default function Doctors() {
  usePageTitle('Doctors');
  const { doctors, loading } = useSiteData();
  return (
    <>
      <PageHeader
        title="Our doctors"
        lead="Every patient is seen by a doctor, and the doctor who starts your treatment follows it through."
      />
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
        {loading ? (
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading doctors">
            {[0, 1, 2].map((i) => <div key={i} className="hs-arch aspect-[4/5] animate-pulse bg-[var(--rose)]/60 motion-reduce:animate-none" />)}
          </div>
        ) : doctors.length === 1 ? (
          <DoctorCard doctor={doctors[0]} wide />
        ) : (
          <div className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((d) => <DoctorCard key={d.id || d.name} doctor={d} />)}
          </div>
        )}
        <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--hairline)] pt-8">
          <p className="text-[var(--ink-soft)]">Want to see a specific doctor? Mention their name when you book.</p>
          <Link to="/contact" className={primaryBtn}>Book a consultation</Link>
        </div>
      </section>
    </>
  );
}
