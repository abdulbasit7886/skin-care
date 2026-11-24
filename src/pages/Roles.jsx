import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, Loader2, Users, ShieldAlert } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { CUSTOM_ROLE_BASES, CUSTOM_ROLE_PAGES, ROUTE_PAGES } from '@/lib/roles';

const PAGE_GROUPS = [
  { title: 'Reception module', keys: ['/patients', '/scheduling', '/import-chart', '/archived-records', '/appointments', '/reception'] },
  { title: 'Overview', keys: ['/', '/reports'] },
];
const pageLabel = (key) => ROUTE_PAGES.find((p) => p.key === key)?.label || key;
const baseLabel = (v) => CUSTOM_ROLE_BASES.find((b) => b.value === v)?.label || v;

const EMPTY = { name: '', description: '', base_role: 'reception', permissions: ['/appointments'], landing_page: '/appointments', is_active: true };

// Super Admin: define custom roles (e.g. Nurse, Lab Technician) that admins can give to employees.
export default function Roles() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.roles.list();
      setItems(res.items || []);
    } catch (e) {
      toast({ title: 'Could not load roles', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r) => {
    setEditId(r.id);
    setForm({
      name: r.name, description: r.description || '', base_role: r.base_role,
      permissions: r.permissions || [], landing_page: r.landing_page || r.permissions?.[0] || '', is_active: r.is_active,
    });
    setOpen(true);
  };

  const togglePage = (key, on) => {
    setForm((f) => {
      const permissions = on ? [...new Set([...f.permissions, key])] : f.permissions.filter((k) => k !== key);
      const landing_page = permissions.includes(f.landing_page) ? f.landing_page : permissions[0] || '';
      return { ...f, permissions, landing_page };
    });
  };

  const orderedPages = useMemo(() => CUSTOM_ROLE_PAGES.filter((k) => form.permissions.includes(k)), [form.permissions]);
  const valid = form.name.trim().length >= 2 && form.permissions.length > 0;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), permissions: orderedPages };
      if (editId) await api.admin.roles.update(editId, payload);
      else await api.admin.roles.create(payload);
      toast({ title: editId ? 'Role updated' : 'Role created', description: editId ? 'Everyone with this role gets the change at their next page load.' : `"${payload.name}" can now be given to employees under SetUp → Employees.` });
      setOpen(false);
      load();
    } catch (e) {
      toast({ title: 'Could not save role', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const r = toDelete;
    setToDelete(null);
    try {
      await api.admin.roles.remove(r.id);
      toast({ title: 'Role deleted' });
      load();
    } catch (e) {
      toast({ title: 'Could not delete role', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold sm:text-3xl">
            <UserCog className="h-7 w-7 text-primary" aria-hidden="true" /> Roles
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Create roles such as Nurse or Lab Technician, choose the pages they can open, then assign them to employees in any facility (SetUp → Employees).
          </p>
        </div>
        <Button onClick={openNew} className="w-full gap-2 sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden="true" /> New role
        </Button>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Built-in roles</p>
        <p className="mt-1">Super Admin, Administrator, Doctor, Front Desk and Accounts are always available. Custom roles can never open the EMR or administration pages — patient records stay with the attending doctor.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <UserCog className="mx-auto h-10 w-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="mt-3 font-medium">No custom roles yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create one to give staff like nurses or lab technicians exactly the pages they need.</p>
          <Button onClick={openNew} className="mt-5 gap-2"><Plus className="h-4 w-4" aria-hidden="true" /> Create the first role</Button>
        </div>
      ) : (
        <>
          {/* phones: cards */}
          <div className="space-y-3 md:hidden">
            {items.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{baseLabel(r.base_role)}</p>
                  </div>
                  <StatusBadge active={r.is_active} />
                </div>
                {r.description && <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>}
                <PageChips pages={r.permissions} landing={r.landing_page} className="mt-3" />
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> {r.employee_count} employee{r.employee_count === 1 ? '' : 's'}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => setToDelete(r)} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* tablets / desktops: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access level</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3 text-center">Employees</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      {r.description && <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{r.description}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{baseLabel(r.base_role)}</td>
                    <td className="px-4 py-3"><PageChips pages={r.permissions} landing={r.landing_page} /></td>
                    <td className="px-4 py-3 text-center">{r.employee_count}</td>
                    <td className="px-4 py-3"><StatusBadge active={r.is_active} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(r)} className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editId ? 'Edit role' : 'New role'}</DialogTitle>
            <DialogDescription>Staff with this role see only the pages you tick below.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="role-name">Role name *</Label>
                <Input id="role-name" placeholder="e.g. Nurse" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <label className="flex h-10 items-center justify-between rounded-md border border-input px-3 text-sm">
                  <span>{form.is_active ? 'Active' : 'Inactive'}</span>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea id="role-desc" rows={2} placeholder="What this role does (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Access level *</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CUSTOM_ROLE_BASES.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setForm({ ...form, base_role: b.value })}
                    aria-pressed={form.base_role === b.value}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      form.base_role === b.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40'
                    )}
                  >
                    <p className="text-sm font-medium">{b.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.hint}</p>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Pages *</legend>
              {PAGE_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.keys.map((key) => (
                      <label key={key} className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors', form.permissions.includes(key) ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50')}>
                        <Checkbox checked={form.permissions.includes(key)} onCheckedChange={(v) => togglePage(key, !!v)} />
                        {pageLabel(key)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {form.permissions.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> Choose at least one page.</p>
              )}
            </fieldset>

            <div className="space-y-1.5">
              <Label>Opens on after login</Label>
              <Select value={form.landing_page || undefined} onValueChange={(v) => setForm({ ...form, landing_page: v })} disabled={!orderedPages.length}>
                <SelectTrigger><SelectValue placeholder="Choose a page" /></SelectTrigger>
                <SelectContent>
                  {orderedPages.map((k) => <SelectItem key={k} value={k}>{pageLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !valid} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editId ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.employee_count
                ? `${toDelete.employee_count} employee(s) still have this role. Give them another role first, or edit the role and mark it inactive.`
                : 'The role is removed from the list. This is recorded in the audit log.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={!!toDelete?.employee_count} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete role</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium', active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground')}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function PageChips({ pages = [], landing, className }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {CUSTOM_ROLE_PAGES.filter((k) => pages.includes(k)).map((k) => (
        <span key={k} className={cn('rounded-full border px-2 py-0.5 text-xs', k === landing ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-foreground/80')} title={k === landing ? 'Opens here after login' : undefined}>
          {pageLabel(k)}{k === landing ? ' ★' : ''}
        </span>
      ))}
    </div>
  );
}
