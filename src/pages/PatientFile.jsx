import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, CreditCard, MapPin, Stethoscope, CalendarClock, FlaskConical, Wrench, Activity, ArrowUpRight, Lock, Pill } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { formatCNIC, formatMobile, mrnDisplay } from '@/lib/formatId';
import { useAuth } from '@/lib/AuthContext';
import { canUseEMR } from '@/lib/roles';
import { rxLines } from '@/lib/rxSlip';

const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const summaryFields = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'history_chief_complaint', label: 'H/O Chief Complaint' },
  { key: 'past_history', label: 'Past History' },
  { key: 'allergies', label: 'Allergies / Reactions' },
  { key: 'differential_diagnosis', label: 'Differential Diagnosis' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'advise', label: 'Advise' },
];

const isImported = (v) => String(v.appointment_id || '').startsWith('imported') || v.doctor_id === 'imported';

export default function PatientFile() {
  const { patientId } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  // The EMR is clinical; only doctor roles get the link to open a visit record.
  const canOpenEMR = canUseEMR(user);
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, emrs] = await Promise.all([
          api.entities.Patient.get(patientId),
          // Clinical fields come back only on records this user may read in full (_access: 'full').
          api.entities.EMR.filter({ patient_id: patientId }, { sort: '-visit_date', limit: 200 }),
        ]);
        setPatient(p);
        setVisits(emrs.items);
      } catch (e) {
        toast({ title: 'Could not load patient file', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Loading patient file…</div>;
  if (!patient) return <div className="p-10 text-center text-sm text-muted-foreground">Patient not found.</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <Link to="/patients" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      {/* Patient header */}
      <div className="mb-8 rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">Patient File</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">{patient.first_name} {patient.last_name}</h1>
        <p className="text-sm text-muted-foreground">MRN {mrnDisplay(patient.mrn)}</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{patient.mobile ? formatMobile(patient.mobile) : '—'}</span>
          <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />{patient.cnic ? formatCNIC(patient.cnic) : '—'}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{patient.address || '—'}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Visit History</h2>
        <span className="text-sm text-muted-foreground">{visits.length} {visits.length === 1 ? 'visit' : 'visits'}</span>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No visits recorded yet.
        </div>
      ) : (
        <div className="space-y-5">
          {visits.map((v) => (
            <div key={v.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <span className="font-medium">{fmtDate(v.visit_date)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Stethoscope className="h-3.5 w-3.5" /> {v.doctor_name || '—'}
                  </div>
                </div>
                {v.appointment_id && !isImported(v) && canOpenEMR && v._access === 'full' && v.doctor_id === user?.doctor_id && (
                  <Link to={`/emr/${v.appointment_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Open record <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                {isImported(v) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Imported</span>
                )}
              </div>

              {v._access === 'full' ? (
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {summaryFields.map((f) => (
                    <div key={f.key}>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{f.label}</p>
                      <p className="mt-0.5 whitespace-pre-line text-sm">{v[f.key] || <span className="text-muted-foreground">—</span>}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    <Lock className="h-3 w-3" /> Clinical notes restricted to the attending doctor
                  </p>
                  {(v.advise || '').trim() && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Advise</p>
                      <p className="mt-0.5 whitespace-pre-line text-sm">{v.advise}</p>
                    </div>
                  )}
                </div>
              )}

              {rxLines(v.prescription).length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Pill className="h-3 w-3" /> Prescription
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                    {rxLines(v.prescription).map((line, i) => <li key={i}>{line}</li>)}
                  </ol>
                </div>
              )}

              {(v.labs_tests?.length || v.services_offered?.length || v.procedures_performed?.length) > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {v.labs_tests?.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700"><FlaskConical className="h-3 w-3" /> {v.labs_tests.join(', ')}</span>
                  )}
                  {v.services_offered?.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700"><Wrench className="h-3 w-3" /> {v.services_offered.join(', ')}</span>
                  )}
                  {v.procedures_performed?.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"><Activity className="h-3 w-3" /> {v.procedures_performed.join(', ')}</span>
                  )}
                </div>
              )}

              {v.followup_date && (
                <p className="mt-3 text-xs text-muted-foreground">Follow-up: <span className="font-medium text-foreground">{fmtDate(v.followup_date)}</span></p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}