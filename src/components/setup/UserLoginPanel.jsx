import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Lock, UserPlus, RotateCcw, Ban, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PasswordChecklist, { isPasswordValid } from '@/components/PasswordChecklist';
import { ROLE_LABELS } from '@/lib/roles';
import { formatClinicDateTime } from '@/lib/clinicDate';

const suggestUsername = (email, fullName) => {
  if (email && email.includes('@')) return email.trim().toLowerCase();
  return (fullName || '')
    .toLowerCase()
    .replace(/^(dr|prof|assoc|asst)\.?\s+/g, '')
    .replace(/[^a-z0-9\s.]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('.');
};

// Manages the portal login linked to a Doctor (doctor_id) or Employee (employee_id).
// Only admins can create logins, reset passwords or disable an account.
export default function UserLoginPanel({ kind, recordId, email, fullName, role, roleName, canEdit }) {
  const { toast } = useToast();
  const [login, setLogin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPw, setResetPw] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const linkKey = kind === 'doctor' ? 'doctor_id' : 'employee_id';

  const load = useCallback(async () => {
    if (!recordId || !canEdit) { setLogin(null); return; }
    setLoading(true);
    try {
      const { items } = await api.admin.users.list({ [linkKey]: recordId });
      setLogin(items?.[0] || null);
    } catch (e) {
      setLogin(null);
    } finally {
      setLoading(false);
    }
  }, [recordId, canEdit, linkKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      email: f.email || email || '',
      username: f.username || suggestUsername(email, fullName),
    }));
  }, [email, fullName]);

  const ready = !!recordId && canEdit;
  const passwordOk = isPasswordValid(form.password);

  const create = async () => {
    if (!form.username.trim()) {
      toast({ title: 'Enter a user name', variant: 'destructive' });
      return;
    }
    if (!passwordOk) {
      toast({ title: 'Password does not meet the rules', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const created = await api.admin.users.create({
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        full_name: fullName || form.username.trim(),
        role,
        password: form.password,
        [linkKey]: recordId,
      });
      setLogin(created);
      setForm((f) => ({ ...f, password: '' }));
      toast({ title: 'Login created', description: `${created.username} can now log in to the portal.` });
    } catch (e) {
      toast({ title: 'Could not create login', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async () => {
    if (!login) return;
    setBusy(true);
    try {
      const updated = await api.admin.users.update(login.id, { is_active: !login.is_active });
      setLogin(updated);
      toast({ title: updated.is_active ? 'Login enabled' : 'Login disabled' });
    } catch (e) {
      toast({ title: 'Could not update login', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!isPasswordValid(resetPw.password, resetPw.confirm)) return;
    setBusy(true);
    try {
      await api.admin.users.resetPassword(login.id, resetPw.password);
      setResetOpen(false);
      setResetPw({ password: '', confirm: '' });
      toast({ title: 'Password reset', description: `Share the new password with ${login.full_name || login.username} securely.` });
    } catch (e) {
      toast({ title: 'Could not reset password', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
        <h4 className="text-sm font-semibold">Portal Login</h4>
        {!canEdit && <span className="ml-auto text-xs text-muted-foreground">Only admins may manage logins</span>}
        {canEdit && !recordId && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden="true" /> Save the record first to enable
          </span>
        )}
      </div>

      {!ready ? (
        <p className="text-xs text-muted-foreground">
          Once saved, an administrator can create a user name and password for this person.
        </p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking login…</p>
      ) : login ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-border bg-card px-2.5 py-1 font-medium">{login.username}</span>
            {login.email && <span className="text-muted-foreground">{login.email}</span>}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{ROLE_LABELS[login.role] || login.role}</span>
            {login.is_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
                <Ban className="h-3 w-3" aria-hidden="true" /> Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Last login: {login.last_login_at ? formatClinicDateTime(login.last_login_at) : 'never'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setResetOpen(true)} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset password
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={toggleActive} disabled={busy}>
              {login.is_active ? <><Ban className="h-4 w-4" aria-hidden="true" /> Disable login</> : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Enable login</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`login-user-${kind}`}>User name</Label>
              <Input
                id={`login-user-${kind}`}
                value={form.username}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`login-email-${kind}`}>Email (for password resets)</Label>
              <Input
                id={`login-email-${kind}`}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`login-pw-${kind}`}>Initial password</Label>
              <Input
                id={`login-pw-${kind}`}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <PasswordChecklist password={form.password} className="pt-1" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Role: {roleName || ROLE_LABELS[role] || role}</p>
            <Button size="sm" onClick={create} disabled={creating || !passwordOk || !form.username.trim()} className="gap-1.5">
              <UserPlus className="h-4 w-4" aria-hidden="true" /> {creating ? 'Creating…' : 'Create login'}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) setResetPw({ password: '', confirm: '' }); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Reset password</DialogTitle>
            <DialogDescription>Set a new password for {login?.full_name || login?.username}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw">New password</Label>
              <Input id="reset-pw" type="password" autoComplete="new-password" value={resetPw.password} onChange={(e) => setResetPw({ ...resetPw, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pw2">Confirm new password</Label>
              <Input id="reset-pw2" type="password" autoComplete="new-password" value={resetPw.confirm} onChange={(e) => setResetPw({ ...resetPw, confirm: e.target.value })} />
            </div>
            <PasswordChecklist password={resetPw.password} confirm={resetPw.confirm} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={doReset} disabled={busy || !isPasswordValid(resetPw.password, resetPw.confirm)}>
              {busy ? 'Saving…' : 'Reset password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
