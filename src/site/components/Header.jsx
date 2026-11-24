import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LockKeyhole, Menu, X } from 'lucide-react';
import LogoMark from '@/site/components/LogoMark';
import { useSiteData } from '@/site/SiteData';

export const NAV = [
  { to: '/about', label: 'About' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact us' },
];

// Staff sign in to the EMR portal, which is a separate app under /portal.
export const EMR_LOGIN_URL = '/portal/login';

const linkClass = ({ isActive }) =>
  `relative py-1 text-[15px] transition-colors ${
    isActive
      ? 'text-[var(--teal)] after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-[var(--plum)]'
      : 'text-[var(--ink-soft)] hover:text-[var(--teal)]'
  }`;

export default function Header() {
  const { clinic } = useSiteData();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--paper)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/85">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={`${clinic.name}, home`}>
          <LogoMark logoUrl={clinic.logo_url} />
          <span className="truncate font-display text-[19px] leading-tight text-[var(--teal)]">{clinic.name}</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 lg:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <a
          href={EMR_LOGIN_URL}
          className="hidden items-center gap-2 rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-medium text-[var(--paper)] transition-colors hover:bg-[var(--teal-deep)] lg:inline-flex"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          EMR login
        </a>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--teal)] hover:bg-[var(--linen)] lg:hidden"
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav id="site-mobile-nav" aria-label="Main" className="border-t border-[var(--hairline)] bg-[var(--paper)] lg:hidden">
          <ul className="mx-auto max-w-6xl px-5 py-3 sm:px-8">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block border-b border-[var(--hairline)] py-3 text-base ${isActive ? 'text-[var(--plum)]' : 'text-[var(--ink)]'}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li className="pt-4 pb-2">
              <a
                href={EMR_LOGIN_URL}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--teal)] px-4 py-3 text-sm font-medium text-[var(--paper)]"
              >
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                EMR login
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
