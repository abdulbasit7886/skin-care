import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, UserCog } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ROLE_LABELS, ROUTE_PAGES, normalizeRole } from '@/lib/roles';
import { formatCNIC, formatMobile } from '@/lib/formatId';
import UserPermissionsPanel from '@/components/setup/UserPermissionsPanel';
import UserLoginPanel from '@/components/setup/UserLoginPanel';

const empty = { first_name: '', last_name: '', designation: '', role: 'reception', custom_role_id: null, sex: '', father_husband: '', cnic: '', mobile: '', email: '', address: '', permissions: [], landing_page: '/' };

export default function EmployeesTab({ user, canEditCharges = true }) {
  const { toast } = useToast();
  const viewerIsSuper = normalizeRole(user?.effectiveRole || user?.role) === 'super_admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customRoles, setCustomRoles] = useState([]);

  useEffect(() => {
    api.admin.roles.list().then((r) => setCustomRoles(r.items || [])).catch(() => setCustomRoles([]));
  }, []);
  const customRoleOf = (id) => customRoles.find((r) => r.id === id);
  const roleDisplay = (r) => (r.custom_role_id && customRoleOf(r.custom_role_id)?.name) || ROLE_LABELS[r.role] || '—';
  const selectedCustom = form.custom_role_id ? customRoleOf(form.custom_role_id) : null;
  const pickRole = (v) => {
    if (v.startsWith('custom:')) {
      const cr = customRoleOf(v.slice(7));
      if (cr) setForm((f) => ({ ...f, custom_role_id: cr.id, role: cr.base_role }));
    } else {
      setForm((f) => ({ ...f, custom_role_id: null, role: v }));
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await api.entities.Employee.filter({}, { sort: 'first_name', limit: 200 });
      setRows(items);
    } catch (e) {
      toast({ title: 'Could not load employees', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (r) => { setForm({ ...empty, ...r, custom_role_id: r.custom_role_id || null }); setEditId(r.id); setOpen(true); };

  const save = async () => {
    if (!form.first_name || !form.last_name || !form.mobile) {
      toast({ title: 'First name, last name and mobile required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.entities.Employee.update(editId, form);
        setOpen(false);
        load();
        toast({ title: 'Employee updated' });
      } else {
        const created = await api.entities.Employee.create(form);
        setEditId(created.id);
        toast({ title: 'Employee saved', description: 'Role and page access were saved with the record.' });
      }
    } catch (e) {
      toast({ title: 'Could not save employee', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!confirm(`Delete ${r.first_name} ${r.last_name}?`)) return;
    try {
      await api.entities.Employee.delete(r.id);
      load();
      toast({ title: 'Employee deleted' });
    } catch (e) {
      toast({ title: 'Could not delete', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Employees</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add Employee</Button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">CNIC</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{r.first_name} {r.last_name}</td>
                  <td className="px-4 py-3"><span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">{roleDisplay(r)}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.designation || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.cnic ? formatCNIC(r.cnic) : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.mobile ? formatMobile(r.mobile) : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(r)} className="rounded-md p-1.5 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r)} className="rounded-md p-1.5 text-destructive hover:bg-accent"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No employees yet.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          </div>
          )}

          <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
          <DialogTitle className="font-display text-xl">{editId ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="space-y-1.5 sm:col-span-2"><Label>Appointment Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Clinic role</Label>
              <Select
                value={form.custom_role_id ? `custom:${form.custom_role_id}` : (form.role || 'reception')}
                onValueChange={pickRole}
                disabled={form.role === 'admin' && !viewerIsSuper}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Built-in roles</SelectLabel>
                    <SelectItem value="reception">Front Desk</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                    {(viewerIsSuper || form.role === 'admin') && <SelectItem value="admin">Administrator</SelectItem>}
                    {form.role === 'doctor' && <SelectItem value="doctor">Doctor (legacy — add doctors under the Doctors tab)</SelectItem>}
                  </SelectGroup>
                  {customRoles.some((r) => r.is_active || r.id === form.custom_role_id) && (
                    <SelectGroup>
                      <SelectLabel>Custom roles</SelectLabel>
                      {customRoles.filter((r) => r.is_active || r.id === form.custom_role_id).map((r) => (
                        <SelectItem key={r.id} value={`custom:${r.id}`}>{r.name}{r.is_active ? '' : ' (inactive)'}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {!viewerIsSuper && <p className="text-xs text-muted-foreground">Only the Super Admin can create Administrators.</p>}
            </div>
            <div className="space-y-1.5"><Label>CNIC</Label><Input value={formatCNIC(form.cnic)} onChange={(e) => setForm({ ...form, cnic: formatCNIC(e.target.value) })} placeholder="XXXXX-XXXXXXX-X" inputMode="numeric" /></div>
            <div className="space-y-1.5"><Label>Mobile *</Label><Input value={formatMobile(form.mobile)} onChange={(e) => setForm({ ...form, mobile: formatMobile(e.target.value) })} placeholder="03XX-XXXXXXX" inputMode="numeric" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>

          {selectedCustom ? (
            <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">Pages from the “{selectedCustom.name}” role</h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(selectedCustom.permissions || []).map((k) => (
                  <span key={k} className="rounded-full border border-border bg-card px-2 py-0.5 text-xs">{ROUTE_PAGES.find((p) => p.key === k)?.label || k}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Page access for custom roles is managed by the Super Admin under Roles.</p>
            </div>
          ) : (
          <UserPermissionsPanel
            recordId={editId}
            entity="Employee"
            role={form.role}
            initialPermissions={form.permissions}
            initialLanding={form.landing_page}
            canEdit={canEditCharges}
            onChange={editId ? undefined : (permissions, landing_page) => setForm((f) => ({ ...f, permissions, landing_page }))}
          />
          )}

          <UserLoginPanel
            kind="employee"
            recordId={editId}
            email={form.email}
            fullName={`${form.first_name} ${form.last_name}`.trim()}
            role={form.role || 'reception'}
            roleName={selectedCustom?.name}
            canEdit={canEditCharges}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>{editId ? 'Close' : 'Cancel'}</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Save Changes' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}