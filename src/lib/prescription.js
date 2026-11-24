// Prescription catalog and helpers shared by the composer and its grid.

// Dosage forms offered for each route of administration.
export const ROUTE_FORMS = {
  Oral: ['Tablet', 'Capsule', 'Elixir', 'Syrup', 'Suspension', 'Drops'],
  Topical: ['Cream', 'Ointment', 'Lotion', 'Gel', 'Foam', 'Solution', 'Powder'],
  'IM injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  'IV injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  'IV infusion': ['Infusion bag', 'Ampoule', 'Vial'],
  'Intradermal injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  'Subcutaneous injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  'Intra-articular injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  'Intralesional injection': ['Ampoule', 'Vial', 'Pre-filled syringe'],
  Ophthalmic: ['Eye drops', 'Eye ointment'],
  Otic: ['Ear drops'],
  Nasal: ['Nasal spray', 'Nasal drops'],
  Inhalation: ['Inhaler', 'Nebulizer solution', 'Rotacaps'],
  'Rectal / Vaginal': ['Suppository', 'Pessary'],
};

export const SHORT = {
  Tablet: 'Tab',
  Capsule: 'Cap',
  Elixir: 'Elix',
  Syrup: 'Syp',
  Suspension: 'Susp',
  Ampoule: 'Inj',
  Vial: 'Inj',
  'Pre-filled syringe': 'Inj',
  'Infusion bag': 'Infusion',
  Ointment: 'Oint',
  'Eye drops': 'Eye gtt',
  'Eye ointment': 'Eye oint',
  'Ear drops': 'Ear gtt',
  'Nasal spray': 'Nasal spray',
  'Nasal drops': 'Nasal gtt',
};

// Injection routes are tagged on the prescription line, since the form alone
// (Inj, Infusion) does not say how it is given.
export const ROUTE_TAG = {
  'IM injection': 'IM',
  'IV injection': 'IV',
  'IV infusion': 'IV infusion',
  'Intradermal injection': 'ID',
  'Subcutaneous injection': 'SC',
  'Intra-articular injection': 'IA',
  'Intralesional injection': 'IL',
};

export const FREQUENCIES = [
  { value: 'OD', label: 'OD — once daily' },
  { value: 'BD', label: 'BD — twice daily' },
  { value: 'TDS', label: 'TDS — three times daily' },
  { value: 'QID', label: 'QID — four times daily' },
  { value: 'HS', label: 'HS — at night' },
  { value: 'SOS', label: 'SOS — if needed' },
  { value: 'Alternate day', label: 'Alternate day' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Stat', label: 'Stat — single dose' },
];

export const DURATION_UNITS = ['days', 'weeks', 'months'];

export const DOSES = Array.from({ length: 10 }, (_, i) => String(i + 1));

// Liquid forms are measured in spoons rather than counted units.
export const LIQUID_FORMS = ['Elixir', 'Syrup', 'Suspension', 'Drops'];

export const LIQUID_DOSES = [
  '½ teaspoonful',
  '1 teaspoonful',
  '1½ teaspoonful',
  '2 teaspoonful',
  '1 tablespoonful',
  '2 tablespoonful',
];

export const emptyMedicine = {
  route: '',
  form: '',
  medicine: '',
  strength: '',
  dose: '',
  frequency: '',
  duration: '',
  durationUnit: 'days',
  instructions: '',
};

export const medicineFields = ['route', 'form', 'medicine', 'strength', 'dose', 'frequency', 'duration', 'durationUnit', 'instructions'];

let seq = 0;
export const nextId = () => `rx-${++seq}`;

// One prescription line, e.g. "Tab Doxycycline 100 mg — 1, BD, 5 days, after meals"
export function composeLine(m) {
  const prefix = SHORT[m.form] || m.form || '';
  const head = [prefix, `${m.medicine || ''}${m.strength ? ` ${m.strength}` : ''}`.trim()].filter(Boolean).join(' ');
  const duration = m.duration ? `${m.duration} ${m.durationUnit}` : '';
  const parts = [ROUTE_TAG[m.route], m.dose, m.frequency, duration, m.instructions].filter(Boolean);
  return `${head}${parts.length ? ` — ${parts.join(', ')}` : ''}`;
}

// Every prefix the composer can print in front of a medicine name.
const FORM_BY_PREFIX = (() => {
  const map = {};
  Object.values(ROUTE_FORMS).forEach((forms) => {
    forms.forEach((form) => {
      map[(SHORT[form] || form).toLowerCase()] = form;
      map[form.toLowerCase()] = form;
    });
  });
  return map;
})();

const ROUTE_BY_TAG = Object.fromEntries(
  Object.entries(ROUTE_TAG).map(([route, tag]) => [tag.toLowerCase(), route])
);

const STRENGTH_RE = /\s(\d+(?:\.\d+)?\s*(?:mg|mcg|µg|gm?|ml|iu|units?|%))\s*$/i;
const DURATION_RE = /^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months)$/i;
const UNIT_PLURAL = { day: 'days', week: 'weeks', month: 'months' };

const routeForForm = (form) =>
  Object.keys(ROUTE_FORMS).find((route) => ROUTE_FORMS[route].includes(form)) || '';

const isDose = (seg) => /^\d{1,2}$/.test(seg) || /tea|table ?spoon/i.test(seg);

// Rebuilds the composer fields from a saved line, e.g.
// "Tab Doxycycline 100 mg — 1, BD, 5 days, after meals".
function parseLine(line) {
  const item = { ...emptyMedicine, id: nextId(), line };
  const [head, ...tailParts] = line.split(/\s+[—–-]\s+/);
  const tail = tailParts.join(' — ');

  // Dosage form sits first: one or two words ("Tab", "Eye gtt", "Cream").
  let rest = (head || '').trim();
  const words = rest.split(' ');
  for (const len of [2, 1]) {
    const form = FORM_BY_PREFIX[words.slice(0, len).join(' ').toLowerCase()];
    if (form) {
      item.form = form;
      item.route = routeForForm(form);
      rest = words.slice(len).join(' ').trim();
      break;
    }
  }

  const strength = rest.match(STRENGTH_RE);
  if (strength) {
    item.strength = strength[1].trim();
    rest = rest.slice(0, rest.length - strength[0].length).trim();
  }
  item.medicine = rest;

  const segments = (tail || '').split(',').map((s) => s.trim()).filter(Boolean);
  const used = new Set();

  const tagged = ROUTE_BY_TAG[segments[0]?.toLowerCase()];
  if (tagged) {
    item.route = tagged;
    used.add(0);
  }

  segments.forEach((seg, i) => {
    if (used.has(i)) return;
    const duration = seg.match(DURATION_RE);
    if (duration && !item.duration) {
      item.duration = duration[1];
      item.durationUnit = UNIT_PLURAL[duration[2].toLowerCase()];
      used.add(i);
      return;
    }
    const frequency = FREQUENCIES.find((f) => f.value.toLowerCase() === seg.toLowerCase());
    if (frequency && !item.frequency) {
      item.frequency = frequency.value;
      used.add(i);
    }
  });

  let doseAt = segments.findIndex((seg, i) => !used.has(i) && isDose(seg));
  if (doseAt < 0) {
    // A typed (topical) dose is free text, so it sits right before the frequency.
    const freqAt = segments.findIndex((seg) => seg === item.frequency);
    if (freqAt > 0 && !used.has(freqAt - 1)) doseAt = freqAt - 1;
  }
  if (doseAt >= 0) {
    item.dose = segments[doseAt];
    used.add(doseAt);
  }

  item.instructions = segments.filter((seg, i) => !used.has(i)).join(', ');
  return item;
}

// Existing free-text prescriptions become one grid row each, split back into
// route, dose, frequency, duration and instructions.
export function parsePrescription(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean)
    .map(parseLine);
}

export function serializeItems(items) {
  return items.map((item, i) => `${i + 1}. ${item.line}`).join('\n');
}