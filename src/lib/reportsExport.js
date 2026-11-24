import { jsPDF } from 'jspdf';
import { invoicedTotal } from './money';

// Columns shared by PDF and CSV exports.
const COLUMNS = [
  { key: 'doctor_name', header: 'Doctor', width: 48, align: 'left' },
  { key: 'count', header: 'Visits', width: 16, align: 'right', num: true },
  { key: 'sum_consultation_fee', header: 'Consultation', width: 26, align: 'right', num: true },
  { key: 'sum_services_total', header: 'Services', width: 24, align: 'right', num: true },
  { key: 'sum_procedures_total', header: 'Procedures', width: 24, align: 'right', num: true },
  { key: 'sum_total', header: 'Invoiced', width: 26, align: 'right', num: true },
  { key: 'sum_tax_amount', header: 'PRA Tax (incl.)', width: 26, align: 'right', num: true },
  { key: 'payable', header: 'Payable', width: 26, align: 'right', num: true },
  { key: 'sum_amount_paid', header: 'Collected', width: 27, align: 'right', num: true },
  { key: 'sum_balance', header: 'Outstanding', width:27, align: 'right', num: true },
];

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

// PRA tax is included in the invoiced amount, so payable is the total itself.
const buildRows = (rows) => rows.map((r) => ({
  ...r,
  payable: Number(r.sum_total || 0),
}));

export function downloadReportCsv(meta, rows, grand) {
  const data = buildRows(rows);
  const grandRow = { ...grand, payable: Number(grand.sum_total || 0), doctor_name: 'Grand Total' };
  const header = COLUMNS.map((c) => c.header).join(',');
  const lines = [header];
  const cell = (c, r) => {
    let v = r[c.key] ?? '';
    if (c.num) v = Number(v || 0);
    return String(v).includes(',') || /\s/.test(String(v)) ? `"${v}"` : String(v);
  };
  data.forEach((r) => lines.push(COLUMNS.map((c) => cell(c, r)).join(',')));
  lines.push(COLUMNS.map((c) => cell(c, grandRow)).join(','));
  const csv = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `financial-report-${meta.slug}.csv`);
}

export function downloadReportPdf(meta, rows, grand) {
  const data = buildRows(rows);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const usableW = pageW - margin * 2;
  // scale column widths to usable width
  const totalW = COLUMNS.reduce((s, c) => s + c.width, 0);
  const cols = COLUMNS.map((c) => ({ ...c, width: (c.width / totalW) * usableW }));

  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Dr Safoora Skin Chemistry', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Financial Report — ${meta.title}${meta.doctor ? ` — ${meta.doctor}` : ' — All doctors'}`, margin, y);
  y += 5;
  doc.text(`Invoiced: Rs ${fmtNum(grand.sum_total)}   PRA Tax (incl.): Rs ${fmtNum(grand.sum_tax_amount)}   Collected: Rs ${fmtNum(grand.sum_amount_paid)}   Outstanding: Rs ${fmtNum(grand.sum_balance)}`, margin, y);
  y += 7;

  const rowH = 7;
  const drawHeader = (startY) => {
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, startY, usableW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = margin;
    cols.forEach((c) => {
      doc.text(c.header, c.align === 'right' ? x + c.width - 1.5 : x + 1.5, startY + 4.6, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.width;
    });
    doc.setDrawColor(200, 220, 215);
    doc.line(margin, startY + rowH, margin + usableW, startY + rowH);
    return startY + rowH;
  };

  const drawRow = (r, startY, bold) => {
    if (startY > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      startY = 16;
      startY = drawHeader(startY);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    let x = margin;
    cols.forEach((c) => {
      const v = c.num ? fmtNum(r[c.key]) : (r[c.key] || '—');
      doc.text(String(v), c.align === 'right' ? x + c.width - 1.5 : x + 1.5, startY + 4.6, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.width;
    });
    doc.setDrawColor(235, 240, 238);
    doc.line(margin, startY + rowH, margin + usableW, startY + rowH);
    return startY + rowH;
  };

  y = drawHeader(y);
  data.forEach((r) => { y = drawRow(r, y, false); });
  if (data.length > 0) {
    const grandRow = { ...grand, payable: Number(grand.sum_total || 0), doctor_name: 'Grand Total' };
    y = drawRow(grandRow, y, true);
  }

  doc.save(`financial-report-${meta.slug}.pdf`);
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Appointment reports (in-clinic, online, cancelled, no-show) share one CSV shape.
export function downloadAppointmentsCsv(meta, appointments, invoices = {}) {
  const header = ['Date', 'Time', 'Patient', 'MRN', 'Doctor', 'Type', 'Status', 'Invoiced'];
  const lines = [header.join(',')];
  appointments.forEach((a) => {
    const inv = invoices[a.id];
    lines.push([
      a.date,
      a.start_time,
      a.patient_name,
      a.mrn,
      a.doctor_name,
      a.type === 'online' ? 'Online' : 'In-clinic',
      (a.status || '').replace('_', ' '),
      inv ? invoicedTotal(inv) : '',
    ].map(csvCell).join(','));
  });
  const csv = '\uFEFF' + lines.join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `appointments-${meta.slug}.csv`);
}

// Monthly PRA tax return: one line per invoice with the tax contained in it.
export function downloadPraTaxCsv(meta, invoices = []) {
  const header = ['Date', 'Patient', 'MRN', 'Doctor', 'Visit Type', 'Consultation (Rs)', 'PRA Tax Rate (%)', 'PRA Tax (Rs)'];
  const lines = [header.join(',')];
  let consultationTotal = 0;
  let taxTotal = 0;
  invoices.forEach((inv) => {
    const consultation = Number(inv.consultation_fee || 0);
    const tax = Number(inv.tax_amount || 0);
    consultationTotal += consultation;
    taxTotal += tax;
    lines.push([
      inv.visit_date,
      inv.patient_name,
      inv.mrn,
      inv.doctor_name,
      inv.visit_type === 'followup' ? 'Follow-up' : 'Consultation',
      consultation,
      Number(inv.tax_rate || 0),
      tax,
    ].map(csvCell).join(','));
  });
  lines.push(['Total', '', '', '', '', consultationTotal, '', taxTotal].map(csvCell).join(','));
  lines.push('');
  lines.push(['Total PRA tax payable to the authority (Rs)', taxTotal].map(csvCell).join(','));
  const csv = '\uFEFF' + lines.join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `pra-tax-${meta.slug}.csv`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}