// Turns OCR text from a scanned patient chart into structured fields.
// Heuristic: looks for labelled values ("Name: ...", "Age 32", "CNIC ...") and dated visit entries.
// Anything not recognised stays empty; staff review every field before saving.

const LABELS = [
  { key: 'name', re: /\b(?:patient(?:'s)?\s*name|name\s*of\s*patient|pt\.?\s*name|name)\b/i },
  { key: 'father_husband', re: /\b(?:father\s*\/\s*husband(?:\s*name)?|father(?:'s)?\s*name|husband(?:'s)?\s*name|f\s*\/\s*h(?:\s*name)?|s\s*\/\s*o|d\s*\/\s*o|w\s*\/\s*o)\b/i },
  { key: 'age', re: /\bage\b/i },
  { key: 'sex', re: /\b(?:sex|gender)\b/i },
  { key: 'cnic', re: /\b(?:cnic|nic|id\s*card)(?:\s*(?:no|#|number))?\.?/i },
  { key: 'mobile', re: /\b(?:mobile|cell|phone|contact|tel|ph)(?:\s*(?:no|#|number))?\.?/i },
  { key: 'address', re: /\b(?:address|addr|residence)\b/i },
  { key: 'profession', re: /\b(?:profession|occupation)\b/i },
  { key: 'referred_by', re: /\b(?:referred\s*by|ref(?:erred)?\.?\s*by|referral|referred)\b/i },
  { key: 'previous_diagnosis', re: /\b(?:previous|past|prior)\s*(?:diagnosis|history|dx)\b/i },
  { key: 'mrn', re: /\b(?:mrn|mr\s*no|m\.r\.?\s*no|reg(?:istration)?\s*(?:no|#))\.?/i },
  { key: 'date', re: /\bdate\b/i },
];

const VISIT_LABELS = [
  { key: 'presenting_complaint', re: /\b(?:presenting\s*complaints?|chief\s*complaints?|complaints?|c\s*\/\s*o|p\s*\/\s*c|history)\b/i },
  { key: 'diagnosis', re: /\b(?:diagnosis|dx|impression|assessment)\b/i },
  { key: 'management_procedure', re: /\b(?:management|treatment|procedure|plan|rx|advice|advised|medication)\b/i },
];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n) => String(n).padStart(2, '0');
const fullYear = (y) => (y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y);
const validYmd = (y, m, d) => y >= 1950 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

const DATE_PATTERNS = [
  // 2024-03-15
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, get: (m) => [+m[1], +m[2], +m[3]] },
  // 15/03/2024, 15-3-24, 15.03.2024 (day first, as used in Pakistan)
  { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/, get: (m) => [fullYear(+m[3]), +m[2], +m[1]] },
  // 15 Mar 2024, 15-March-2024
  { re: /\b(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{2,4})\b/, get: (m) => [fullYear(+m[3]), MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]] },
  // Mar 15, 2024
  { re: /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/, get: (m) => [+m[3], MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]] },
];

export function findDate(text) {
  for (const p of DATE_PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    const [y, mo, d] = p.get(m);
    if (mo && validYmd(y, mo, d)) return { iso: `${y}-${pad(mo)}-${pad(d)}`, index: m.index, length: m[0].length };
  }
  return null;
}

const clean = (s) => String(s || '')
  .replace(/^[\s:;.\-–—=|_]+/, '')
  .replace(/[\s|_]+$/, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

// Split a line into { key, value } pairs at every known label.
function labelledValues(line, labels) {
  const hits = [];
  for (const { key, re } of labels) {
    const g = new RegExp(re.source, 'gi');
    let m;
    while ((m = g.exec(line))) hits.push({ key, start: m.index, end: m.index + m[0].length });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  for (const h of hits) if (!kept.length || h.start >= kept[kept.length - 1].end) kept.push(h);
  return kept.map((h, i) => ({ key: h.key, value: clean(line.slice(h.end, kept[i + 1]?.start ?? line.length)) }));
}

const normSex = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (/^(m|male|man)\b/.test(s)) return 'Male';
  if (/^(f|female|woman)\b/.test(s)) return 'Female';
  return '';
};

const normCnic = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length === 13 ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` : '';
};

const normMobile = (v) => {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+92')) d = `0${d.slice(3)}`;
  else if (d.startsWith('92') && d.length === 12) d = `0${d.slice(2)}`;
  return /^03\d{9}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4)}` : '';
};

const splitName = (full) => {
  const parts = clean(full).replace(/^(mr|mrs|ms|miss|master|dr)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts.slice(0, -1).join(' '), last_name: parts[parts.length - 1] };
};

export function parseChart(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^--- page \d+ ---$/.test(l));

  const demo = {
    first_name: '', last_name: '', father_husband: '', age: '', sex: '', cnic: '', mobile: '',
    address: '', profession: '', referred_by: '', previous_diagnosis: '',
  };

  // ---- demographics: labelled values anywhere in the first part of the chart
  const headerLines = lines.slice(0, 40);
  for (const line of headerLines) {
    for (const { key, value } of labelledValues(line, LABELS)) {
      if (!value) continue;
      switch (key) {
        case 'name':
          if (!demo.first_name) Object.assign(demo, splitName(value.replace(/\d.*$/, '')));
          break;
        case 'age': {
          const m = /(\d{1,3})/.exec(value);
          if (!demo.age && m && +m[1] <= 120) demo.age = m[1];
          break;
        }
        case 'sex':
          if (!demo.sex) demo.sex = normSex(value);
          break;
        case 'cnic':
          if (!demo.cnic) demo.cnic = normCnic(value);
          break;
        case 'mobile':
          if (!demo.mobile) demo.mobile = normMobile(value);
          break;
        case 'father_husband':
        case 'address':
        case 'profession':
        case 'referred_by':
        case 'previous_diagnosis':
          if (!demo[key]) demo[key] = value.slice(0, 300);
          break;
        default:
          break;
      }
    }
  }
  // unlabelled fallbacks anywhere in the text
  const all = lines.join('\n');
  if (!demo.cnic) {
    const m = /\b\d{5}[-\s]?\d{7}[-\s]?\d\b/.exec(all);
    if (m) demo.cnic = normCnic(m[0]);
  }
  if (!demo.mobile) {
    const m = /(?:\+?92[-\s]?|0)3\d{2}[-\s]?\d{7}\b/.exec(all);
    if (m) demo.mobile = normMobile(m[0]);
  }
  if (!demo.sex) {
    const m = /\b(male|female)\b/i.exec(all);
    if (m) demo.sex = normSex(m[1]);
  }

  // ---- visits: a line that starts with a date opens a new visit entry
  const visits = [];
  let current = null;
  const flushVisit = () => {
    if (!current) return;
    const v = { date: current.date, presenting_complaint: '', diagnosis: '', management_procedure: '' };
    let unlabelled = [];
    let lastKey = null;
    for (const line of current.lines) {
      const parts = labelledValues(line, VISIT_LABELS);
      if (!parts.length) {
        if (lastKey) v[lastKey] = clean(`${v[lastKey]} ${line}`);
        else unlabelled.push(line);
        continue;
      }
      const prefix = clean(line.slice(0, line.search(VISIT_LABELS.find((l) => l.key === parts[0].key).re)));
      if (prefix) unlabelled.push(prefix);
      for (const { key, value } of parts) {
        v[key] = clean(`${v[key]} ${value}`);
        lastKey = key;
      }
    }
    if (unlabelled.length) v.presenting_complaint = clean(`${unlabelled.join(' ')} ${v.presenting_complaint}`);
    if (v.presenting_complaint || v.diagnosis || v.management_procedure) {
      for (const k of ['presenting_complaint', 'diagnosis', 'management_procedure']) v[k] = v[k].slice(0, 2000);
      visits.push(v);
    }
    current = null;
  };
  for (const line of lines) {
    const d = findDate(line);
    const startsWithDate = d && d.index <= 3;
    const isHeaderDate = /^\s*date\b/i.test(line) && visits.length === 0 && !current && lines.indexOf(line) < 8;
    if (startsWithDate && !isHeaderDate) {
      flushVisit();
      current = { date: d.iso, lines: [] };
      const rest = clean(line.slice(d.index + d.length));
      if (rest) current.lines.push(rest);
    } else if (current) {
      current.lines.push(line);
    }
  }
  flushVisit();

  return { demographics: demo, visits: visits.slice(0, 100) };
}
