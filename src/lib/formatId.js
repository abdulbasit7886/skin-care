// Pakistani CNIC format: XXXXX-XXXXXXX-X (13 digits)
// Pakistani mobile format: 03XX-XXXXXXX (11 digits)

const digits = (v) => String(v ?? '').replace(/\D/g, '');

// Stored MRNs already read "MRN-2026-9552", so a label of their own is dropped
// rather than printed twice.
export const mrnDisplay = (mrn) => String(mrn ?? '').replace(/^\s*MRN[\s#:.-]*/i, '');

export const formatCNIC = (v) => {
  const d = digits(v).slice(0, 13);
  const part1 = d.slice(0, 5);
  const part2 = d.slice(5, 12);
  const part3 = d.slice(12, 13);
  let out = part1;
  if (part2) out += `-${part2}`;
  if (part3) out += `-${part3}`;
  return out;
};

export const formatMobile = (v) => {
  const d = digits(v).slice(0, 11);
  const part1 = d.slice(0, 4);
  const part2 = d.slice(4, 11);
  let out = part1;
  if (part2) out += `-${part2}`;
  return out;
};