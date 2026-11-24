import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, CalendarClock, Stethoscope, Video, Lock, History, ShieldAlert } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import MultiSelect from '@/components/MultiSelect';
import BillingSection, { computeBilling } from '@/components/emr/BillingSection';
import PrescriptionBuilder from '@/components/emr/PrescriptionBuilder';
import RxViewDialog from '@/components/emr/RxViewDialog';
import LastVisitDialog from '@/components/emr/LastVisitDialog';
import AddendaSection from '@/components/emr/AddendaSection';
import { doctorNameWithTitle, printRxSlip } from '@/lib/rxSlip';
import { praTaxOf, praRateFor, DEFAULT_PRA_RATE } from '@/lib/praTax';
import { mrnDisplay } from '@/lib/formatId';
import { formatClinicDateTime } from '@/lib/clinicDate';
import { invoiceErrorMessage } from '@/lib/invoicePrintFlow';
import WhatsAppConsultButton from '@/components/scheduling/WhatsAppConsultButton';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/roles';
import { useEmrDraft } from '@/hooks/use-emr-draft';

const textFields = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_chief_complaint', label: 'H/O Chief Complaint' },
  { key: 'past_history', label: 'Past History' },
  { key: 'allergies', label: 'Known Allergies / Reactions' },
  { key: 'differential_diagnosis', label: 'Differential Diagnosis' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'advise', label: 'Advise' },
];

// The clinical fields a doctor writes; everything else on the record is set
// from the appointment or by the server.
const CHART_FIELDS = [
  ...textFields.map((t) => t.key),
  'labs_tests', 'prescription', 'services_offered', 'procedures_performed', 'followup_date',
];
const pickChart = (f) =>
  Object.fromEntries(CHART_FIELDS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]));

// A chart is only written once something has actually been entered.
const chartHasContent = (f) =>
  textFields.some((t) => (f[t.key] || '').trim()) ||
  Boolean(
    (f.prescription || '').trim() ||
    f.followup_date ||
    (f.labs_tests || []).length ||
    (f.services_offered || []).length ||
    (f.procedures_performed || []).length
  );

const isEmrLockedError = (e) => e?.code === 'EMR_LOCKED' || (e?.status === 403 && /lock/i.test(e?.message || ''));

export default function EMR() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.effectiveRole || user?.role);
  const [appt, setAppt] = useState(null);
  const [record, setRecord] = useState(null);
  const [catalog, setCatalog] = useState({ services: [], procedures: [], labs: [] });
  const [doctor, setDoctor] = useState(null);
  const [patient, setPatient] = useState(null);
  const [facility, setFacility] = useState(null);
  const [visitType, setVisitType] = useState('consultation');
  const [praRate, setPraRate] = useState(DEFAULT_PRA_RATE);
  const [invoice, setInvoice] = useState(null);
  const [paid, setPaid] = useState(false);
  // Set when the server refuses a save because the record's editing day has passed.
  const [serverLocked, setServerLocked] = useState(false);
  // Only the doctor the patient is booked with may open and write this EMR.
  const isOwner = Boolean(user?.doctor_id) && Boolean(appt) && appt.doctor_id === user.doctor_id;
  // Once an invoice is printed it is locked; only an admin may amend it (from the Front Desk).
  const invoiceLocked = !!invoice?.printed && !isAdmin;
  // The attending doctor may edit a saved EMR only on the clinic day it was first saved.
  const emrLocked = !isOwner || serverLocked || (record ? record._can_edit === false : false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoState, setAutoState] = useState('idle');
  const [rxOpen, setRxOpen] = useState(false);
  // The chart of this patient's previous visit, for the doctor's reference.
  const [lastVisit, setLastVisit] = useState(null);
  const [lastVisitOpen, setLastVisitOpen] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState(null);
  // Clinical entries are kept as a draft so nothing is lost on logout or a dropped session.
  const { draft, saveDraft, clearDraft } = useEmrDraft(appointmentId, user?.id || user?.email);
  const prescriptionFlush = useRef(null);
  const apptRef = useRef(null);
  const formRef = useRef({});
  const recordRef = useRef(null);
  const touched = useRef(false);
  const savingRef = useRef(false);
  const autoTimer = useRef(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const appointment = await api.entities.Appointment.get(appointmentId);
        setAppt(appointment);
        // Another doctor's patient: show the restriction screen and load nothing clinical.
        if (!user?.doctor_id || appointment.doctor_id !== user.doctor_id) return;
        const [svc, proc, lab, emrs, invoices, patientRec, fac, rate, pastEmrs] = await Promise.all([
          api.entities.Service.list({ sort: 'name', limit: 200 }),
          api.entities.Procedure.list({ sort: 'name', limit: 200 }),
          api.entities.LabTest.list({ sort: 'name', limit: 200 }),
          api.entities.EMR.filter({ appointment_id: appointmentId }, { limit: 5 }),
          api.entities.Invoice.filter({ appointment_id: appointmentId }, { limit: 5 }),
          appointment.patient_id ? api.entities.Patient.get(appointment.patient_id) : Promise.resolve(null),
          api.entities.Facility.list({ limit: 1 }),
          praRateFor(appointment.date),
          appointment.patient_id
            ? api.entities.EMR.filter({ patient_id: appointment.patient_id }, { sort: '-visit_date', limit: 20 })
            : Promise.resolve({ items: [] }),
        ]);
        // This patient's most recent earlier visit that this doctor may read in full.
        const prevEmr = (pastEmrs.items || []).find(
          (e) => e.appointment_id !== appointmentId && e._access === 'full'
        ) || null;
        if (prevEmr) {
          const fromAppointment = prevEmr.appointment_id && !String(prevEmr.appointment_id).startsWith('imported');
          const [prevAppt, prevInvoices] = await Promise.all([
            fromAppointment
              ? api.entities.Appointment.get(prevEmr.appointment_id).catch(() => null)
              : Promise.resolve(null),
            fromAppointment
              ? api.entities.Invoice.filter({ appointment_id: prevEmr.appointment_id }, { limit: 1 }).catch(() => ({ items: [] }))
              : Promise.resolve({ items: [] }),
          ]);
          setLastVisit({ emr: prevEmr, appointment: prevAppt, invoice: (prevInvoices.items || [])[0] || null });
        }
        setPatient(patientRec);
        setFacility((fac.items || [])[0] || null);
        setPraRate(rate);
        const activeServices = svc.items.filter((s) => s.active !== false);
        const activeProcedures = proc.items.filter((p) => p.active !== false);
        setCatalog({
          services: activeServices.map((s) => ({ name: s.name, price: s.price })),
          procedures: activeProcedures.map((p) => ({ name: p.name, price: p.price })),
          labs: lab.items.filter((l) => l.active !== false).map((l) => l.name),
        });
        // doctor fees
        if (appointment.doctor_id) {
          try {
            const doc = await api.entities.Doctor.get(appointment.doctor_id);
            setDoctor(doc);
          } catch (e) { /* doctor may be unavailable */ }
        }
        const existing = emrs.items[0];
        const existingLocked = existing && existing._can_edit === false;
        // A draft only applies while the record can still be edited.
        const usableDraft = existingLocked ? null : draft;
        if (existingLocked && draft) clearDraft();
        if (existing) {
          setRecord(existing);
          setForm(usableDraft ? { ...existing, ...usableDraft } : existing);
        } else {
          setForm({
            labs_tests: [], services_offered: [], procedures_performed: [],
            followup_date: '',
            ...(usableDraft || {}),
          });
        }
        if (usableDraft) {
          toast({ title: 'Unsaved draft restored', description: 'Your earlier entries for this visit were recovered.' });
        }
        const existingInvoice = invoices.items[0];
        if (existingInvoice) {
          setInvoice(existingInvoice);
          setVisitType(existingInvoice.visit_type || 'consultation');
          setPaid(existingInvoice.status === 'paid');
        }
      } catch (e) {
        toast({ title: 'Could not load record', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [appointmentId]);

  const setField = (key, val) => {
    touched.current = true;
    setForm((f) => ({ ...f, [key]: val }));
  };

  // Keep the latest values reachable from listeners registered only once.
  useEffect(() => {
    apptRef.current = appt;
    formRef.current = form;
    recordRef.current = record;
    lockedRef.current = emrLocked;
  });

  // Keep the draft in step with whatever is typed, prescription lines included.
  useEffect(() => {
    if (loading || emrLocked) return;
    saveDraft(form);
  }, [form, loading, emrLocked, saveDraft]);

  const onLocked = () => {
    setServerLocked(true);
    clearDraft();
    toast({
      title: 'This EMR is locked',
      description: 'A record can be edited only on the day it was first saved. Add missed information as an addendum.',
      variant: 'destructive',
    });
  };

  // Creates or updates the clinical record itself; invoices are never touched here.
  const writeChart = async (f, prescription) => {
    const a = apptRef.current;
    const payload = {
      ...pickChart(f),
      prescription,
      appointment_id: appointmentId,
      patient_id: a.patient_id,
      patient_name: a.patient_name,
      mrn: a.mrn,
      doctor_id: a.doctor_id,
      doctor_name: a.doctor_name,
      visit_date: a.date,
    };
    if (recordRef.current) {
      const updated = await api.entities.EMR.update(recordRef.current.id, payload);
      recordRef.current = updated;
      setRecord(updated);
      return updated;
    }
    const created = await api.entities.EMR.create(payload);
    recordRef.current = created;
    setRecord(created);
    return created;
  };

  // Anything typed into the chart is written back on its own, so stepping away
  // from the EMR — deliberately or by accident — never loses it.
  useEffect(() => {
    if (loading || !appt || emrLocked || !touched.current || savingRef.current) return;
    if (!chartHasContent(form)) return;
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(async () => {
      setAutoState('saving');
      try {
        await writeChart(form, form.prescription || '');
        clearDraft();
        setAutoSavedAt(new Date());
        setAutoState('saved');
      } catch (e) {
        if (isEmrLockedError(e)) { setAutoState('idle'); onLocked(); }
        else setAutoState('error');
      }
    }, 1200);
    return () => clearTimeout(autoTimer.current);
  }, [form, loading, appt, emrLocked, clearDraft]);

  // Leaving the page writes the chart too, including a medication still sitting
  // in the composer that was never added to the grid.
  useEffect(() => {
    const leave = () => {
      if (lockedRef.current || !touched.current || !apptRef.current) return;
      const flushed = prescriptionFlush.current?.();
      const f = flushed == null ? formRef.current : { ...formRef.current, prescription: flushed };
      if (!chartHasContent(f)) return;
      writeChart(f, f.prescription || '').catch(() => {});
    };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, []);

  const save = async () => {
    if (emrLocked) return;
    setSaving(true);
    savingRef.current = true;
    clearTimeout(autoTimer.current);
    try {
      // Anything still sitting in the prescription composer joins the chart.
      const flushedRx = prescriptionFlush.current?.();
      const prescription = flushedRx ?? form.prescription ?? '';
      let chart;
      try {
        chart = await writeChart(form, prescription);
      } catch (e) {
        if (isEmrLockedError(e)) onLocked();
        else toast({ title: 'Could not save EMR', description: e.message, variant: 'destructive' });
        return;
      }
      const emrId = chart?.id;
      // persist invoice — locked once printed (admin override only, from the Front Desk)
      let invoiceProblem = null;
      if (!invoiceLocked) {
        const billing = computeBilling({
          doctor, visitType,
          services: form.services_offered || [],
          procedures: form.procedures_performed || [],
          catalog,
        });
        const subtotal = billing.total;
        // PRA tax sits inside the consultation charge, so it never adds to the total.
        const taxRate = praRate;
        const taxAmount = praTaxOf(billing.consultationFee, taxRate);
        const grandTotal = subtotal;
        const prevPaid = Number(invoice?.amount_paid || 0);
        const prevBalance = Math.max(0, grandTotal - prevPaid);
        const invoicePayload = {
          appointment_id: appointmentId,
          patient_id: appt.patient_id,
          patient_name: appt.patient_name,
          mrn: appt.mrn,
          doctor_id: appt.doctor_id,
          doctor_name: appt.doctor_name,
          emr_id: emrId,
          visit_type: visitType,
          visit_date: appt.date,
          visit_time: appt.start_time,
          consultation_fee: billing.consultationFee,
          service_items: form.services_offered || [],
          services_total: billing.servicesTotal,
          procedure_items: form.procedures_performed || [],
          procedures_total: billing.proceduresTotal,
          total: subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          amount_paid: prevPaid,
          balance: prevBalance,
          status: prevBalance <= 0 && prevPaid > 0 ? 'paid' : (invoice?.status || 'unpaid'),
        };
        try {
          if (invoice) {
            const updatedInvoice = await api.entities.Invoice.update(invoice.id, invoicePayload);
            setInvoice(updatedInvoice);
          } else {
            const createdInvoice = await api.entities.Invoice.create(invoicePayload);
            setInvoice(createdInvoice);
          }
        } catch (e) {
          invoiceProblem = invoiceErrorMessage(e);
          if (e?.code === 'INVOICE_LOCKED') setInvoice((inv) => (inv ? { ...inv, printed: true } : inv));
        }
      }
      // mark appointment completed
      if (appt.status !== 'completed') {
        try {
          const updatedAppt = await api.entities.Appointment.update(appt.id, { status: 'completed' });
          setAppt(updatedAppt);
        } catch (e) {
          toast({ title: 'EMR saved, but the appointment was not marked complete', description: e.message, variant: 'destructive' });
        }
      }
      clearDraft();
      setAutoSavedAt(new Date());
      setAutoState('saved');
      if (invoiceProblem) {
        toast({ title: 'EMR saved — invoice not updated', description: invoiceProblem, variant: 'destructive' });
      } else {
        toast({ title: 'EMR saved', description: 'Appointment marked complete' });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading record…</div>;
  if (!appt) return <div className="p-10 text-center text-sm text-muted-foreground">Appointment not found.</div>;

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 lg:px-10">
        <Link to="/appointments" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to daily list
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold">EMR restricted to the attending doctor</h1>
              <p className="mt-2 text-sm leading-relaxed">
                This patient is booked with <span className="font-semibold">{appt.doctor_name || 'another doctor'}</span> — only
                the attending doctor can open the EMR. Change the attending physician from the Daily List to take over.
              </p>
              <p className="mt-2 text-xs text-amber-800">
                {appt.patient_name} · {appt.date} · {appt.start_time}
              </p>
              <Button className="mt-4" onClick={() => navigate('/appointments')}>Go to Daily List</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // The slip shown by View Rx and sent to the printer by Print Rx.
  const rx = {
    doctorName: doctorNameWithTitle(doctor, appt.doctor_name),
    specialization: doctor?.specialization || '',
    patientName: appt.patient_name,
    mrn: appt.mrn,
    visitDate: appt.date,
    visitTime: appt.start_time,
    prescription: form.prescription || '',
    labsTests: form.labs_tests || [],
    advise: form.advise || '',
    followupDate: form.followup_date || '',
    facility,
  };
  const hasRx = Boolean((form.prescription || '').trim() || (form.labs_tests || []).length);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <Link to="/appointments" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to daily list
      </Link>

      {/* Header card */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">Electronic Medical Record</p>
            <h1 className="mt-1 font-display text-2xl font-semibold">{appt.patient_name}</h1>
            <p className="text-sm text-muted-foreground">MRN {mrnDisplay(appt.mrn)}</p>
            {lastVisit && (
              <button
                type="button"
                onClick={() => setLastVisitOpen(true)}
                className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-blue-600 underline underline-offset-4 transition-colors hover:text-blue-700"
              >
                <History className="h-4 w-4" /> Last Visit
                {lastVisit.emr?.visit_date ? ` · ${lastVisit.emr.visit_date}` : ''}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Stethoscope className="h-4 w-4" /> {appt.doctor_name}</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="h-4 w-4" /> {appt.date} · {appt.start_time}</span>
          </div>
        </div>
      </div>

      {emrLocked && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This EMR is locked{record?.created_date ? ` — it was first saved ${formatClinicDateTime(record.created_date)}` : ''}.
            A record can be edited only on the day it is first saved. Use <span className="font-semibold">Addenda</span> below
            to add any missed information; each addendum is stamped with the date and time.
          </p>
        </div>
      )}

      {appt.type === 'online' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex items-center gap-3 text-sm text-violet-900">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700"><Video className="h-4 w-4" /></span>
            <p>This is an <span className="font-semibold">online consultation</span> — the consultation is conducted on WhatsApp. Share this chat with the patient to start.</p>
          </div>
          <WhatsAppConsultButton appointment={appt} patient={patient} doctor={doctor} facility={facility} label="Start WhatsApp Consult" />
        </div>
      )}

      <div className="space-y-5">
        {/* Textual fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          {textFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Textarea
                rows={2}
                value={form[f.key] || ''}
                onChange={(e) => setField(f.key, e.target.value)}
                disabled={emrLocked}
              />
            </div>
          ))}
        </div>

        {/* Dropdown selects */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Investigations & Services</h2>
          <div className="space-y-5">
            <MultiSelect label="Labs / Tests" options={catalog.labs} value={form.labs_tests || []} onChange={(v) => setField('labs_tests', v)} placeholder="No lab tests configured" disabled={emrLocked} />
            <MultiSelect label="Services Offered" options={catalog.services.map((s) => s.name)} value={form.services_offered || []} onChange={(v) => setField('services_offered', v)} placeholder="No services configured" disabled={invoiceLocked || emrLocked} />
            <MultiSelect label="Procedures Performed" options={catalog.procedures.map((p) => p.name)} value={form.procedures_performed || []} onChange={(v) => setField('procedures_performed', v)} placeholder="No procedures configured" disabled={invoiceLocked || emrLocked} />
          </div>
        </div>

        {/* Prescription */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Prescription</h2>
          <PrescriptionBuilder value={form.prescription || ''} onChange={(v) => setField('prescription', v)} flushRef={prescriptionFlush} readOnly={emrLocked} />
          <div className="mt-3 flex items-center justify-end gap-4 border-t border-border pt-3">
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setRxOpen(true)} disabled={!hasRx}>
              View Rx
            </Button>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => printRxSlip(rx)} disabled={!hasRx}>
              Print Rx
            </Button>
          </div>
        </div>

        {/* Follow up */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="max-w-xs space-y-1.5">
            <Label>Follow-up date</Label>
            <Input type="date" value={form.followup_date || ''} onChange={(e) => setField('followup_date', e.target.value)} disabled={emrLocked} />
          </div>
        </div>

        {/* Addenda: dated notes on a saved record */}
        {record?.id && <AddendaSection emrId={record.id} canAdd={isOwner} locked={emrLocked} />}

        {/* Billing */}
        <BillingSection
          doctor={doctor}
          praRate={praRate}
          visitType={visitType}
          setVisitType={setVisitType}
          services={form.services_offered || []}
          procedures={form.procedures_performed || []}
          catalog={catalog}
          paid={paid}
          setPaid={setPaid}
          locked={invoiceLocked || emrLocked}
          lockReason={invoiceLocked ? 'invoice' : emrLocked ? 'emr' : null}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {autoState === 'saving' && 'Auto-saving…'}
            {autoState === 'saved' && autoSavedAt && `Auto-saved at ${autoSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            {autoState === 'error' && 'Auto-save failed — press Save EMR to retry'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/appointments')}>{emrLocked ? 'Back' : 'Cancel'}</Button>
            <Button onClick={save} disabled={saving || emrLocked} className="gap-2">
              {emrLocked ? <Lock className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : emrLocked ? 'Locked' : 'Save EMR'}
            </Button>
          </div>
        </div>
      </div>

      <RxViewDialog open={rxOpen} onOpenChange={setRxOpen} rx={rx} />
      <LastVisitDialog open={lastVisitOpen} onOpenChange={setLastVisitOpen} lastVisit={lastVisit} />
    </div>
  );
}
