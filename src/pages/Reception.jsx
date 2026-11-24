import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CheckCircle2, Clock, XCircle, UserX, Wallet, HandCoins, Eye, Printer, Pencil, FileWarning } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import CollectPaymentDialog from '@/components/reception/CollectPaymentDialog';
import InvoiceViewDialog from '@/components/reception/InvoiceViewDialog';
import EditInvoiceDialog from '@/components/reception/EditInvoiceDialog';
import PrintRxButton from '@/components/appointments/PrintRxButton';
import { printInvoiceRecord, canPrintInvoice, canEditInvoice } from '@/lib/invoicePrintFlow';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { mrnDisplay } from '@/lib/formatId';
import { todayISO } from '@/lib/clinicDate';
const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`;
const grandOf = (inv) => Number(inv?.total || 0);

const statusStyle = {
  booked: { label: 'Booked', icon: Clock, cls: 'bg-amber-100 text-amber-800' },
  checked_in: { label: 'Checked in', icon: Clock, cls: 'bg-sky-100 text-sky-800' },
  completed: { label: 'Completed', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'bg-rose-100 text-rose-800' },
  no_show: { label: 'No show', icon: UserX, cls: 'bg-zinc-200 text-zinc-800' },
};

export default function Reception() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.effectiveRole || user?.role);
  const [date, setDate] = useState(todayISO());
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [emrs, setEmrs] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = async (d) => {
    setLoading(true);
    try {
      const apptsRes = await api.entities.Appointment.filter(
        { date: d, status: { $ne: 'cancelled' } },
        { sort: 'start_time', limit: 500 }
      );
      const appts = apptsRes.items || [];
      setAppointments(appts);
      const ids = appts.map((a) => a.id);
      let invs = [];
      if (ids.length) {
        const invRes = await api.entities.Invoice.filter(
          { appointment_id: { $in: ids } },
          { limit: 500 }
        );
        invs = invRes.items || [];
      }
      setInvoices(invs);
      // prescriptions written on these visits, so the desk can print them
      let emrItems = [];
      if (ids.length) {
        const emrRes = await api.entities.EMR.filter(
          { appointment_id: { $in: ids } },
          { limit: 500 }
        );
        emrItems = emrRes.items || [];
      }
      setEmrs(Object.fromEntries(emrItems.map((e) => [e.appointment_id, e])));
      const docIds = [...new Set(appts.map((a) => a.doctor_id).filter(Boolean))];
      if (docIds.length) {
        const docsRes = await api.entities.Doctor.filter(
          { id: { $in: docIds } },
          { limit: 100 }
        );
        setDoctors(docsRes.items || []);
      } else {
        setDoctors([]);
      }
    } catch (e) {
      toast({ title: 'Could not load worklist', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  useEffect(() => {
    api.entities.Facility.list({ limit: 1 })
      .then((r) => setFacility((r.items || [])[0] || null))
      .catch(() => {});
  }, []);

  const doctorById = useMemo(
    () => Object.fromEntries(doctors.map((d) => [d.id, d])),
    [doctors]
  );

  const invoiceByAppt = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => { map[inv.appointment_id] = inv; });
    return map;
  }, [invoices]);

  // group appointments by doctor
  const byDoctor = useMemo(() => {
    const groups = {};
    appointments.forEach((a) => {
      const key = a.doctor_id || '_none';
      if (!groups[key]) groups[key] = { doctor_id: key, doctor_name: a.doctor_name || 'Unassigned', visits: [], charges: 0 };
      groups[key].visits.push(a);
      const inv = invoiceByAppt[a.id];
      if (inv) groups[key].charges += grandOf(inv);
    });
    return Object.values(groups).sort((a, b) => a.doctor_name.localeCompare(b.doctor_name));
  }, [appointments, invoiceByAppt]);

  const grand = useMemo(() => ({
    visits: appointments.length,
    charges: invoices.reduce((s, i) => s + grandOf(i), 0),
    collected: invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
    outstanding: invoices.reduce((s, i) => s + Math.max(0, grandOf(i) - Number(i.amount_paid || 0)), 0),
  }), [appointments, byDoctor, invoices]);

  const refreshInvoice = (updated) => {
    if (!updated?.id) return;
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setViewing((v) => (v && v.id === updated.id ? { ...v, ...updated } : v));
  };

  const printRow = async (inv) => {
    const res = await printInvoiceRecord(inv, { isAdmin, facility, onPrinted: refreshInvoice });
    if (res.error) {
      toast({
        title: res.ok ? 'Printed, but the invoice could not be locked' : 'Could not print',
        description: res.error.message,
        variant: 'destructive',
      });
    }
  };

  // Calendar arithmetic on the YYYY-MM-DD string itself, independent of the browser timezone.
  const shiftDay = (dir) => {
    const d = new Date(date + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + dir);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Front Desk · Daily Worklist</h1>
          <p className="text-sm text-muted-foreground">Bills raised on completed visits, grouped by doctor</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDay(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 pl-9" />
          </div>
          <button onClick={() => shiftDay(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* End of day summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Total visits</p>
          <p className="mt-1 font-display text-3xl font-semibold">{grand.visits}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Billed (incl. tax)</p>
          <p className="mt-1 font-display text-3xl font-semibold text-primary">{money(grand.charges)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Collected</p>
          <p className="mt-1 font-display text-3xl font-semibold text-emerald-700">{money(grand.collected)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</p>
          <p className="mt-1 font-display text-3xl font-semibold text-amber-700">{money(grand.outstanding)}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading worklist…</div>
      ) : byDoctor.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No appointments for this date.
        </div>
      ) : (
        <div className="space-y-5">
          {byDoctor.map((g) => (
            <div key={g.doctor_id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-emerald-50/50 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-lg font-semibold">{g.doctor_name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Visits: <span className="font-semibold text-foreground">{g.visits.length}</span></span>
                  <span className="text-muted-foreground">Charges: <span className="font-semibold text-primary">{money(g.charges)}</span></span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {g.visits.map((a) => {
                  const inv = invoiceByAppt[a.id];
                  const st = statusStyle[a.status] || statusStyle.booked;
                  const StIcon = st.icon;
                  return (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground">{a.start_time}</span>
                        <div>
                          <p className="text-sm font-medium">{a.patient_name}</p>
                          <p className="text-xs text-muted-foreground">MRN {mrnDisplay(a.mrn) || '—'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                          <StIcon className="h-3 w-3" /> {st.label}
                        </span>
                        <PrintRxButton
                          appointment={a}
                          emr={emrs[a.id]}
                          doctor={doctorById[a.doctor_id]}
                          facility={facility}
                        />
                        {inv ? (
                          <div className="flex items-center gap-2">
                            {inv.is_corrected && (
                              <span title={`Corrected invoice${inv.revision ? ` · revision ${inv.revision}` : ''}`} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-800">
                                <FileWarning className="h-3 w-3" /> Corrected
                              </span>
                            )}
                            {inv.status !== 'paid' && canEditInvoice(inv, isAdmin) && (
                              <Button size="sm" className="gap-1.5" onClick={() => setCollecting(inv)}>
                                <HandCoins className="h-3.5 w-3.5" /> Collect
                              </Button>
                            )}
                            {isAdmin && (
                              <button title={inv.printed ? 'Amend invoice (issues a corrected invoice)' : 'Edit invoice'} onClick={() => setEditing(inv)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-primary">
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            <button title="View invoice" onClick={() => setViewing(inv)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-primary">
                              <Eye className="h-4 w-4" />
                            </button>
                            {canPrintInvoice(inv, isAdmin) && (
                              <button title={!inv.printed ? 'Print invoice' : inv.is_corrected ? 'Print corrected invoice' : 'Reprint (duplicate copy)'} onClick={() => printRow(inv)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-primary">
                                <Printer className="h-4 w-4" />
                              </button>
                            )}
                            <div className="flex items-center gap-4">
                              <div className="min-w-[78px] text-center">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Charges</p>
                                <p className="text-sm font-semibold">{money(grandOf(inv))}</p>
                              </div>
                              <div className="min-w-[78px] text-center">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                                <p className="text-sm font-semibold text-emerald-700">{money(Number(inv.amount_paid || 0))}</p>
                              </div>
                              <div className="min-w-[78px] text-center">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
                                <p className="text-sm font-semibold text-rose-700">{money(Math.max(0, grandOf(inv) - Number(inv.amount_paid || 0)))}</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No bill</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <CollectPaymentDialog
        invoice={collecting}
        open={!!collecting}
        onOpenChange={(o) => !o && setCollecting(null)}
        onSettled={refreshInvoice}
        facility={facility}
      />
      <InvoiceViewDialog
        invoice={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onPrinted={refreshInvoice}
        onEdit={(inv) => { setViewing(null); setEditing(inv); }}
        facility={facility}
      />
      <EditInvoiceDialog
        invoice={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={refreshInvoice}
        facility={facility}
      />
    </div>
  );
}