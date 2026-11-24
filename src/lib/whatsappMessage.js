// Builds an appointment confirmation message and a wa.me link for manual sending.

const VISIT_LABEL = { in_clinic: 'In-clinic', online: 'Online' };

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '';

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
};

// Normalize a Pakistani-style mobile number to international digits for wa.me.
export const normalizePhone = (mobile) => {
  if (!mobile) return '';
  let d = String(mobile).replace(/\D/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  if (d.startsWith('92')) return d;
  if (d.startsWith('0')) return '92' + d.slice(1);
  return d;
};

export const buildConfirmationMessage = ({ appointment, doctor, facility }) => {
  const clinic = facility?.name || 'Dr Safoora Skin Chemistry';
  const lines = [
    `Dear ${appointment?.patient_name?.split(' ')[0] || 'Patient'},`,
    `Your appointment at ${clinic} is confirmed.`,
    '',
    `Doctor: ${doctor?.name || appointment?.doctor_name || '—'}`,
    `Date: ${fmtDate(appointment?.date)}`,
    `Time: ${fmtTime(appointment?.start_time)}`,
    `Type: ${VISIT_LABEL[appointment?.type] || appointment?.type || 'In-clinic'}`,
  ];
  if (appointment?.reason) lines.push(`Reason: ${appointment.reason}`);
  if (facility?.address) lines.push(`Address: ${facility.address}`);
  if (facility?.contact_number) lines.push(`Contact: ${facility.contact_number}`);
  lines.push('');
  lines.push('Please arrive 10 minutes early. To reschedule, contact the clinic.');
  lines.push('Thank you.');
  return lines.join('\n');
};

export const waLink = (mobile, message) =>
  `https://wa.me/${normalizePhone(mobile)}?text=${encodeURIComponent(message)}`;

export const buildConsultationMessage = ({ appointment, doctor, facility }) => {
  const clinic = facility?.name || 'Dr Safoora Skin Chemistry';
  const first = appointment?.patient_name?.split(' ')[0] || 'Patient';
  const lines = [
    `Hello ${first},`,
    `This is ${clinic} regarding your online consultation with Dr ${doctor?.name || appointment?.doctor_name || '—'}.`,
    `Scheduled: ${fmtDate(appointment?.date)} at ${fmtTime(appointment?.start_time)}.`,
    '',
    'This consultation will be conducted here on WhatsApp. Please reply with:',
    '• Your main concern / symptoms',
    '• Clear photos of the affected area',
    '• Any questions you have',
    '',
    facility?.contact_number ? `For queries call ${facility.contact_number}.` : '',
    'Thank you.',
  ].filter(Boolean);
  return lines.join('\n');
};