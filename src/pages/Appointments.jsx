import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Video, MapPin, CheckCircle2, FileText, Eye, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole, canUseEMR, canAccessUser } from '@/lib/roles';
import WhatsAppConsultButton from '@/components/scheduling/WhatsAppConsultButton';
import InvoiceViewDialog from '@/components/reception/InvoiceViewDialog';
import DailyListViewToggle from '@/components/appointments/DailyListViewToggle';
import PrintRxButton from '@/components/appointments/PrintRxButton';
import ChangeDoctorDialog from '@/components/appointments/ChangeDoctorDialog';
import Dashboard from '@/pages/Dashboard';
import { todayISO, addDaysISO } from '@/lib/clinicDate';

function fmtDate(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }

const statusStyle = {
  booked: 'bg-amber-100 text-amber-700',
  checked_in: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-rose-100 text-rose-700',
  no_show: 'bg-zinc-200 text-zinc-700',
};

// Pastel palette distinct from the app's teal/rose interface tokens.
const PASTELS = [
  { bar: 'bg-[#E6E0FF]', dot: '#7C6BE8', chip: 'bg-[#EEE9FF] text-[#5b4ba0]' },
  { bar: 'bg-[#FFE3D1]', dot: '#F09B5A', chip: 'bg-[#FFEFE0] text-[#b06a3e]' },
  { bar: 'bg-[#D6F5E1]', dot: '#5BBF8A', chip: 'bg-[#E4F8EC] text-[#3f8a63]' },
  { bar: 'bg-[#FFF4C2]', dot: '#E0C44A', chip: 'bg-[#FFF8D6] text-[#a07f1e]' },
  { bar: 'bg-[#D6EEFF]', dot: '#6AA8E0', chip: 'bg-[#E4F2FF] text-[#3f74a8]' },
  { bar: 'bg-[#FFD9E0]', dot: '#E88AA0', chip: 'bg-[#FFE5EB] text-[#b04a63]' },
  { bar: 'bg-[#F0E0FF]', dot: '#A57FD9', chip: 'bg-[#F5EBFF] text-[#6a4aa0]' },
  { bar: 'bg-[#DCE9D2]', dot: '#8FBA6E', chip: 'bg-[#E8F0DF] text-[#5a7a44]' },
  { bar: 'bg-[#FFD9C9]', dot: '#F09B7A', chip: 'bg-[#FFE7DB] text-[#b05a3e]' },
  { bar: 'bg-[#D9E2FF]', dot: '#7E8FE0', chip: 'bg-[#E7EBFF] text-[#4a5aa8]' },
];

export default function Appointments() {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [activeDoctor, setActiveDoctor] = useState(null);
  // The list always opens on "All" doctors, whatever the role.
  const [viewAll, setViewAll] = useState(true);
  const [facility, setFacility] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState({});
  const [invoices, setInvoices] = useState({});
  const [emrs, setEmrs] = useState({});
  const [viewing, setViewing] = useState(null);
  const [changeFor, setChangeFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('worklist');
  const { user } = useAuth();
  const location = useLocation();
  const role = normalizeRole(user?.effectiveRole || user?.role);
  // EMR is clinical: only the booked doctor may open a patient's EMR, and never from
  // the Reception module's Daily List (that worklist belongs to the front desk).
  const fromFrontDesk = new URLSearchParams(location.search).get('src') === 'frontdesk';
  const canOpenEMR = canUseEMR(user) && !fromFrontDesk;
  const isReception = role === 'reception';
  // Doctors and front desk can flip between the worklist and the dashboard — only if they have dashboard access.
  const showToggle = (role === 'doctor' || isReception) && canAccessUser(user, '/');

  const refreshInvoice = (updated) => {
    if (!updated?.appointment_id) return;
    setInvoices((prev) => (prev[updated.appointment_id]
      ? { ...prev, [updated.appointment_id]: { ...prev[updated.appointment_id], ...updated } }
      : prev));
  };

  const doctorPalette = useMemo(() => {
    const map = {};
    doctors.forEach((d, i) => { map[d.id] = PASTELS[i % PASTELS.length]; });
    return map;
  }, [doctors]);

  const doctorsById = useMemo(() => Object.fromEntries(doctors.map((d) => [d.id, d])), [doctors]);

  useEffect(() => {
    (async () => {
      try {
        const [docs, fac] = await Promise.all([
          api.entities.Doctor.filter({}, { sort: 'name', limit: 50 }),
          api.entities.Facility.list({ limit: 1 }),
        ]);
        setDoctors(docs.items);
        setFacility((fac.items || [])[0] || null);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (!activeDoctor && !viewAll) return;
    (async () => {
      setLoading(true);
      try {
        // Cancelled appointments stay on the list, marked as cancelled.
        const query = viewAll ? { date } : { doctor_id: activeDoctor.id, date };
        const { items } = await api.entities.Appointment.filter(
          query,
          { sort: 'start_time', limit: 500 }
        );
        setAppointments(items);
        // load the patients behind these appointments so we can open WhatsApp for online consults
        const ids = [...new Set(items.map((a) => a.patient_id).filter(Boolean))];
        if (ids.length) {
          const { items: pts } = await api.entities.Patient.filter({ id: { $in: ids } }, { limit: 200 });
          setPatients(Object.fromEntries(pts.map((p) => [p.id, p])));
        } else {
          setPatients({});
        }
        // load the bills raised for these visits so both reception and doctors can view them
        const apptIds = items.map((a) => a.id);
        if (apptIds.length) {
          const { items: invs } = await api.entities.Invoice.filter({ appointment_id: { $in: apptIds } }, { limit: 500 });
          setInvoices(Object.fromEntries(invs.map((inv) => [inv.appointment_id, inv])));
        } else {
          setInvoices({});
        }
        // prescriptions already written for these visits, so both the doctor and the desk can print them
        if (apptIds.length) {
          const { items: emrItems } = await api.entities.EMR.filter({ appointment_id: { $in: apptIds } }, { limit: 500 });
          setEmrs(Object.fromEntries(emrItems.map((e) => [e.appointment_id, e])));
        } else {
          setEmrs({});
        }
      } catch (e) {
        toast({ title: 'Could not load appointments', description: e?.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [activeDoctor, date, viewAll]);

  const checkIn = async (appt) => {
    try {
      const updated = await api.entities.Appointment.update(appt.id, { status: 'checked_in' });
      setAppointments((list) => list.map((a) => (a.id === appt.id ? updated : a)));
      toast({ title: 'Checked in', description: `${appt.patient_name} moved to EMR` });
    } catch (e) {
      toast({ title: 'Could not check in', description: e?.message, variant: 'destructive' });
    }
  };

  const cancelAppointment = async (appt) => {
    if (appt.status === 'cancelled') return;
    if (!window.confirm(`Cancel the appointment for ${appt.patient_name} at ${appt.start_time}?`)) return;
    try {
      const updated = await api.entities.Appointment.update(appt.id, { status: 'cancelled' });
      setAppointments((list) => list.map((a) => (a.id === appt.id ? updated : a)));
      toast({ title: 'Appointment cancelled', description: 'Kept on the list, marked as cancelled.' });
    } catch (e) {
      toast({ title: 'Could not cancel appointment', description: e?.message, variant: 'destructive' });
    }
  };

  const shiftDate = (delta) => setDate(addDaysISO(date, delta));

  return (
    <>
      {showToggle && (
        <div className="mx-auto max-w-5xl px-6 pt-8 lg:px-10">
          <DailyListViewToggle value={view} onChange={setView} />
        </div>
      )}

      {view === 'dashboard' ? (
        <Dashboard />
      ) : (
        <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold">Daily Appointment List</h1>
            <p className="mt-1 text-muted-foreground">Check in arrivals to move them into the EMR.</p>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button
              onClick={() => { setViewAll(true); setActiveDoctor(null); }}
              className={cn('rounded-full border px-4 py-2 text-sm font-medium transition-all', viewAll ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground/70 hover:border-primary/40')}
            >
              All
            </button>
            {doctors.map((d) => {
              const pal = doctorPalette[d.id];
              return (
                <button
                  key={d.id}
                  onClick={() => { setViewAll(false); setActiveDoctor(d); }}
                  className={cn('rounded-full border px-4 py-2 text-sm font-medium transition-all', !viewAll && activeDoctor?.id === d.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground/70 hover:border-primary/40')}
                >
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: pal?.dot || d.color || '#0f766e' }} />
                  {d.name}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
            <p className="font-display text-lg font-semibold capitalize">{fmtDate(new Date(date + 'T00:00:00'))}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>Today</Button>
              <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : appointments.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No appointments for this day.</div>
            ) : (
              <div className="divide-y divide-border">
                {appointments.map((a) => {
                  const pal = viewAll ? doctorPalette[a.doctor_id] : null;
                  const rowDoctor = viewAll ? doctorsById[a.doctor_id] : activeDoctor;
                  return (
                    <div key={a.id} className={cn('relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between', viewAll && pal && 'bg-[#fdfdfb]', a.status === 'cancelled' && 'bg-muted/40')}>
                      {viewAll && pal && <span className={cn('absolute left-0 top-0 h-full w-1.5', pal.bar)} />}
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="font-display text-lg font-semibold">{a.start_time}</p>
                          <p className="text-[11px] text-muted-foreground">{a.duration_minutes} min</p>
                        </div>
                        <div className="h-10 w-px bg-border" />
                        <div>
                          <p className={cn('font-medium text-foreground', a.status === 'cancelled' && 'line-through opacity-70')}>{a.patient_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{a.mrn}</p>
                            {viewAll && pal && (
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', pal.chip)}>
                                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: pal.dot }} />
                                {a.doctor_name || rowDoctor?.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', a.type === 'online' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700')}>
                          {a.type === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                          {a.type === 'online' ? 'Online' : 'In-clinic'}
                        </span>
                        <div className="flex flex-col items-start gap-1">
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium capitalize', statusStyle[a.status])}>{a.status.replace('_', ' ')}</span>
                          {a.status === 'checked_in' && (
                            <button
                              onClick={() => setChangeFor(a)}
                              className="pl-1 text-[11px] font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                            >
                              Change
                            </button>
                          )}
                        </div>
                        {a.type === 'online' && a.status !== 'cancelled' && (
                          <WhatsAppConsultButton appointment={a} patient={patients[a.patient_id]} doctor={rowDoctor} facility={facility} />
                        )}
                        {a.status === 'booked' && (
                          <Button size="sm" onClick={() => checkIn(a)} className="gap-1.5 rounded-lg">
                            <CheckCircle2 className="h-4 w-4" /> Check In
                          </Button>
                        )}
                        {(a.status === 'booked' || a.status === 'checked_in') && (
                          <Button size="sm" variant="outline" onClick={() => cancelAppointment(a)} className="gap-1.5 rounded-lg text-rose-700 hover:text-rose-800">
                            <XCircle className="h-4 w-4" /> Cancel
                          </Button>
                        )}
                        {invoices[a.id] && (
                          <Button size="sm" variant="outline" onClick={() => setViewing(invoices[a.id])} className="gap-1.5 rounded-lg">
                            <Eye className="h-4 w-4" /> View Bill
                          </Button>
                        )}
                        <PrintRxButton appointment={a} emr={emrs[a.id]} doctor={rowDoctor} facility={facility} />
                        {(a.status === 'checked_in' || a.status === 'completed') && canOpenEMR && a.doctor_id === user?.doctor_id && (
                          <Link to={`/emr/${a.id}`}>
                            <Button size="sm" variant="secondary" className="gap-1.5 rounded-lg">
                              <FileText className="h-4 w-4" /> Open EMR
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <InvoiceViewDialog
        invoice={viewing}
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        onPrinted={refreshInvoice}
      />

      <ChangeDoctorDialog
        appointment={changeFor}
        doctors={doctors}
        open={!!changeFor}
        onOpenChange={(o) => !o && setChangeFor(null)}
        onSaved={(updated) => setAppointments((list) => {
          // a single-doctor view no longer holds a patient moved to another doctor
          if (!viewAll && activeDoctor && updated.doctor_id !== activeDoctor.id) {
            return list.filter((a) => a.id !== updated.id);
          }
          return list.map((a) => (a.id === updated.id ? updated : a));
        })}
      />
    </>
  );
}