import React from 'react';
import { CalendarClock, Stethoscope, Video, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { mrnDisplay } from '@/lib/formatId';
import LastVisitBilling from '@/components/emr/LastVisitBilling';

// The complete record of a patient's previous visit, read-only.
const SECTIONS = [
  ['chief_complaint', 'Chief Complaint'],
  ['history_chief_complaint', 'H/O Chief Complaint'],
  ['past_history', 'Past History'],
  ['allergies', 'Known Allergies / Reactions'],
  ['differential_diagnosis', 'Differential Diagnosis'],
  ['diagnosis', 'Diagnosis'],
  ['treatment', 'Treatment'],
  ['advise', 'Advise'],
];

const LIST_SECTIONS = [
  ['labs_tests', 'Labs / Tests'],
  ['services_offered', 'Services Offered'],
  ['procedures_performed', 'Procedures Performed'],
];

export default function LastVisitDialog({ open, onOpenChange, lastVisit }) {
  if (!lastVisit) return null;
  const { emr, appointment, invoice } = lastVisit;
  const filled = SECTIONS.filter(([key]) => (emr[key] || '').trim());
  const lists = LIST_SECTIONS.filter(([key]) => (emr[key] || []).length);
  const visitDate = emr.visit_date || appointment?.date || '';
  const visitTime = appointment?.start_time || invoice?.visit_time || '';
  const visitType = appointment?.type || (invoice ? 'in_clinic' : '');
  const hasChart =
    filled.length > 0 || lists.length > 0 || Boolean((emr.prescription || '').trim()) || Boolean(emr.followup_date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Last visit · {visitDate}</DialogTitle>
          <DialogDescription>
            {emr.patient_name || appointment?.patient_name}
            {emr.mrn || appointment?.mrn ? ` · MRN ${mrnDisplay(emr.mrn || appointment?.mrn)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-4 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4" /> {emr.doctor_name || appointment?.doctor_name || '—'}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> {visitDate}{visitTime ? ` · ${visitTime}` : ''}
          </span>
          {visitType && (
            <span className="inline-flex items-center gap-1.5">
              {visitType === 'online' ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {visitType === 'online' ? 'Online' : 'In-clinic'}
            </span>
          )}
        </div>

        {hasChart ? (
          <div className="space-y-4">
            {filled.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {filled.map(([key, label]) => (
                  <div key={key}>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                    <p className="whitespace-pre-line text-sm text-foreground">{emr[key]}</p>
                  </div>
                ))}
              </div>
            )}

            {lists.map(([key, label]) => (
              <div key={key}>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(emr[key] || []).map((item) => (
                    <span key={item} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">{item}</span>
                  ))}
                </div>
              </div>
            ))}

            {(emr.prescription || '').trim() && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Prescription</p>
                <p className="mt-1 whitespace-pre-line rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">{emr.prescription}</p>
              </div>
            )}

            {emr.followup_date && (
              <p className="text-sm text-muted-foreground">
                Follow-up advised: <span className="text-foreground">{emr.followup_date}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clinical entries were recorded on that visit.</p>
        )}

        <LastVisitBilling invoice={invoice} />
      </DialogContent>
    </Dialog>
  );
}