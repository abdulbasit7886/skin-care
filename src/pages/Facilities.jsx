import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Pencil, UserPlus, Users, Loader2, Ban, CheckCircle2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import PasswordChecklist, { isPasswordValid } from '@/components/PasswordChecklist';
import { ROLE_LABELS } from '@/lib/roles';
import { formatClinicDateTime } from '@/lib/clinicDate';
import { formatMobile } from '@/lib/formatId';

const FACILITY_FIELDS = [
  { key: 'name', label: 'Facility name *', span: 2 },
  { key: 'address', label: 'Address', span: 2 },
  { key: 'contact_number', label: 'Contact number' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'proprietor_1', label: 'Proprietor 1' },
  { key: 'proprietor_2', label: 'Proprietor 2' },
  { key: 'registration_number', label: 'Registration number' },
  { key: 'tax_number', label: 'Tax number (NTN / PRA)' },
  { key: 'website', label: 'Website', span: 2 },
];

const EMPTY_FACILITY = {
  name: '', address: '', contact_number: '', email: '', proprietor_1: '', proprietor_2: '',
  registration_number: '', tax_number: '', website: '', is_active: true,
};

const EMPTY_ADMIN = { full_name: '', username: '', email: '', password: '', confirm: '' };

// Super Admin: onboard healthcare facilities and create each facility's administrators.
export default function Facilities() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FACILITY);
  const [saving, setSaving] = useState(false);

  const [usersFor, setUsersFor] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [adminFor, setAdminFor] = useState(null);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.facilities.list();
      setItems(res.items || []);
    } catch (e) {
      toast({ title: 'Could not load facilities', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY_FACILITY); setEditId(null); setEditOpen(true); };
  const openEdit = (f) => {
    setForm({ ...EMPTY_FACILITY, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v ?? ''])), is_active: f.is_active !== false });
    setEditId(f.id);
    setEditOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Facility name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(FACILITY_FIELDS.map((f) => [f.key, (form[f.key] || '').trim()]));
      payload.is_active = !!form.is_active;
      if (editId) {
        await api.admin.facilities.update(editId, payload);
        toast({ title: 'Facility updated' });
      } else {
        await api.admin.facilities.create(payload);
        toast({
          title: 'Facility added',
          description: 'Next: add an administrator. Reload the page to see it in the facility switcher.',
        });
      }
      setEditOpen(false);
      load();
    } catch (e) {
      toast({ title: 'Could not save facility', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const loadUsers = async (facility) => {
    setUsersFor(facility);
    setUsers([]);
    setUsersLoading(true);
    try {
      const res = await api.admin.users.list({ facility_id: facility.id });
      setUsers(res.items || []);
    } catch (e) {
      toast({ title: 'Could not load users', description: e.message, variant: 'destructive' });
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleUser = async (u) => {
    try {
      const updated = await api.admin.users.update(u.id, { is_active: !u.is_active });
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
    } catch (e) {
      toast({ title: 'Could not update login', description: e.message, variant: 'destructive' });
    }
  };

  const openAdmin = (facility) => { setAdminFor(facility); setAdminForm(EMPTY_ADMIN); };

  const adminValid = adminForm.full_name.trim() && adminForm.username.trim() && isPasswordValid(adminForm.password, adminForm.confirm);

  const createAdmin = async () => {
    if (!adminValid) return;
    setCreatingAdmin(true);
    try {
      await api.admin.users.create({
        facility_id: adminFor.id,
        role: 'admin',
        full_name: adminForm.full_name.trim(),
        username: adminForm.username.trim(),
        email: adminForm.email.trim() || undefined,
        password: adminForm.password,
      });
      toast({ title: 'Administrator created', description: `${adminForm.username.trim()} can now log in to ${adminFor.name}.` });
      const fac = adminFor;
      setAdminFor(null);
      load();
      if (usersFor?.id === fac.id) loadUsers(fac);
    } catch (e) {
      toast({ title: 'Could not create administrator', description: e.message, variant: 'destructive' });
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Building2 className="h-7 w-7 text-primary" aria-hidden="true" /> Facilities
          </h1>
          <p className="mt-1 text-muted-foreground">Onboard healthcare facilities and create their administrators.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" aria-hidden="true" /> Add facility</Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Users</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{f.name}</p>
                      {f.address && <p className="text-xs text-muted-foreground">{f.address}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {f.contact_number ? formatMobile(f.contact_number) : '—'}
                      {f.email && <p className="text-xs">{f.email}</p>}
                    </td>
                    <td className="px-4 py-3">{f.user_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      {f.is_active !== false ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Active</span>
                      ) : (
                        <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => loadUsers(f)}>
                          <Users className="h-4 w-4" aria-hidden="true" /> Users
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAdmin(f)}>
                          <UserPlus className="h-4 w-4" aria-hidden="true" /> Add admin
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(f)} aria-label={`Edit ${f.name}`}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No facilities yet. Add the first one to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {usersFor && (
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Logins — {usersFor.name}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAdmin(usersFor)}>
                <UserPlus className="h-4 w-4" aria-hidden="true" /> Add admin
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setUsersFor(null)}>Close</Button>
            </div>
          </div>
          {usersLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logins yet for this facility.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">User name</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Last login</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="py-2 pr-4">{u.full_name || '—'}{u.email && <p className="text-xs text-muted-foreground">{u.email}</p>}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{u.username}</td>
                      <td className="py-2 pr-4">{ROLE_LABELS[u.role] || u.role}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{u.last_login_at ? formatClinicDateTime(u.last_login_at) : 'never'}</td>
                      <td className="py-2 pr-4">{u.is_active ? 'Active' : 'Disabled'}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => toggleUser(u)}>
                          {u.is_active ? <><Ban className="h-4 w-4" aria-hidden="true" /> Disable</> : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Enable</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Doctors and employees get their logins from SetUp inside the facility (switch facility in the sidebar).
          </p>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editId ? 'Edit facility' : 'Add facility'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FACILITY_FIELDS.map((f) => (
              <div key={f.key} className={`space-y-1.5 ${f.span === 2 ? 'sm:col-span-2' : ''}`}>
                <Label htmlFor={`fac-${f.key}`}>{f.label}</Label>
                <Input
                  id={`fac-${f.key}`}
                  type={f.type || 'text'}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 sm:col-span-2">
              <Label htmlFor="fac-active" className="text-sm font-medium">Active (staff can log in)</Label>
              <Switch id="fac-active" checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save changes' : 'Add facility'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adminFor} onOpenChange={(o) => !o && setAdminFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add administrator</DialogTitle>
            <DialogDescription>For {adminFor?.name}. Administrators manage this facility's staff, settings and records.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adm-name">Full name *</Label>
              <Input id="adm-name" value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adm-user">User name *</Label>
                <Input id="adm-user" autoCapitalize="none" spellCheck={false} value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-email">Email</Label>
                <Input id="adm-email" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-pw">Password *</Label>
              <Input id="adm-pw" type="password" autoComplete="new-password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-pw2">Confirm password *</Label>
              <Input id="adm-pw2" type="password" autoComplete="new-password" value={adminForm.confirm} onChange={(e) => setAdminForm({ ...adminForm, confirm: e.target.value })} />
            </div>
            <PasswordChecklist password={adminForm.password} confirm={adminForm.confirm} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAdminFor(null)}>Cancel</Button>
            <Button onClick={createAdmin} disabled={creatingAdmin || !adminValid}>{creatingAdmin ? 'Creating…' : 'Create administrator'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
