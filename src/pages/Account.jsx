import React, { useState } from 'react';
import { UserCircle, KeyRound } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_LABELS, normalizeRole } from '@/lib/roles';
import PasswordChecklist, { isPasswordValid } from '@/components/PasswordChecklist';

// Every signed-in user: see their profile and change their own password.
export default function Account() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const role = normalizeRole(user?.effectiveRole || user?.role);
  const valid = !!form.current && isPasswordValid(form.next, form.confirm);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await api.auth.changePassword(form.current, form.next);
      setForm({ current: '', next: '', confirm: '' });
      toast({ title: 'Password changed', description: 'Use your new password next time you log in.' });
    } catch (err) {
      toast({ title: 'Could not change password', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    ['Name', user?.full_name],
    ['User name', user?.username],
    ['Email', user?.email],
    ['Role', ROLE_LABELS[role]],
    ['Facility', user?.facility_name],
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      <h1 className="mb-8 flex items-center gap-2 font-display text-3xl font-semibold">
        <UserCircle className="h-7 w-7 text-primary" aria-hidden="true" /> My account
      </h1>

      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Change password
        </h2>
        <div className="grid max-w-md grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </div>
          <PasswordChecklist password={form.next} confirm={form.confirm} />
          <div>
            <Button type="submit" disabled={saving || !valid}>{saving ? 'Saving…' : 'Change password'}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
