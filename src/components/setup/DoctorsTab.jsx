import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Globe, Upload, ImageOff } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCNIC, formatMobile } from '@/lib/formatId';
import UserPermissionsPanel from '@/components/setup/UserPermissionsPanel';
import UserLoginPanel from '@/components/setup/UserLoginPanel';

const TITLES = ['Dr.', 'Prof. Dr.', 'Assoc. Prof. Dr.', 'Asst. Prof. Dr.'];
const empty = {
  title: 'Dr.', first_name: '', last_name: '', specialization: '', pmdc: '', cnic: '',
  sex: '', father_husband: '',
  mobile: '', email: '', address: '', place_of_posting: '', consultation_fee: '', followup_fee: '', color: '#0f766e',
  permissions: [], landing_page: '/',
  show_on_website: true, photo_url: '', bio: '',
};

export default function DoctorsTab({ canEditCharges = true, user }) {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await api.entities.Doctor.filter({}, { sort: 'name', limit: 100 });
      setDoctors(items);
    } catch (e) {
      toast({ title: 'Could not load doctors', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (d) => {
    setForm({
      ...empty,
      ...d,
      consultation_fee: d.consultation_fee ?? '',
      followup_fee: d.followup_fee ?? '',
      show_on_website: d.show_on_website !== false,
      photo_url: d.photo_url || '',
      bio: d.bio || '',
    });
    setEditId(d.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.first_name || !form.last_name) {
      toast({ title: 'First and last name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { is_admin: _legacyAdmin, ...rest } = form;
      const payload = {
        ...rest,
        name: `${form.title} ${form.first_name} ${form.last_name}`.trim(),
        consultation_fee: form.consultation_fee === '' ? null : Number(form.consultation_fee),
        followup_fee: form.followup_fee === '' ? null : Number(form.followup_fee),
      };
      if (editId) {
        await api.entities.Doctor.update(editId, payload);
        setOpen(false);
        load();
        toast({ title: 'Doctor updated' });
      } else {
        const created = await api.entities.Doctor.create(payload);
        setEditId(created.id);
        setForm((f) => ({ ...f, ...payload }));
        toast({ title: 'Doctor saved — now assign permissions', description: 'Roles & Permission is enabled below.' });
      }
    } catch (e) {
      toast({ title: 'Could not save doctor', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d) => {
    if (!confirm(`Delete ${d.name}?`)) return;
    try {
      await api.entities.Doctor.delete(d.id);
      load();
      toast({ title: 'Doctor deleted' });
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
    }
  };

  const rs = (v) => (v != null ? `Rs ${v}` : '—');

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast({ title: 'Choose a JPG, PNG or WebP image', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await api.files.uploadPublic(file);
      setForm((f) => ({ ...f, photo_url: file_url }));
    } catch (e) {
      toast({ title: 'Could not upload photo', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Doctors</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add Doctor</Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">PMDC</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Posting</th>
                  <th className="px-4 py-3">1st Visit</th>
                  <th className="px-4 py-3">Followup</th>
                  <th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: d.color || '#0f766e' }} />
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.specialization || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.pmdc || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.mobile ? formatMobile(d.mobile) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.place_of_posting || '—'}</td>
                    <td className="px-4 py-3">{rs(d.consultation_fee)}</td>
                    <td className="px-4 py-3">{rs(d.followup_fee)}</td>
                    <td className="px-4 py-3">
                      {d.show_on_website !== false ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><Globe className="h-3 w-3" aria-hidden="true" /> Listed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(d)} className="rounded-md p-1.5 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(d)} className="rounded-md p-1.5 text-destructive hover:bg-accent"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {doctors.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">No doctors yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editId ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Select value={form.title} onValueChange={(v) => setForm({ ...form, title: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>First name *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Last name *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Father / Husband Name</Label><Input value={form.father_husband} onChange={(e) => setForm({ ...form, father_husband: e.target.value })} /></div>
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
            <div className="space-y-1.5"><Label>PMDC #</Label><Input value={form.pmdc} onChange={(e) => setForm({ ...form, pmdc: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>CNIC</Label><Input value={formatCNIC(form.cnic)} onChange={(e) => setForm({ ...form, cnic: formatCNIC(e.target.value) })} placeholder="XXXXX-XXXXXXX-X" inputMode="numeric" /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input value={formatMobile(form.mobile)} onChange={(e) => setForm({ ...form, mobile: formatMobile(e.target.value) })} placeholder="03XX-XXXXXXX" inputMode="numeric" /></div>
            <div className="space-y-1.5"><Label>Place of Posting</Label><Input value={form.place_of_posting} onChange={(e) => setForm({ ...form, place_of_posting: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>First visit fee (Rs)</Label><Input type="number" value={form.consultation_fee} onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })} disabled={!canEditCharges} /></div>
            <div className="space-y-1.5"><Label>Followup fee (Rs)</Label><Input type="number" value={form.followup_fee} onChange={(e) => setForm({ ...form, followup_fee: e.target.value })} disabled={!canEditCharges} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5">
              <Label>Calendar color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color || '#0f766e'} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-12 rounded-md border border-border" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div className="col-span-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="doctor-website" className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="h-4 w-4 text-primary" aria-hidden="true" /> Show on the clinic website
                </Label>
                <Switch
                  id="doctor-website"
                  checked={form.show_on_website !== false}
                  onCheckedChange={(v) => setForm({ ...form, show_on_website: v })}
                />
              </div>
              <div className="flex items-center gap-3">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="" className="h-16 w-16 rounded-xl border border-border object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                    <ImageOff className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-1.5" disabled={uploading}>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4" aria-hidden="true" /> {uploading ? 'Uploading…' : form.photo_url ? 'Change photo' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                  </Button>
                  {form.photo_url && (
                    <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, photo_url: '' })}>Remove</Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doctor-bio">Short bio (shown on the website)</Label>
                <Textarea id="doctor-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Qualifications, experience and areas of interest" />
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <UserPermissionsPanel
              recordId={editId}
              entity="Doctor"
              role="doctor"
              initialPermissions={form.permissions}
              initialLanding={form.landing_page}
              canEdit={canEditCharges}
            />
            <UserLoginPanel
              kind="doctor"
              recordId={editId}
              email={form.email}
              fullName={`${form.title} ${form.first_name} ${form.last_name}`.trim()}
              role="doctor"
              canEdit={canEditCharges}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>{editId ? 'Close' : 'Cancel'}</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}