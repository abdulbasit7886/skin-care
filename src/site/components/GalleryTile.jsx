import React, { useState } from 'react';

// A gallery photo. Until the clinic adds the image file, a quiet placeholder with the caption is shown.
export default function GalleryTile({ item, onOpen, className = '' }) {
  const [failed, setFailed] = useState(false);

  if (failed || !item.src) {
    return (
      <figure className={`relative overflow-hidden rounded-2xl bg-[var(--rose)] ${className}`}>
        <svg viewBox="0 0 200 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M0 70 Q50 60 100 70 T200 70 V150 H0 Z" fill="#f8ecef" />
          <path d="M0 108 Q50 116 100 108 T200 108 V150 H0 Z" fill="#e6bfcb" fillOpacity="0.55" />
        </svg>
        <figcaption className="absolute bottom-0 left-0 p-4 text-[15px] text-[var(--teal)]">
          {item.caption}
          <span className="block text-[13px] text-[var(--ink-soft)]">Photo coming soon</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className={`group relative overflow-hidden rounded-2xl bg-[var(--linen)] ${className}`}>
      <button
        type="button"
        onClick={onOpen}
        className="block h-full w-full text-left"
        aria-label={`View larger: ${item.caption}`}
      >
        <img
          src={item.src}
          alt={item.caption}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </button>
      <figcaption className="pointer-events-none absolute bottom-0 left-0 m-3 rounded-full bg-[var(--paper)]/90 px-3 py-1 text-[13px] text-[var(--teal)]">
        {item.caption}
      </figcaption>
    </figure>
  );
}
