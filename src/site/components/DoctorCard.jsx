import React, { useState } from 'react';
import { initialsOf } from '@/site/SiteData';

const fullName = (d) => [d.title, d.name].filter(Boolean).join(' ').replace(/^(Dr\.?)\s+\1\s+/i, '$1 ');

// Arch-framed portrait, or the doctor's initials when no photo is available.
export function DoctorPortrait({ doctor, className = '' }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = doctor.photo_url && !failed;
  return (
    <div className={`hs-arch relative aspect-[4/5] w-full bg-[var(--rose)] ${className}`}>
      {showPhoto ? (
        <img
          src={doctor.photo_url}
          alt={`Portrait of ${fullName(doctor)}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-end justify-center pb-[18%]" aria-hidden="true">
          <span className="font-display text-[clamp(3rem,8vw,4.5rem)] font-light leading-none text-[var(--plum)]">
            {initialsOf(doctor.name) || 'Dr'}
          </span>
        </div>
      )}
    </div>
  );
}

export default function DoctorCard({ doctor, showBio = true, wide = false }) {
  // `wide` is used when there is only one doctor: portrait beside the text instead of a lone column.
  if (wide) {
    return (
      <article className="grid items-end gap-8 sm:grid-cols-[minmax(0,300px)_1fr] sm:gap-12">
        <DoctorPortrait doctor={doctor} className="max-w-[260px] sm:max-w-none" />
        <div className="pb-2">
          <h3 className="text-[clamp(1.75rem,3vw,2.25rem)] leading-tight">{fullName(doctor)}</h3>
          {doctor.specialization && <p className="mt-1 text-[var(--plum)]">{doctor.specialization}</p>}
          {doctor.bio && <p className="mt-4 max-w-[52ch] text-[var(--ink-soft)]">{doctor.bio}</p>}
        </div>
      </article>
    );
  }
  return (
    <article className="flex flex-col">
      <DoctorPortrait doctor={doctor} />
      <h3 className="mt-5 text-[1.45rem] leading-snug">{fullName(doctor)}</h3>
      {doctor.specialization && <p className="mt-1 text-[15px] text-[var(--plum)]">{doctor.specialization}</p>}
      {showBio && doctor.bio && <p className="mt-3 max-w-[48ch] text-[15px] text-[var(--ink-soft)]">{doctor.bio}</p>}
    </article>
  );
}

export { fullName };
