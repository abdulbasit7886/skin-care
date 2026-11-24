import { api } from '@/api/client';
import { printInvoice } from '@/lib/invoicePrint';

// An invoice may be printed only after payment is collected (status === 'paid').
// Once printed it is locked: only an admin may print it again (a corrected
// invoice after an amendment, or a duplicate copy). The server enforces the lock.
export const canPrintInvoice = (inv, isAdmin) =>
  !!inv && inv.status === 'paid' && (!inv.printed || isAdmin);

// Whether the user may still change the invoice (amounts, items, payment).
// Prefer the server's computed `_can_edit` when present.
export const canEditInvoice = (inv, isAdmin) => {
  if (!inv) return false;
  if (typeof inv._can_edit === 'boolean') return inv._can_edit;
  return !inv.printed || isAdmin;
};

// A readable message for invoice save errors (403 INVOICE_LOCKED and friends).
export const invoiceErrorMessage = (e) =>
  e?.code === 'INVOICE_LOCKED'
    ? 'This invoice has been printed and is locked. Only an admin can amend it.'
    : e?.message || 'Something went wrong.';

// Prints an invoice, marking it `printed: true` on the first print so it locks.
// `printed` lets the caller pass the freshest known print state (e.g. local UI
// state). Returns { ok, updated, error }.
export const printInvoiceRecord = async (inv, { isAdmin, printed, onPrinted, facility } = {}) => {
  if (!canPrintInvoice(inv, isAdmin)) return { ok: false };
  const wasPrinted = printed ?? !!inv.printed;
  const ok = printInvoice(inv, { reprint: wasPrinted, facility });
  if (!ok) return { ok: false, error: new Error('Allow pop-ups for this site to print the invoice.') };
  if (!wasPrinted) {
    try {
      const updated = await api.entities.Invoice.update(inv.id, { printed: true });
      onPrinted?.(updated);
      return { ok: true, updated };
    } catch (e) {
      // the sheet was printed; report that the lock could not be recorded
      return { ok: true, error: e };
    }
  }
  return { ok: true };
};
