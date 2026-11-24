import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Video, MapPin, X, ScanLine } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { formatCNIC, formatMobile } from '@/lib/formatId';
import { todayISO as clinicToday, addDaysISO, clinicTimeHHMM } from '@/lib/clinicDate';
import BookingConfirmationDialog from '@/components/scheduling/BookingConfirmationDialog';

const SLOT_START = 12; // 12:00 noon
const SLOT_END = 20;   // 20:00 last start 19:45
const STEP = 15;

function pad(n) { return String(n).padStart(2, '0'); }
function slotTimes() {
  const out = [];
  for (let h = SLOT_START; h < SLOT_END; h++) {
    for (let m = 0; m < 60; m += STEP) out.push(`${pad(h)}:${pad(m)}`);
  }
  return out;
}
function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const emptyPatient = { first_name: '', last_name: '', cnic: '', mobile: '', address: '' };

export default function Scheduling() {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [activeDoctor, setActiveDoctor] = useState(null);
  const [date, setDate] = useState(clinicToday());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null); // { time } | null
  const [patients, setPatients] = useState([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [scanOnly, setScanOnly] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [newPatient, setNewPatient] = useState(emptyPatient);
  const [mode, setMode] = useState('existing'); // existing | new
  const [duration, setDuration] = useState(15);
  const [type, setType] = useState('in_clinic');
  const [reason, setReason] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [facility, setFacility] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // { appointment, patient, doctor }
  const [cancelledReport, setCancelledReport] = useState(null); // { items }

  useEffect(() => {
    (async () => {
      try {
        const [docs, fac] = await Promise.all([
          api.entities.Doctor.filter({}, { sort: 'name', limit: 50 }),
          api.entities.Facility.list({ limit: 1 }),
        ]);
        const sorted = [...docs.items].sort((a, b) => {
          const as = (a.name || '').toLowerCase().includes('safoora') ? 0 : 1;
          const bs = (b.name || '').toLowerCase().includes('safoora') ? 0 : 1;
          return as - bs;
        });
        setDoctors(sorted);
        if (sorted[0]) setActiveDoctor(sorted[0]);
        setFacility((fac.items || [])[0] || null);
      } catch (e) {
        toast({ title: 'Could not load doctors', description: e?.message, variant: 'destructive' });
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeDoctor) return;
    (async () => {
      setLoading(true);
      try {
        const { items } = await api.entities.Appointment.filter(
          { doctor_id: activeDoctor.id, date },
          { sort: 'start_time', limit: 200 }
        );
        setAppointments(items);
      } catch (e) {
        toast({ title: 'Could not load appointments', description: e?.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [activeDoctor, date]);

  const loadPatients = async () => {
    try {
      const { items } = await api.entities.Patient.filter({}, { sort: '-created_date', limit: 100 });
      setPatients(items);
    } catch (e) { /* ignore */ }
  };

  const openBooking = (time) => {
    setBooking({ time });
    setDuration(15);
    setType('in_clinic');
    setReason('');
    setBookingDoctor(activeDoctor);
    setSelectedPatient(null);
    setNewPatient(emptyPatient);
    setMode('existing');
    setPatientQuery('');
    loadPatients();
  };

  const filteredPatients = patients.filter((p) => {
    const q = patientQuery.toLowerCase();
    const haystack = `${p.name || ''} ${p.first_name} ${p.last_name} ${p.mrn} ${p.mobile} ${p.cnic} ${p.father_husband || ''} ${p.profession || ''} ${p.referred_by || ''} ${p.previous_diagnosis || ''} ${p.age || ''} ${p.sex || ''} ${p.address || ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!scanOnly || !!p.chart_image_uri);
  });

  const saveBooking = async () => {
    if (!bookingDoctor) {
      toast({ title: 'Select a doctor', variant: 'destructive' });
      return;
    }
    let patient = selectedPatient;
    if (mode === 'new') {
      if (!newPatient.first_name || !newPatient.last_name || !newPatient.mobile) {
        toast({ title: 'First name, last name and mobile required', variant: 'destructive' });
        return;
      }
      setSaving(true);
      try {
        const y = new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        patient = await api.entities.Patient.create({ ...newPatient, mrn: `MRN-${y}-${rand}` });
      } catch (e) {
        toast({ title: 'Could not register patient', description: e?.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    } else if (!patient) {
      toast({ title: 'Select a patient', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const appt = await api.entities.Appointment.create({
        patient_id: patient.id,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        mrn: patient.mrn,
        doctor_id: bookingDoctor.id,
        doctor_name: bookingDoctor.name,
        date,
        start_time: booking.time,
        duration_minutes: duration,
        type,
        reason,
        status: 'booked',
      });
      setAppointments((a) => [...a, appt].sort((x, y) => x.start_time.localeCompare(y.start_time)));
      setBooking(null);
      setConfirmation({ appointment: appt, patient, doctor: bookingDoctor });
      toast({ title: 'Appointment booked', description: `${patient.first_name} ${patient.last_name} · ${bookingDoctor.name} · ${booking.time}` });
    } catch (e) {
      toast({ title: 'Could not book appointment', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const apptsAt = (time) => appointments.filter((a) => a.start_time === time);

  const cancelAppointment = async (appt) => {
    if (appt.status === 'cancelled') return;
    if (!window.confirm(`Cancel appointment for ${appt.patient_name} at ${appt.start_time}?`)) return;
    try {
      const updated = await api.entities.Appointment.update(appt.id, { status: 'cancelled' });
      setAppointments((a) => a.map((x) => (x.id === appt.id ? updated : x)));
      toast({ title: 'Appointment cancelled' });
    } catch (e) {
      toast({ title: 'Could not cancel appointment', description: e?.message, variant: 'destructive' });
    }
  };

  const openCancelledReport = async () => {
    try {
      const { items } = await api.entities.Appointment.filter(
        { date, status: 'cancelled' },
        { sort: 'start_time', limit: 200 }
      );
      setCancelledReport({ items });
    } catch (e) {
      toast({ title: 'Could not load cancelled appointments', description: e?.message, variant: 'destructive' });
    }
  };

  const printCancelledReport = () => {
    const rows = cancelledReport?.items || [];
    const title = `Cancelled Appointments — ${fmtDate(new Date(date + 'T00:00:00'))}`;
    const body = rows.map((a) => `<tr><td>${a.start_time || ''}</td><td>${a.patient_name || ''}</td><td>${a.mrn || ''}</td><td>${a.doctor_name || ''}</td><td>${a.type === 'online' ? 'Online' : 'In-clinic'}</td><td>${(a.reason || '').replace(/</g, '<')}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#1f2937}h1{font-size:18px;margin:0 0 4px}p{color:#6b7280;margin:0 0 16px;font-size:13px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}th{background:#f3f4f6;font-size:11px;text-transform:uppercase;color:#6b7280}</style></head><body><h1>Dr Safoora Skin Chemistry</h1><p>${title}</p><table><thead><tr><th>Time</th><th>Patient</th><th>MRN</th><th>Doctor</th><th>Type</th><th>Reason</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast({ title: 'Allow pop-ups to print', variant: 'destructive' }); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print();
  };

  const todayStr = clinicToday();
  const nowHM = clinicTimeHHMM();
  const isPastSlot = (time) => date === todayStr && time <= nowHM;

  const shiftDate = (delta) => {
    setDate(addDaysISO(date, delta));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Scheduling</h1>
        <p className="mt-1 text-muted-foreground">Book appointments across doctors. 15-minute slots, up to 60 minutes. Parallel bookings allowed.</p>
      </div>

      {/* Doctor tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {doctors.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDoctor(d)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-all',
              activeDoctor?.id === d.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground/70 hover:border-primary/40'
            )}
          >
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: d.color || '#0f766e' }} />
            {d.name}
          </button>
        ))}
      </div>

      {/* Date nav */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="text-center">
          <p className="font-display text-lg font-semibold capitalize">{fmtDate(new Date(date + 'T00:00:00'))}</p>
          <p className="text-xs text-muted-foreground">{activeDoctor?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDate(clinicToday())}>Today</Button>
          <Button variant="outline" size="sm" onClick={openCancelledReport}>Cancelled report</Button>
          <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading calendar…</div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            {slotTimes().map((time) => {
              const appts = apptsAt(time);
              return (
                <div key={time} className="flex border-b border-border last:border-0">
                  <div className="w-16 shrink-0 px-3 py-3 text-xs font-medium text-muted-foreground">{time}</div>
                  {(() => {
                    const past = isPastSlot(time);
                    return (
                      <div
                        onClick={() => !past && openBooking(time)}
                        className={cn(
                          'flex-1 px-3 py-2.5 text-left transition-colors',
                          past && appts.length === 0 ? 'cursor-not-allowed bg-muted/40 opacity-50' : 'cursor-pointer hover:bg-accent/30'
                        )}
                      >
                        <div className="flex flex-wrap gap-2">
                          {appts.map((a) => {
                            const cancelled = a.status === 'cancelled';
                            return (
                              <span
                                key={a.id}
                                className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium', cancelled ? 'bg-destructive/90 text-destructive-foreground line-through opacity-90' : 'text-white')}
                                style={cancelled ? undefined : { background: activeDoctor?.color || '#0f766e' }}
                              >
                                {a.type === 'online' ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                {a.patient_name}
                                <span className="opacity-80">· {a.duration_minutes}m</span>
                                {!cancelled && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); cancelAppointment(a); }}
                                    className="ml-0.5 inline-flex items-center justify-center rounded-full bg-black/20 px-1 leading-none hover:bg-black/40"
                                    title="Cancel appointment"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                          {appts.length === 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                              {past ? 'Passed' : (<><Plus className="h-3 w-3" /> Book</>)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={!!booking} onOpenChange={(o) => !o && setBooking(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              New Appointment <span className="text-muted-foreground">· {booking?.time}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Doctor */}
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select value={bookingDoctor?.id} onValueChange={(v) => setBookingDoctor(doctors.find((d) => d.id === v))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: d.color || '#0f766e' }} />
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Patient mode toggle */}
            <div className="flex gap-2 rounded-xl bg-muted p-1">
              <button onClick={() => setMode('existing')} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-medium', mode === 'existing' ? 'bg-card shadow-sm' : 'text-muted-foreground')}>Existing patient</button>
              <button onClick={() => setMode('new')} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-medium', mode === 'new' ? 'bg-card shadow-sm' : 'text-muted-foreground')}>New patient</button>
            </div>

            {mode === 'existing' ? (
              <div className="space-y-2">
                <Label>Search patient</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Name, MRN, mobile, father/husband, profession…" className="pl-9" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScanOnly((s) => !s)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', scanOnly ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}
                  >
                    <ScanLine className="h-3 w-3" /> Scanned charts only
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border scrollbar-thin">
                  {filteredPatients.slice(0, 30).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/40', selectedPatient?.id === p.id && 'bg-primary/10')}
                    >
                      <span className="flex items-center gap-1.5">
                        {p.first_name} {p.last_name}
                        {p.chart_image_uri && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Scanned</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.mrn}</span>
                    </button>
                  ))}
                  {filteredPatients.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No match.</p>}
                </div>
                {selectedPatient && (
                  <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
                    <p className="font-medium text-primary">{selectedPatient.first_name} {selectedPatient.last_name} · {selectedPatient.mrn}</p>
                    {(selectedPatient.father_husband || selectedPatient.profession || selectedPatient.referred_by || selectedPatient.previous_diagnosis) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[
                          selectedPatient.father_husband && `S/D of ${selectedPatient.father_husband}`,
                          selectedPatient.profession,
                          selectedPatient.referred_by && `Ref: ${selectedPatient.referred_by}`,
                          selectedPatient.previous_diagnosis,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>First name *</Label><Input value={newPatient.first_name} onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Last name *</Label><Input value={newPatient.last_name} onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Mobile *</Label><Input value={formatMobile(newPatient.mobile)} onChange={(e) => setNewPatient({ ...newPatient, mobile: formatMobile(e.target.value) })} placeholder="03XX-XXXXXXX" inputMode="numeric" /></div>
                <div className="space-y-1.5"><Label>CNIC</Label><Input value={formatCNIC(newPatient.cnic)} onChange={(e) => setNewPatient({ ...newPatient, cnic: formatCNIC(e.target.value) })} placeholder="XXXXX-XXXXXXX-X" inputMode="numeric" /></div>
                <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} /></div>
              </div>
            )}

            {/* Duration */}
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <div className="flex gap-2">
                {[15, 30, 45, 60].map((d) => (
                  <button key={d} onClick={() => setDuration(d)} className={cn('flex-1 rounded-lg border py-2 text-sm font-medium', duration === d ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground/70')}>{d} min</button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                <button onClick={() => setType('in_clinic')} className={cn('flex-1 inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium', type === 'in_clinic' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground/70')}><MapPin className="h-4 w-4" /> In-clinic</button>
                <button onClick={() => setType('online')} className={cn('flex-1 inline-flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium', type === 'online' ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground/70')}><Video className="h-4 w-4" /> Online</button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setBooking(null)}>Cancel</Button>
              <Button onClick={saveBooking} disabled={saving}>{saving ? 'Booking…' : 'Book Appointment'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelledReport} onOpenChange={(o) => !o && setCancelledReport(null)}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Cancelled Appointments — {fmtDate(new Date(date + 'T00:00:00'))}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(cancelledReport?.items || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No cancelled appointments for this date.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">MRN</th>
                      <th className="px-3 py-2">Doctor</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cancelledReport?.items || []).map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-3 py-2">{a.start_time}</td>
                        <td className="px-3 py-2">{a.patient_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.mrn || '—'}</td>
                        <td className="px-3 py-2">{a.doctor_name}</td>
                        <td className="px-3 py-2">{a.type === 'online' ? 'Online' : 'In-clinic'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{a.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCancelledReport(null)}>Close</Button>
              <Button onClick={printCancelledReport} disabled={(cancelledReport?.items || []).length === 0}>Print</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BookingConfirmationDialog
        appointment={confirmation?.appointment}
        patient={confirmation?.patient}
        doctor={confirmation?.doctor}
        facility={facility}
        open={!!confirmation}
        onOpenChange={(o) => !o && setConfirmation(null)}
      />
    </div>
  );
}