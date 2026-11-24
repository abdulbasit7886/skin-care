import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Upload, Loader2, Save, FileImage, FolderOpen, PenLine, AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatMobile, formatCNIC } from '@/lib/formatId';
import { todayISO } from '@/lib/clinicDate';
import VisitRowsEditor from '@/components/import/VisitRowsEditor';
import ChartPreview from '@/components/import/ChartPreview';
import OcrTextPanel, { OcrConfidenceBadge } from '@/components/import/OcrTextPanel';

const DEMO_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'father_husband', label: "Father's / Husband's" },
  { key: 'age', label: 'Age' },
  { key: 'sex', label: 'Sex' },
  { key: 'cnic', label: 'CNIC' },
  { key: 'contact_no', label: 'Contact No' },
  { key: 'address', label: 'Address' },
  { key: 'profession', label: 'Profession' },
  { key: 'referred_by', label: 'Referred by' },
  { key: 'previous_diagnosis', label: 'Previous Diagnosis' },
];

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

const emptyDemo = () => DEMO_FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});

function generateMRN() {
  const y = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MRN-${y}-${rand}`;
}

function splitName(full) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '-' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function normalizeDate(s) {
  if (!s) return '';
  const v = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = Date.parse(v);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return '';
}

// OCR demographics -> the form's fields
function demoFromExtraction(dg = {}) {
  const name = [dg.first_name, dg.last_name].map((s) => (s || '').trim()).filter(Boolean).join(' ') || dg.name || '';
  return {
    ...emptyDemo(),
    name,
    father_husband: dg.father_husband || '',
    age: dg.age || '',
    sex: dg.sex || '',
    cnic: dg.cnic || '',
    contact_no: dg.mobile || dg.contact_no || '',
    address: dg.address || '',
    profession: dg.profession || '',
    referred_by: dg.referred_by || '',
    previous_diagnosis: dg.previous_diagnosis || '',
  };
}

export default function ImportChart() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [busy, setBusy] = useState(null);       // 'ocr' | 'upload' | null
  const [saving, setSaving] = useState(false);
  const [fileUri, setFileUri] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [ocr, setOcr] = useState(null);         // { text, confidence, pages } when OCR ran
  const [demo, setDemo] = useState(emptyDemo());
  const [visits, setVisits] = useState([]);
  const [createdPatientId, setCreatedPatientId] = useState(null);

  // release the local preview when it changes or the page closes
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setFileUri(null);
    setReviewing(false);
    setOcr(null);
    setDemo(emptyDemo());
    setVisits([]);
    setCreatedPatientId(null);
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const okType = ACCEPTED.includes(f.type) || /\.(jpe?g|png|webp|pdf)$/i.test(f.name);
    if (!okType) {
      toast({ title: 'Unsupported file', description: 'Use a JPG, PNG, WebP image or a PDF of the A4 chart.', variant: 'destructive' });
      return;
    }
    if (f.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'The scan must be 15 MB or smaller.', variant: 'destructive' });
      return;
    }
    reset();
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const setField = (key, val) => setDemo((d) => ({ ...d, [key]: val }));

  // Upload once; reuse the stored chart for OCR retries and for saving.
  const ensureUploaded = async () => {
    if (fileUri) return fileUri;
    const { file_uri } = await api.files.uploadPrivate(file);
    setFileUri(file_uri);
    return file_uri;
  };

  const scan = async () => {
    if (!file) return;
    setBusy('ocr');
    try {
      const uri = await ensureUploaded();
      const res = await api.functions.invoke('extractPatientChart', { file_uri: uri });
      const data = res?.extraction || {};
      setDemo(demoFromExtraction(data.demographics || {}));
      setVisits(Array.isArray(data.visits) ? data.visits.map((v) => ({
        date: normalizeDate(v.date),
        presenting_complaint: v.presenting_complaint || '',
        diagnosis: v.diagnosis || '',
        management_procedure: v.management_procedure || '',
      })) : []);
      setOcr({ text: res?.text || '', confidence: typeof res?.confidence === 'number' ? res.confidence : null, pages: res?.pages || null });
      setReviewing(true);
      toast({ title: 'Chart scanned', description: 'Review every field before saving — OCR can misread handwriting.' });
    } catch (e) {
      toast({ title: 'Could not scan chart', description: e?.message || 'Try a clearer, straight A4 scan.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const enterManually = async () => {
    if (file) {
      setBusy('upload');
      try {
        await ensureUploaded();
      } catch (e) {
        toast({ title: 'Could not upload the chart', description: e?.message, variant: 'destructive' });
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    setOcr(null);
    setDemo(emptyDemo());
    setVisits([]);
    setReviewing(true);
  };

  const save = async () => {
    if (!demo.name?.trim()) {
      toast({ title: 'Patient name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { first_name, last_name } = splitName(demo.name);
      const mobile = formatMobile(demo.contact_no || '');
      const fieldPayload = {
        name: demo.name.trim(),
        first_name,
        last_name,
        mobile,
        cnic: demo.cnic ? formatCNIC(demo.cnic) : '',
        address: demo.address,
        father_husband: demo.father_husband,
        age: demo.age,
        sex: demo.sex,
        profession: demo.profession,
        referred_by: demo.referred_by,
        previous_diagnosis: demo.previous_diagnosis,
      };

      let patient = null;
      // "Save again" updates the patient created on the first save
      if (createdPatientId) {
        patient = await api.entities.Patient.get(createdPatientId).catch(() => null);
      }
      // match existing patient by mobile (exact) to avoid duplicates
      if (!patient && mobile) {
        const { items } = await api.entities.Patient.filter({ mobile }, { limit: 1 });
        if (items.length) patient = items[0];
      }

      if (patient) {
        // only fill in what the existing record is missing
        const patch = {};
        Object.entries(fieldPayload).forEach(([k, v]) => {
          if (v && !patient[k]) patch[k] = v;
        });
        if (fileUri && !patient.chart_image_uri) patch.chart_image_uri = fileUri;
        if (Object.keys(patch).length) patient = await api.entities.Patient.update(patient.id, patch);
      } else {
        const payload = Object.fromEntries(Object.entries(fieldPayload).filter(([, v]) => v !== ''));
        patient = await api.entities.Patient.create({
          ...payload,
          mrn: generateMRN(),
          ...(fileUri ? { chart_image_uri: fileUri } : {}),
        });
      }

      const validVisits = visits.filter((v) => normalizeDate(v.date) || v.presenting_complaint || v.diagnosis || v.management_procedure);
      if (validVisits.length) {
        await api.entities.EMR.bulkCreate(validVisits.map((v, i) => ({
          appointment_id: `imported:${patient.id}:${Date.now()}:${i}`,
          patient_id: patient.id,
          patient_name: patient.name || `${patient.first_name} ${patient.last_name}`,
          mrn: patient.mrn,
          doctor_id: 'imported',
          doctor_name: 'Imported record',
          visit_date: normalizeDate(v.date) || todayISO(),
          chief_complaint: v.presenting_complaint,
          diagnosis: v.diagnosis,
          treatment: v.management_procedure,
        })));
        // the rows are saved; clear them so "Save again" does not duplicate visits
        setVisits([]);
      }

      setCreatedPatientId(patient.id);
      toast({ title: 'Chart imported', description: `${validVisits.length} visit(s) added to the patient file.` });
    } catch (e) {
      toast({ title: 'Could not save chart', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Scan Patient Chart</h1>
        <p className="mt-1 text-muted-foreground">
          Upload a scanned A4 biodata / progress chart. OCR reads the demographics and visit history so you can review them into the patient file.
        </p>
      </div>

      <input ref={fileRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={pickFile} />

      {!reviewing ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-8 sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,320px)]">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <FileImage className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Select a clear, straight scan or photo of the A4 chart — JPG, PNG, WebP or PDF, up to 15 MB.
                Each page is normalised to an A4 sheet before OCR.
              </p>
              {file && <p className="mt-2 text-sm font-medium">{file.name}</p>}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2 rounded-xl" disabled={!!busy}>
                  <Upload className="h-4 w-4" /> {file ? 'Change file' : 'Choose file'}
                </Button>
                <Button onClick={scan} disabled={!file || !!busy} className="gap-2 rounded-xl">
                  {busy === 'ocr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  {busy === 'ocr' ? 'Reading chart…' : 'Scan with OCR'}
                </Button>
                <Button variant="ghost" onClick={enterManually} disabled={!!busy} className="gap-2 rounded-xl">
                  {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  Enter manually
                </Button>
              </div>
              {busy === 'ocr' && (
                <p className="mt-3 text-xs text-muted-foreground">OCR can take up to a minute for multi-page PDFs.</p>
              )}
            </div>
            {previewUrl ? (
              <ChartPreview url={previewUrl} file={file} />
            ) : (
              <div className="mx-auto aspect-[210/297] w-full max-w-[220px] rounded-sm border border-dashed border-border bg-muted/30" aria-hidden="true" />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><FileImage className="h-4 w-4" /> {file?.name || 'No chart attached'}</span>
              {ocr && <OcrConfidenceBadge confidence={ocr.confidence} />}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { reset(); fileRef.current?.click(); }} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Use a different chart
            </Button>
          </div>

          {ocr && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Review every field before saving — OCR can misread handwriting. Compare with the chart and the OCR text on the right.</p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Demographics</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {DEMO_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label>{f.label}</Label>
                      <Input
                        value={demo[f.key] || ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.key === 'contact_no' ? '03XX-XXXXXXX' : f.key === 'cnic' ? 'XXXXX-XXXXXXX-X' : ''}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-4 font-display text-lg font-semibold">Visit History</h2>
                <VisitRowsEditor visits={visits} onChange={setVisits} />
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              {previewUrl && <ChartPreview url={previewUrl} file={file} pages={ocr?.pages} />}
              {ocr && <OcrTextPanel text={ocr.text} confidence={ocr.confidence} pages={ocr.pages} />}
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            {createdPatientId && (
              <Button variant="outline" onClick={() => navigate(`/patients/${createdPatientId}`)} className="gap-2 rounded-xl">
                <FolderOpen className="h-4 w-4" /> Open patient file
              </Button>
            )}
            <Button onClick={save} disabled={saving} className="gap-2 rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : createdPatientId ? 'Save again' : 'Save to patient file'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
