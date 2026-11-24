import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// The hero illustration: a cross-section of skin seen through an arch-shaped window,
// with its three layers labelled. The layers rise into place once on page load.
const W = 400;
const H = 540;

const wave = (y, amp, phase = 0, segments = 5) => {
  const step = W / segments;
  let d = `M0 ${y}`;
  for (let i = 0; i < segments; i += 1) {
    const x1 = i * step + step / 2;
    const y1 = y + (i % 2 === 0 ? -amp : amp) * (phase ? -1 : 1);
    d += ` Q${x1} ${y1} ${(i + 1) * step} ${y}`;
  }
  return d;
};

const band = (top, amp, phase) => `${wave(top, amp, phase)} L${W} ${H} L0 ${H} Z`;

const lobules = [
  [40, 452, 26], [98, 470, 30], [160, 448, 24], [214, 474, 32], [276, 452, 27], [338, 472, 30], [384, 446, 22],
  [62, 512, 28], [130, 520, 30], [196, 514, 26], [262, 522, 31], [326, 512, 27], [10, 498, 18],
];

const LABELS = [
  { y: 196, text: 'Epidermis' },
  { y: 318, text: 'Dermis' },
  { y: 470, text: 'Subcutis' },
];

export default function SkinLayers({ className = '' }) {
  const reduce = useReducedMotion();
  const rise = (i) =>
    reduce
      ? {}
      : {
          initial: { y: 60, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { duration: 0.9, delay: 0.15 + i * 0.18, ease: [0.22, 1, 0.36, 1] },
        };
  const fade = (i) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { duration: 0.6, delay: 1.0 + i * 0.12 },
        };

  return (
    <figure className={`relative ${className}`} aria-label="Illustration of the three layers of the skin: epidermis, dermis and subcutis">
      <div className="hs-arch relative w-full" style={{ aspectRatio: `${W} / ${H}`, background: '#f6efe9' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          {/* subcutis: deep teal with fat lobules */}
          <motion.g {...rise(2)}>
            <path d={band(410, 10, 1)} fill="#1e4842" />
            {lobules.map(([cx, cy, r]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#28594f" />
            ))}
          </motion.g>
          {/* dermis: pale rose with collagen fibres */}
          <motion.g {...rise(1)}>
            <path d={`${wave(238, 14, 0)} L${W} 418 L0 418 Z`} fill="#f8ecef" />
            {[280, 312, 344, 376].map((y, i) => (
              <path key={y} d={wave(y, 9, i % 2, 4)} fill="none" stroke="#7a2944" strokeOpacity="0.22" strokeWidth="1.2" />
            ))}
            {/* a hair follicle and gland */}
            <path d="M292 150 C 290 230, 300 300, 296 372" fill="none" stroke="#7a2944" strokeOpacity="0.45" strokeWidth="2" />
            <ellipse cx="296" cy="378" rx="9" ry="12" fill="#e6bfcb" />
            <ellipse cx="318" cy="300" rx="11" ry="8" fill="#e6bfcb" fillOpacity="0.8" />
          </motion.g>
          {/* epidermis */}
          <motion.g {...rise(0)}>
            <path d={`${wave(172, 10, 1)} L${W} 246 L0 246 Z`} fill="#e6bfcb" />
            <path d={wave(172, 10, 1)} fill="none" stroke="#7a2944" strokeOpacity="0.35" strokeWidth="1.5" />
          </motion.g>
        </svg>
      </div>

      {/* Labels sit outside the arch on wide screens, like an anatomical plate. */}
      <div className="pointer-events-none absolute inset-y-0 -right-2 hidden translate-x-full lg:block" aria-hidden="true">
        {LABELS.map((l, i) => (
          <motion.div
            key={l.text}
            {...fade(i)}
            className="absolute flex items-center gap-2 text-[13px] text-[var(--ink-soft)]"
            style={{ top: `${(l.y / H) * 100}%`, transform: 'translateY(-50%)' }}
          >
            <span className="block h-px w-8 bg-[var(--ink-soft)] opacity-50" />
            {l.text}
          </motion.div>
        ))}
      </div>
      <figcaption className="mt-3 flex justify-between text-[13px] text-[var(--ink-soft)] lg:hidden">
        {LABELS.map((l) => <span key={l.text}>{l.text}</span>)}
      </figcaption>
    </figure>
  );
}
