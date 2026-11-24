import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Phone } from 'lucide-react';
import SkinLayers from '@/site/components/SkinLayers';
import DoctorCard from '@/site/components/DoctorCard';
import Stars from '@/site/components/Stars';
import { WhatsappIcon } from '@/site/components/SocialIcons';
import { primaryBtn, secondaryBtn } from '@/site/components/buttons';
import { concerns, testimonials } from '@/site/content';
import { mapsUrl, telUrl, usePageTitle, useSiteData, whatsappUrl } from '@/site/SiteData';

function Hero() {
  const { clinic } = useSiteData();
  const reduce = useReducedMotion();
  const appear = (delay) =>
    reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] } };
  const wa = whatsappUrl(clinic.whatsapp, 'Hello, I would like to book a consultation.');

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-[1.15fr_0.85fr] md:pt-20 lg:gap-20 lg:pb-24">
      <div>
        <motion.h1 {...appear(0)} className="text-[clamp(2.75rem,6.4vw,5rem)] leading-[0.98]">
          {clinic.name}
        </motion.h1>
        <motion.p {...appear(0.12)} className="mt-6 max-w-[30ch] font-display text-[clamp(1.35rem,2.4vw,1.75rem)] font-light leading-snug text-[var(--plum)]">
          {clinic.tagline}
        </motion.p>
        <motion.p {...appear(0.22)} className="mt-5 max-w-[56ch] text-[var(--ink-soft)]">
          {clinic.intro}
        </motion.p>
        <motion.div {...appear(0.32)} className="mt-9 flex flex-wrap gap-3">
          <Link to="/contact" className={primaryBtn}>Book a consultation</Link>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
              <WhatsappIcon width={18} height={18} />
              Message us on WhatsApp
            </a>
          )}
        </motion.div>
      </div>
      <div className="mx-auto w-full max-w-[340px] md:max-w-none lg:mr-28">
        <SkinLayers />
      </div>
    </section>
  );
}

function WhatWeTreat() {
  return (
    <section className="border-t border-[var(--hairline)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[0.8fr_1.2fr] lg:py-24">
        <div>
          <h2 className="text-[clamp(2rem,3.6vw,2.75rem)] leading-tight">What we treat</h2>
          <p className="mt-4 max-w-[38ch] text-[var(--ink-soft)]">
            Medical skin conditions and cosmetic concerns, assessed by a dermatologist before any treatment begins.
          </p>
          <Link to="/services" className="hs-link mt-6 inline-block">See all services</Link>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {concerns.map((c) => (
            <li key={c.name} className="border-t border-[var(--hairline)] py-5">
              <h3 className="text-[1.3rem] leading-snug">{c.name}</h3>
              <p className="mt-1 text-[15px] text-[var(--ink-soft)]">{c.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DoctorsPreview() {
  const { doctors, loading } = useSiteData();
  const shown = doctors.slice(0, 3);
  return (
    <section className="bg-[var(--linen)]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[clamp(2rem,3.6vw,2.75rem)] leading-tight">Your doctors</h2>
          <Link to="/doctors" className="hs-link">Meet the doctors</Link>
        </div>
        {loading ? (
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading doctors">
            {[0, 1, 2].map((i) => <div key={i} className="hs-arch aspect-[4/5] animate-pulse bg-[var(--rose)]/60 motion-reduce:animate-none" />)}
          </div>
        ) : shown.length === 1 ? (
          <div className="mt-10"><DoctorCard doctor={shown[0]} wide /></div>
        ) : (
          <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => <DoctorCard key={d.id || d.name} doctor={d} showBio={false} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function Quote() {
  const t = testimonials[0];
  if (!t) return null;
  return (
    <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:py-24">
      <figure>
        <Stars rating={t.rating} />
        <blockquote className="mt-5 font-display text-[clamp(1.5rem,3vw,2.15rem)] font-light leading-[1.35] text-[var(--teal)]">
          “{t.text}”
        </blockquote>
        <figcaption className="mt-5 text-[15px] text-[var(--ink-soft)]">
          {t.name}
          {t.sample && <span className="ml-2 rounded-full bg-[var(--rose)] px-2 py-0.5 text-[12px] text-[var(--plum)]">Sample review</span>}
        </figcaption>
      </figure>
      <Link to="/testimonials" className="hs-link mt-8 inline-block">Read more patient reviews</Link>
    </section>
  );
}

function Visit() {
  const { clinic } = useSiteData();
  return (
    <section className="border-t border-[var(--hairline)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 lg:py-24">
        <div>
          <h2 className="text-[clamp(2rem,3.6vw,2.75rem)] leading-tight">Visit the clinic</h2>
          <address className="mt-4 max-w-[40ch] not-italic text-[var(--ink-soft)]">{clinic.address}</address>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={telUrl(clinic.phone)} className={primaryBtn}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call {clinic.phone}
            </a>
            <a href={mapsUrl(clinic.address)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>Get directions</a>
          </div>
        </div>
        <div>
          <h3 className="text-[1.3rem]">Opening hours</h3>
          <dl className="mt-3">
            {clinic.hours.map((h) => (
              <div key={h.days} className="flex justify-between gap-6 border-t border-[var(--hairline)] py-3">
                <dt>{h.days}</dt>
                <dd className="text-right text-[var(--ink-soft)]">{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  usePageTitle('');
  return (
    <>
      <Hero />
      <WhatWeTreat />
      <DoctorsPreview />
      <Quote />
      <Visit />
    </>
  );
}
