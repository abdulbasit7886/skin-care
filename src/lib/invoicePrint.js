import { mrnDisplay } from '@/lib/formatId';
import { PRA_TAX_NOTE } from '@/lib/praTax';

const money = (n) => `Rs ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const modeLabel = (m) => ({
  cash: 'Cash',
  online_transfer: 'Online Transfer',
  debit_card: 'Debit Card',
  credit_card: 'Credit Card',
}[m] || '—');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const DEFAULT_CLINIC = 'Dr Safoora Skin Chemistry';

// How an invoice is labelled on screen and on paper.
//  - corrected: an admin amended it after it was printed (server sets is_corrected / revision)
//  - duplicate: a reprint of an already-printed invoice that was not amended
export const invoiceLabel = (inv, { reprint = false } = {}) => {
  if (inv?.is_corrected) {
    const rev = Number(inv.revision || 0);
    return { title: rev > 0 ? `Corrected Invoice (Rev. ${rev})` : 'Corrected Invoice', stamp: 'CORRECTED', corrected: true };
  }
  if (reprint) return { title: 'Invoice (Duplicate Copy)', stamp: 'DUPLICATE', corrected: false };
  return { title: 'Invoice', stamp: '', corrected: false };
};

// Opens the invoice on an A4 portrait sheet and sends it to the printer.
// opts.reprint  — the invoice had already been printed before this print
// opts.facility — the clinic record, for the header and footer
export const printInvoice = (inv, opts = {}) => {
  const { title, stamp } = invoiceLabel(inv, { reprint: !!opts.reprint });
  const facility = opts.facility || null;
  const clinicName = facility?.name || DEFAULT_CLINIC;
  const clinicLines = [
    facility?.address,
    [facility?.contact_number ? `Ph: ${facility.contact_number}` : '', facility?.email].filter(Boolean).join(' · '),
    facility?.tax_number ? `NTN / Tax No: ${facility.tax_number}` : '',
  ].filter(Boolean);
  const subtotal = Number(inv.total || 0);
  const tax = Number(inv.tax_amount || 0);
  const discount = Number(inv.discount_amount || 0);
  // PRA tax is already inside the consultation charge.
  const grand = Math.max(0, subtotal - discount);
  const paid = Number(inv.amount_paid || 0);
  const balance = Number(inv.balance || 0);
  const visitWhen = [fmtDate(inv.visit_date), inv.visit_time].filter(Boolean).join(' · ');

  const rows = [];
  rows.push(`<tr><td>${inv.visit_type === 'followup' ? 'Follow-up consultation' : 'Consultation'}</td><td class="amt">${money(inv.consultation_fee)}</td></tr>`);
  (inv.service_items || []).forEach((name) => rows.push(`<tr><td>Service · ${esc(name)}</td><td class="amt">—</td></tr>`));
  (inv.procedure_items || []).forEach((name) => rows.push(`<tr><td>Procedure · ${esc(name)}</td><td class="amt">—</td></tr>`));
  if (Number(inv.services_total || 0) > 0) rows.push(`<tr class="sub"><td>Services subtotal</td><td class="amt">${money(inv.services_total)}</td></tr>`);
  if (Number(inv.procedures_total || 0) > 0) rows.push(`<tr class="sub"><td>Procedures subtotal</td><td class="amt">${money(inv.procedures_total)}</td></tr>`);

  const stampColor = stamp === 'CORRECTED' ? '#b45309' : '#6b7280';
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(mrnDisplay(inv.mrn) || inv.id)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: 186mm; min-height: 273mm; margin: 0 auto; padding: 4mm 2mm; display: flex; flex-direction: column; }
    @media screen { body { background: #f3f4f6; padding: 16px 0; } .sheet { background: #fff; padding: 12mm; width: 210mm; min-height: 297mm; box-shadow: 0 2px 12px rgba(0,0,0,.12); } }
    .brand { font-family: Georgia, serif; font-size: 24px; font-weight: 600; color: #0f5e54; }
    .muted { color: #6b7280; font-size: 11.5px; line-height: 1.5; }
    .head { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0f5e54; padding-bottom: 12px; margin-bottom: 16px; }
    .doc-title { font-size: 17px; font-weight: 700; ${stamp === 'CORRECTED' ? 'color:#b45309;' : ''} }
    .grid { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; font-size: 13.5px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 13.5px; }
    th, td { padding: 7px 6px; border-bottom: 1px solid #e5e7eb; }
    th { text-align: left; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    td.amt, th.amt { text-align: right; white-space: nowrap; }
    tr.sub td { color: #6b7280; font-size: 12.5px; }
    .totals { margin-left: auto; width: 92mm; font-size: 13.5px; }
    .totals .row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; }
    .grand { border-top: 2px solid #0f5e54; margin-top: 6px; padding-top: 8px; font-weight: 700; font-size: 17px; color: #0f5e54; }
    .stamps { margin-top: 14px; display: flex; gap: 14px; }
    .stamp { display:inline-block; border:3px solid #0f5e54; color:#0f5e54; padding:5px 16px; border-radius:6px; font-weight:700; letter-spacing:2px; transform: rotate(-6deg); }
    .note { margin-top: 6px; font-size: 10.5px; color: #6b7280; font-style: italic; text-align: right; }
    .spacer { flex: 1; }
    .foot { margin-top: 24px; text-align: center; color: #9ca3af; font-size: 10.5px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
  </style></head><body><div class="sheet">
    <div class="head">
      <div>
        <div class="brand">${esc(clinicName)}</div>
        ${clinicLines.map((l) => `<div class="muted">${esc(l)}</div>`).join('') || '<div class="muted">Dermatology &amp; Aesthetic Medicine</div>'}
      </div>
      <div style="text-align:right">
        <div class="doc-title">${esc(title)}</div>
        <div class="muted">${esc(visitWhen)}</div>
        ${inv.id ? `<div class="muted">Ref ${esc(String(inv.id).slice(-8).toUpperCase())}</div>` : ''}
      </div>
    </div>
    <div class="grid">
      <div><div class="muted">Patient</div><div>${esc(inv.patient_name)}</div><div class="muted">MRN ${esc(mrnDisplay(inv.mrn))}</div></div>
      <div style="text-align:right"><div class="muted">Attending Doctor</div><div>${esc(inv.doctor_name)}</div></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <div class="totals">
      <div class="row"><span>Invoiced amount</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>PRA Tax @ ${esc(Number(inv.tax_rate || 0))}% (included in consultation)</span><span>${money(tax)}</span></div>
      ${discount > 0 ? `<div class="row"><span>Discount</span><span>- ${money(discount)}</span></div>` : ''}
      <div class="row grand"><span>Total payable</span><span>${money(grand)}</span></div>
      <div class="row"><span>Amount paid (${esc(modeLabel(inv.payment_mode))})</span><span>${money(paid)}</span></div>
      <div class="row"><span>Balance</span><span>${money(balance)}</span></div>
      <div class="note">${esc(PRA_TAX_NOTE)}</div>
    </div>
    <div class="stamps">
      ${stamp ? `<div class="stamp" style="border-color:${stampColor};color:${stampColor}">${stamp}</div>` : ''}
      ${balance <= 0 ? '<div class="stamp">PAID</div>' : ''}
    </div>
    <div class="spacer"></div>
    <div class="foot">This is a computer-generated invoice. Thank you for visiting ${esc(clinicName)}.</div>
  </div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
  return true;
};
