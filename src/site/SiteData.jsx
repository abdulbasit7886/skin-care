import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { clinic as clinicContent, fallbackDoctors, fallbackServices } from '@/site/content';

const SiteDataContext = createContext(null);

const descriptionFor = (name) => {
  const key = (name || '').trim().toLowerCase();
  return fallbackServices.find((s) => s.name.toLowerCase() === key)?.description || '';
};

// Loads live doctors, services and facility details from the EMR once, and merges them
// with the static content in content.js. Anything the API cannot supply falls back to content.js.
export function SiteDataProvider({ children }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.public
      .site()
      .then((data) => { if (active) setLive(data || null); })
      .catch(() => { if (active) setLive(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const value = useMemo(() => {
    const facility = live?.facility || null;
    const clinic = {
      ...clinicContent,
      name: facility?.name || clinicContent.name,
      address: facility?.address || clinicContent.address,
      phone: facility?.contact_number || clinicContent.phone,
      email: facility?.email || clinicContent.email,
      logo_url: facility?.logo_url || '',
    };

    const liveDoctors = Array.isArray(live?.doctors) ? live.doctors.filter((d) => d && d.name) : [];
    const doctors = liveDoctors.length ? liveDoctors : fallbackDoctors;

    const toItem = (s) => ({ id: s.id, name: s.name, description: descriptionFor(s.name) });
    const liveServices = Array.isArray(live?.services) ? live.services.filter((s) => s?.name).map(toItem) : [];
    const liveProcedures = Array.isArray(live?.procedures) ? live.procedures.filter((s) => s?.name).map(toItem) : [];
    const hasLiveServices = liveServices.length + liveProcedures.length > 0;

    return {
      loading,
      clinic,
      doctors,
      doctorsAreLive: liveDoctors.length > 0,
      services: hasLiveServices ? liveServices : fallbackServices.map((s, i) => ({ id: `f${i}`, ...s })),
      procedures: hasLiveServices ? liveProcedures : [],
      servicesAreLive: hasLiveServices,
    };
  }, [live, loading]);

  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export const useSiteData = () => {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error('useSiteData must be used inside SiteDataProvider');
  return ctx;
};

// Sets the browser tab title: "About · Clinic name", or just the clinic name on the home page.
export const usePageTitle = (page) => {
  const { clinic } = useSiteData();
  useEffect(() => {
    document.title = page ? `${page} · ${clinic.name}` : `${clinic.name} | ${clinic.tagline}`;
  }, [page, clinic.name, clinic.tagline]);
};

// Helpers shared by the header, footer and contact page.
export const whatsappUrl = (digits, text) => {
  const clean = String(digits || '').replace(/\D/g, '');
  if (!clean) return '';
  return `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};

export const telUrl = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

export const mapsUrl = (address) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;

export const initialsOf = (name) =>
  String(name || '')
    .replace(/^(dr\.?|prof\.?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
