// The prescription slip as it is shown and printed: doctor, patient, visit
// details, then the numbered medicines on a plain white sheet.

import { mrnDisplay } from '@/lib/formatId';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Saved prescriptions carry their own numbering, which the slip re-applies.
export const rxLines = (text) =>
  (text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*\d+\.\s*/, '').trim())
    .filter(Boolean);

// Doctor records keep the title ("Dr.", "Prof. Dr.") apart from the name, and an
// appointment snapshot may hold only the name, so the two are joined here.
export const doctorNameWithTitle = (doctor, fallback) => {
  const name = (doctor?.name || fallback || '').trim();
  const title = (doctor?.title || '').trim();
  const bare = (s) => s.toLowerCase().replace(/[.\s]/g, '');
  return title && !bare(name).startsWith(bare(title)) ? `${title} ${name}` : name;
};

const fmtDate = (d) => {
  const [y, m, day] = String(d || '').split('-');
  return y && m && day ? `${day}-${m}-${y}` : d || '';
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const hour = ((h + 11) % 12) + 1;
  const suffix = h < 12 ? 'AM' : 'PM';
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
};

// Contact line at the foot of the slip.
const footLine = (facility) =>
  [
    facility?.name,
    facility?.address,
    facility?.contact_number ? `Ph: ${facility.contact_number}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

// A saved visit's prescription, ready for the slip.
export const rxFromVisit = ({ appointment, emr, doctor, facility }) => ({
  doctorName: doctorNameWithTitle(doctor, appointment?.doctor_name || emr?.doctor_name),
  specialization: doctor?.specialization || '',
  patientName: appointment?.patient_name || emr?.patient_name || '',
  mrn: appointment?.mrn || emr?.mrn || '',
  visitDate: appointment?.date || emr?.visit_date || '',
  visitTime: appointment?.start_time || '',
  prescription: emr?.prescription || '',
  labsTests: emr?.labs_tests || [],
  advise: emr?.advise || '',
  followupDate: emr?.followup_date || '',
  facility,
});

// opts.page: lay the slip out as a full A4 portrait sheet (used for printing),
// with the doctor's signature block pinned to the foot of the page.
export function buildRxSlip(rx, { page = false } = {}) {
  const lines = rxLines(rx.prescription);
  const labs = (rx.labsTests || []).filter(Boolean);
  const advise = String(rx.advise || '').trim();
  const sheet = page
    ? 'min-height:273mm;display:flex;flex-direction:column;padding:6mm 4mm;'
    : 'padding:34px 38px;';
  return `<div style="font-family:'Inter',Arial,Helvetica,sans-serif;color:#000;background:#fff;${sheet}">
  <div style="text-align:center;font-size:24px;font-weight:700;line-height:1.2;">${esc(rx.doctorName)}</div>
  ${rx.specialization ? `<div style="text-align:center;margin-top:4px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#555;">${esc(rx.specialization)}</div>` : ''}
  <div style="border-top:2px solid #000;margin:16px 0 18px;"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
    <div>
      <div style="font-size:19px;font-weight:700;">${esc(rx.patientName)}</div>
      <div style="margin-top:2px;font-size:12px;">MRN# ${esc(mrnDisplay(rx.mrn) || '---------')}</div>
    </div>
    <div style="text-align:right;font-size:12px;line-height:1.8;">
      <div><span style="color:#555;">Visit Date</span> &nbsp;${esc(fmtDate(rx.visitDate))}</div>
      <div><span style="color:#555;">Visit Time</span> &nbsp;${esc(fmtTime(rx.visitTime))}</div>
    </div>
  </div>

  <div style="margin-top:26px;font-size:34px;font-weight:700;line-height:1;">Rx</div>
  ${
    lines.length
      ? `<ol style="margin:10px 0 0;padding-left:24px;font-size:14px;line-height:2.1;">
    ${lines.map((line) => `<li style="padding-left:2px;">${esc(line)}</li>`).join('')}
  </ol>`
      : '<p style="margin:10px 0 0;font-size:13px;color:#777;">No medicines prescribed.</p>'
  }
  ${
    labs.length
      ? `<div style="margin-top:22px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Investigations advised</div>
    <ul style="margin:6px 0 0;padding-left:22px;font-size:13.5px;line-height:1.9;">${labs.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
  </div>`
      : ''
  }
  ${
    advise
      ? `<div style="margin-top:18px;">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Advice</div>
    <p style="margin:6px 0 0;font-size:13.5px;line-height:1.7;white-space:pre-line;">${esc(advise)}</p>
  </div>`
      : ''
  }
  ${
    rx.followupDate
      ? `<p style="margin:18px 0 0;font-size:13.5px;"><strong>Follow-up:</strong> ${esc(fmtDate(rx.followupDate))}</p>`
      : ''
  }
  ${page ? '<div style="flex:1;"></div>' : ''}

  <div style="margin-top:44px;border-top:1px solid #ccc;padding-top:10px;text-align:center;">
    <div style="font-size:13px;font-weight:700;color:#000;">${esc(rx.doctorName)}</div>
    <div style="margin-top:3px;font-size:11px;color:#555;">${esc(footLine(rx.facility) || 'Dr Safoora Skin Chemistry')}</div>
  </div>
</div>`;
}

export function printRxSlip(rx) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prescription ${esc(rx.patientName || '')}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 186mm; margin: 0 auto; }
    @media screen { body { background: #f3f4f6; padding: 16px 0; } .sheet { width: 210mm; padding: 12mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.12); } }
    ol { list-style: decimal; }
  </style></head><body><div class="sheet">${buildRxSlip(rx, { page: true })}</div></body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
  return true;
}