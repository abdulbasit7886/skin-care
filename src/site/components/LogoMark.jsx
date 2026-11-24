import React from 'react';

// A miniature of the hero arch: three skin layers in an arch window.
export default function LogoMark({ size = 34, logoUrl = '' }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" width={size} height={size} className="h-auto shrink-0 object-contain" style={{ width: size }} />;
  }
  return (
    <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 32 40" aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id="hs-logo-arch">
          <path d="M0 16 A16 16 0 0 1 32 16 V38 a2 2 0 0 1 -2 2 H2 a2 2 0 0 1 -2 -2 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#hs-logo-arch)">
        <rect width="32" height="40" fill="#f6efe9" />
        <path d="M0 15 Q8 12 16 15 T32 15 V40 H0 Z" fill="#e6bfcb" />
        <path d="M0 20 Q8 23 16 20 T32 20 V40 H0 Z" fill="#f8ecef" />
        <path d="M0 30 Q8 28 16 30 T32 30 V40 H0 Z" fill="#1e4842" />
      </g>
    </svg>
  );
}
