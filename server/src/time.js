import { config } from './config.js';

// 'YYYY-MM-DD' for a moment in the clinic's timezone.
export const clinicDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: config.clinicTz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);

// 'HH:MM' (24h) for a moment in the clinic's timezone.
export const clinicTime = (d = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: config.clinicTz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);

// Offset (minutes east of UTC) of the clinic timezone at a given instant.
const tzOffsetMinutes = (instant) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: config.clinicTz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
};

// The UTC instant at which a clinic-local 'YYYY-MM-DD' starts (endOfDay=false) or ends (true).
export const clinicDayBoundary = (ymd, endOfDay = false) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const localMs = endOfDay ? Date.UTC(y, m - 1, d, 23, 59, 59, 999) : Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset = tzOffsetMinutes(new Date(localMs));
  return new Date(localMs - offset * 60000);
};

// Minutes since midnight for 'HH:MM' or 'H:MM AM/PM'. Returns null if unparseable.
export const parseTimeToMinutes = (s) => {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};
