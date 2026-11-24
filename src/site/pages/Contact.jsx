import React, { useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { api } from '@/api/client';
import PageHeader from '@/site/components/PageHeader';
import { WhatsappIcon } from '@/site/components/SocialIcons';
import { primaryBtn, secondaryBtn } from '@/site/components/buttons';
import { mapsUrl, telUrl, usePageTitle, useSiteData, whatsappUrl } from '@/site/SiteData';

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '' };
const FIELD_ORDER = ['name', 'email', 'phone', 'subject', 'message'];

const validate = (v) => {
  const e = {};
  const name = v.name.trim();
  const email = v.email.trim();
  const phone = v.phone.trim();
  const message = v.message.trim();
  if (name.length < 2) e.name = 'Enter your name.';
  else if (name.length > 100) e.name = 'Keep your name under 100 characters.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address, like name@example.com.';
  if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) e.phone = 'Enter a valid phone number, digits only with an optional +.';
  if (!email && !phone && !e.email && !e.phone) e.email = 'Add an email address or a phone number so we can reply.';
  if (v.subject.trim().length > 150) e.subject = 'Keep the subject under 150 characters.';
  if (message.length < 10) e.message = 'Write a short message (at least 10 characters).';
  else if (message.length > 2000) e.message = 'Keep your message under 2,000 characters.';
  return e;
};

function Field({ id, label, optional, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[15px] font-medium text-[var(--ink)]">
        {label}
        {optional && <span className="ml-1 font-normal text-[var(--ink-soft)]">(optional)</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-[14px] text-[#a1213f]">{error}</p>}
    </div>
  );
}

const inputClass = (hasError) =>
  `block w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-[var(--ink)] placeholder:text-[#8b9694] focus:border-[var(--teal)] focus:outline-none ${
    hasError ? 'border-[#a1213f]' : 'border-[var(--hairline)]'
  }`;

function ContactForm() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed
  const [failure, setFailure] = useState('');
  const refs = useRef({});

  const set = (key) => (e) => {
    const val = e.target.value;
    setValues((v) => ({ ...v, [key]: val }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) { refs.current[first]?.focus(); return; }
    setStatus('sending');
    setFailure('');
    try {
      const payload = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
      await api.public.contact(payload);
      setStatus('sent');
      setValues(EMPTY);
    } catch (err) {
      setStatus('failed');
      setFailure(
        err?.status === 429
          ? 'Too many messages were sent from this connection. Try again in a few minutes, or call us.'
          : `Your message was not sent: ${err?.message || 'the server did not respond'}. Try again, or call or WhatsApp us.`
      );
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-[var(--rose)] p-8" role="status">
        <CheckCircle2 className="h-8 w-8 text-[var(--teal)]" aria-hidden="true" />
        <h2 className="mt-4 text-[1.75rem]">Message sent</h2>
        <p className="mt-2 max-w-[46ch] text-[var(--ink-soft)]">Thank you. The clinic team will reply by email or phone.</p>
        <button type="button" className={`${secondaryBtn} mt-6`} onClick={() => setStatus('idle')}>Send another message</button>
      </div>
    );
  }

  // Field renders its error as `${id}-error`, so the input points at that id.
  const bind = (k) => ({
    id: `contact-${k}`,
    ref: (el) => { refs.current[k] = el; },
    value: values[k],
    onChange: set(k),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `contact-${k}-error` : undefined,
    className: inputClass(!!errors[k]),
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <h2 className="text-[1.75rem]">Send us a message</h2>
      <Field id="contact-name" label="Your name" error={errors.name}>
        <input type="text" autoComplete="name" {...bind('name')} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-email" label="Email" optional error={errors.email}>
          <input type="email" autoComplete="email" inputMode="email" {...bind('email')} />
        </Field>
        <Field id="contact-phone" label="Phone" optional error={errors.phone}>
          <input type="tel" autoComplete="tel" inputMode="tel" {...bind('phone')} />
        </Field>
      </div>
      <p className="-mt-2 text-[14px] text-[var(--ink-soft)]">Give us at least one way to reply.</p>
      <Field id="contact-subject" label="Subject" optional error={errors.subject}>
        <input type="text" placeholder="For example: booking a consultation" {...bind('subject')} />
      </Field>
      <Field id="contact-message" label="Message" error={errors.message}>
        <textarea rows={6} {...bind('message')} className={`${inputClass(!!errors.message)} resize-y`} />
      </Field>
      <p className="text-[14px] text-[var(--ink-soft)]">
        Please do not include detailed medical information here. Your doctor will discuss it with you at your appointment.
      </p>
      {status === 'failed' && (
        <p role="alert" className="rounded-xl border border-[#a1213f]/30 bg-[#a1213f]/5 px-4 py-3 text-[15px] text-[#a1213f]">{failure}</p>
      )}
      <button type="submit" className={primaryBtn} disabled={status === 'sending'}>
        {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {status === 'sending' ? 'Sending message' : 'Send message'}
      </button>
    </form>
  );
}

function ContactDetails() {
  const { clinic } = useSiteData();
  const wa = whatsappUrl(clinic.whatsapp, 'Hello, I would like to book a consultation.');
  return (
    <aside className="space-y-8">
      <div>
        <h2 className="text-[1.75rem]">Reach the clinic</h2>
        <ul className="mt-5 space-y-4">
          <li className="flex gap-3">
            <MapPin className="mt-1 h-5 w-5 shrink-0 text-[var(--plum)]" aria-hidden="true" />
            <div>
              <address className="not-italic">{clinic.address}</address>
              <a href={mapsUrl(clinic.address)} target="_blank" rel="noopener noreferrer" className="hs-link text-[15px]">
                Open in Google Maps
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <Phone className="mt-1 h-5 w-5 shrink-0 text-[var(--plum)]" aria-hidden="true" />
            <a href={telUrl(clinic.phone)} className="hover:text-[var(--teal)]">{clinic.phone}</a>
          </li>
          <li className="flex gap-3">
            <Mail className="mt-1 h-5 w-5 shrink-0 text-[var(--plum)]" aria-hidden="true" />
            <a href={`mailto:${clinic.email}`} className="break-all hover:text-[var(--teal)]">{clinic.email}</a>
          </li>
        </ul>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${primaryBtn} mt-6`}>
            <WhatsappIcon width={18} height={18} />
            Message us on WhatsApp
          </a>
        )}
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
    </aside>
  );
}

export default function Contact() {
  usePageTitle('Contact us');
  return (
    <>
      <PageHeader title="Contact us" lead="Book a consultation, ask about a treatment, or send feedback. Messages are answered during opening hours." />
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-16 sm:px-8 md:grid-cols-[1.25fr_0.75fr] lg:py-20">
        <ContactForm />
        <ContactDetails />
      </div>
    </>
  );
}
