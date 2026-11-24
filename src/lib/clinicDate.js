// Dates in the clinic's timezone (Asia/Karachi). Use these instead of
// `new Date().toISOString().slice(0, 10)`, which is the UTC date.
export const CLINIC_TZ = 'Asia/Karachi';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

// YYYY-MM-DD for the given instant (default: now) in the clinic timezone.
export const toClinicISODate = (d = new Date()) => dateFmt.format(d instanceof Date ? d : new Date(d));

export const todayISO = () => toClinicISODate(new Date());

// Add (or subtract) whole days to a YYYY-MM-DD string. Pure calendar math in UTC,
// so the browser's own timezone can never shift the result by a day.
export const addDaysISO = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// HH:MM (24h) in the clinic timezone.
export const clinicTimeHHMM = (d = new Date()) => timeFmt.format(d instanceof Date ? d : new Date(d));

// Human date-time in the clinic timezone, e.g. "25 Nov 2026, 14:05".
export const formatClinicDateTime = (d) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
};
