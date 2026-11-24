import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Phone, CreditCard, Hash, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatCNIC, formatMobile } from '@/lib/formatId';

function generateMRN() {
  const y = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MRN-${y}-${rand}`;
}

const emptyForm = { first_name: '', last_name: '', sex: '', father_husband: '', cnic: '', mobile: '', address: '' };

export default function Patients() {
  const { toast } = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const q = {};
      if (query.trim()) {
        const rx = { $regex: query.trim(), $options: 'i' };
        q.$or = [
          { name: rx }, { first_name: rx }, { last_name: rx },
          { cnic: rx }, { mobile: rx }, { mrn: rx },
          { father_husband: rx }, { profession: rx }, { referred_by: rx },
          { previous_diagnosis: rx }, { address: rx }, { age: rx }, { sex: rx },
        ];
      }
      const { items } = await api.entities.Patient.filter(q, { sort: '-created_date', limit: 50 });
      setPatients(items);
    } catch (e) {
      toast({ title: 'Could not load patients', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPatients(); }, []);

  const onSearch = (e) => { e.preventDefault(); loadPatients(); };

  const openNew = () => { setForm(emptyForm); setShowForm(true); };

  const savePatient = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.mobile) {
      toast({ title: 'First name, last name and mobile are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const record = await api.entities.Patient.create({ ...form, mrn: generateMRN() });
      setPatients((p) => [record, ...p]);
      setShowForm(false);
      toast({ title: 'Patient registered', description: record.mrn });
    } catch (err) {
      toast({ title: 'Could not save patient', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Registration</h1>
          <p className="mt-1 text-muted-foreground">Register new patients and search the master database.</p>
        </div>
        <Button onClick={openNew} className="gap-2 rounded-xl">
          <UserPlus className="h-4 w-4" /> New Patient
        </Button>
      </div>

      <form onSubmit={onSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, MRN, CNIC, mobile, profession, referred by…"
            className="rounded-xl pl-10"
          />
        </div>
        <Button type="submit" variant="secondary" className="rounded-xl">Search</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading patients…</div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No patients found.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {patients.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-accent font-display text-base font-semibold text-accent-foreground">
                    {p.first_name?.[0]}{p.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-muted-foreground">{p.mrn}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground sm:text-right">
                  <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.mobile ? formatMobile(p.mobile) : '—'}</span>
                  <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />{p.cnic ? formatCNIC(p.cnic) : '—'}</span>
                  <Link to={`/patients/${p.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                    <FolderOpen className="h-3.5 w-3.5" /> File
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Register New Patient</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePatient} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>First name <span className="text-destructive">*</span></Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Last name <span className="text-destructive">*</span></Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>CNIC</Label>
                <Input value={formatCNIC(form.cnic)} onChange={(e) => setForm({ ...form, cnic: formatCNIC(e.target.value) })} placeholder="XXXXX-XXXXXXX-X" inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile <span className="text-destructive">*</span></Label>
                <Input value={formatMobile(form.mobile)} onChange={(e) => setForm({ ...form, mobile: formatMobile(e.target.value) })} required placeholder="03XX-XXXXXXX" inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Father / Husband Name</Label>
                <Input value={form.father_husband} onChange={(e) => setForm({ ...form, father_husband: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.sex || undefined} onValueChange={(v) => setForm({ ...form, sex: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" /> MRN will be generated automatically.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register Patient'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}