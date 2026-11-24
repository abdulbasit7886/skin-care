import React from 'react';
import { Link } from 'react-router-dom';
import { social } from '@/site/content';
import { mapsUrl, telUrl, useSiteData, whatsappUrl } from '@/site/SiteData';
import { NAV, EMR_LOGIN_URL } from '@/site/components/Header';
import { FacebookIcon, InstagramIcon, WhatsappIcon, YoutubeIcon } from '@/site/components/SocialIcons';

export default function Footer() {
  const { clinic } = useSiteData();
  const wa = whatsappUrl(clinic.whatsapp);
  const socials = [
    { href: social.instagram, label: 'Instagram', Icon: InstagramIcon },
    { href: social.youtube, label: 'YouTube', Icon: YoutubeIcon },
    { href: wa, label: 'WhatsApp', Icon: WhatsappIcon },
    { href: social.facebook, label: 'Facebook', Icon: FacebookIcon },
  ].filter((s) => s.href);

  return (
    <footer className="mt-auto bg-[var(--teal-deep)] text-[#e9e3da]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-2xl text-[var(--paper)]">{clinic.name}</p>
          <p className="mt-2 max-w-sm text-[15px] text-[#c9d6d2]">{clinic.tagline}</p>
          <ul className="mt-6 flex gap-2" aria-label="Social media">
            {socials.map(({ href, label, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (opens in a new tab)`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-[var(--paper)] transition-colors hover:border-[var(--rose-mid)] hover:text-[var(--rose-mid)]"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-[15px]">
          <h2 className="font-body text-sm font-semibold tracking-normal text-[var(--paper)]">Visit</h2>
          <address className="mt-3 not-italic text-[#c9d6d2]">{clinic.address}</address>
          <a href={mapsUrl(clinic.address)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[var(--rose-mid)] underline underline-offset-4">
            Get directions
          </a>
          <dl className="mt-5 space-y-1 text-[#c9d6d2]">
            {clinic.hours.map((h) => (
              <div key={h.days} className="flex flex-wrap gap-x-2">
                <dt className="text-[var(--paper)]">{h.days}</dt>
                <dd>{h.time}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="text-[15px]">
          <h2 className="font-body text-sm font-semibold tracking-normal text-[var(--paper)]">Contact</h2>
          <ul className="mt-3 space-y-1.5 text-[#c9d6d2]">
            <li><a href={telUrl(clinic.phone)} className="hover:text-[var(--paper)]">{clinic.phone}</a></li>
            <li><a href={`mailto:${clinic.email}`} className="break-all hover:text-[var(--paper)]">{clinic.email}</a></li>
            {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--paper)]">Message us on WhatsApp</a></li>}
          </ul>
          <nav aria-label="Footer" className="mt-6">
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[#c9d6d2]">
              {NAV.map((n) => (
                <li key={n.to}><Link to={n.to} className="hover:text-[var(--paper)]">{n.label}</Link></li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-[13px] text-[#a9bbb6] sm:px-8">
          <p>© {new Date().getFullYear()} {clinic.name}</p>
          <a href={EMR_LOGIN_URL} className="hover:text-[var(--paper)]">Staff: EMR login</a>
        </div>
      </div>
    </footer>
  );
}
