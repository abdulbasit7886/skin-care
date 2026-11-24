import React, { useEffect, useRef, useState } from 'react';
import { Building2, Save, Loader2, ImagePlus } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Image } from '@/components/ui/image';

const EMPTY = {
  name: '',
  address: '',
  contact_number: '',
  proprietor_1: '',
  proprietor_2: '',
  registration_number: '',
  email: '',
  website: '',
  tax_number: '',
  logo_url: '',
};

export default function FacilityTab() {
  const { toast } = useToast();
  const [facility, setFacility] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.entities.Facility.list({ limit: 1 });
      const existing = (res.items || [])[0] || null;
      setFacility(existing);
      setForm(existing ? { ...EMPTY, ...existing } : EMPTY);
    } catch (e) {
      toast({ title: 'Could not load facility details', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.files.uploadPublic(file);
      setForm((f) => ({ ...f, logo_url: file_url }));
    } catch (err) {
      toast({ title: 'Logo upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = () => setForm((f) => ({ ...f, logo_url: '' }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast({ title: 'Facility name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address,
        contact_number: form.contact_number,
        proprietor_1: form.proprietor_1,
        proprietor_2: form.proprietor_2,
        registration_number: form.registration_number,
        email: form.email,
        website: form.website,
        tax_number: form.tax_number,
        logo_url: form.logo_url,
      };
      if (!facility?.id) {
        toast({ title: 'No facility selected', description: 'The Super Admin adds facilities under Facilities.', variant: 'destructive' });
        return;
      }
      const updated = await api.entities.Facility.update(facility.id, payload);
      setFacility(updated);
      toast({ title: 'Facility details saved' });
    } catch (err) {
      toast({ title: 'Could not save facility details', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="inline-flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Facility Registration</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          These details identify your clinic across the app and printed invoices.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {/* Logo */}
        <div className="mb-6">
          <Label>Facility logo</Label>
          <div className="mt-2 flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-border bg-secondary">
              {form.logo_url ? (
                <Image src={form.logo_url} alt="Facility logo" fittingType="fit" className="h-full w-full" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Uploading…' : form.logo_url ? 'Change logo' : 'Upload logo'}
              </Button>
              {form.logo_url && (
                <Button type="button" variant="ghost" onClick={removeLogo}>Remove</Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Facility name *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Dr Safoora Skin Chemistry" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Textarea value={form.address} onChange={set('address')} rows={2} placeholder="Street, city, postal code" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact number</Label>
            <Input value={form.contact_number} onChange={set('contact_number')} placeholder="Phone / landline" />
          </div>
          <div className="space-y-1.5">
            <Label>Facility registration #</Label>
            <Input value={form.registration_number} onChange={set('registration_number')} placeholder="Registration number" />
          </div>
          <div className="space-y-1.5">
            <Label>Proprietor #1</Label>
            <Input value={form.proprietor_1} onChange={set('proprietor_1')} placeholder="Primary proprietor" />
          </div>
          <div className="space-y-1.5">
            <Label>Proprietor #2</Label>
            <Input value={form.proprietor_2} onChange={set('proprietor_2')} placeholder="Secondary proprietor" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set('email')} placeholder="clinic@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={form.website} onChange={set('website')} placeholder="https://example.com" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tax / NTN number</Label>
            <Input value={form.tax_number} onChange={set('tax_number')} placeholder="National tax number" />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save facility details'}
          </Button>
        </div>
      </div>
    </form>
  );
}