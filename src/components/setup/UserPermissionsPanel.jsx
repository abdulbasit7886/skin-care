import React, { useEffect, useState } from 'react';
import { Shield, Save, Lock } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_LABELS, normalizeRole, pagesForRole, hasFullAccess } from '@/lib/roles';

// Per-user page-permission editor shown inside the Add/Edit dialog.
// Disabled until the record has been saved (recordId present), so the flow is:
// fill details → Save → panel enables → tick pages → Save Permissions.
export default function UserPermissionsPanel({ recordId, entity, role, initialPermissions, initialLanding, canEdit, onChange }) {
  const { toast } = useToast();
  const [perms, setPerms] = useState([]);
  const [landing, setLanding] = useState('/');
  const [saving, setSaving] = useState(false);

  // While a new record is being added the parent owns the data, so edits are
  // reported through `onChange` and saved together with the record.
  const createMode = typeof onChange === 'function';

  useEffect(() => {
    setPerms(Array.isArray(initialPermissions) ? initialPermissions : []);
    setLanding(initialLanding || '/');
  }, [recordId, initialPermissions, initialLanding]);

  const enabled = canEdit && (createMode || !!recordId);

  const apply = (nextPerms, nextLanding) => {
    setPerms(nextPerms);
    setLanding(nextLanding);
    onChange?.(nextPerms, nextLanding);
  };
  const toggle = (key) => {
    const nextPerms = perms.includes(key) ? perms.filter((k) => k !== key) : [...perms, key];
    apply(nextPerms, nextPerms.includes(landing) ? landing : (nextPerms[0] || '/'));
  };

  const roleKey = normalizeRole(role);
  const pages = pagesForRole(roleKey);
  const allowedPages = pages.filter((p) => perms.includes(p.key));
  const landingValue = allowedPages.some((p) => p.key === landing) ? landing : (allowedPages[0]?.key || '/');

  const save = async () => {
    if (!recordId) return;
    let lp = landing;
    if (!perms.includes(lp)) lp = perms[0] || '/';
    setSaving(true);
    try {
      await api.entities[entity].update(recordId, { permissions: perms, landing_page: lp });
      setLanding(lp);
      toast({ title: 'Permissions saved', description: 'Changes take effect on next sign-in.' });
    } catch (e) {
      toast({ title: 'Could not save permissions', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className={`mt-2 rounded-xl border border-border bg-muted/30 p-4 ${!enabled ? 'opacity-70' : ''}`}>
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Roles & Permission</h4>
        {!canEdit && (
          <span className="ml-auto text-xs text-muted-foreground">Only admins may edit</span>
        )}
        {canEdit && !enabled && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> Save the record first to enable
          </span>
        )}
        {createMode && (
          <span className="ml-auto text-xs text-muted-foreground">Saved with the new record</span>
        )}
      </div>

      {!enabled ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pages.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm text-muted-foreground">
              <Checkbox disabled />
              {p.label}
            </label>
          ))}
        </div>
      ) : hasFullAccess(roleKey) ? (
        <p className="text-sm text-muted-foreground">{ROLE_LABELS[roleKey]} has access to every page. Patient EMRs are only ever open to the treating doctor.</p>
      ) : (
        <>
          {roleKey === 'reception' && (
            <p className="mb-2 text-xs text-muted-foreground">
              Front Desk staff can be given any of the Reception module pages. When Daily List is granted it is always their landing page.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pages.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm hover:bg-accent/40">
                <Checkbox checked={perms.includes(p.key)} onCheckedChange={() => toggle(p.key)} />
                {p.label}
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Landing page</span>
            <Select value={landingValue} onValueChange={(v) => apply(perms, v)} disabled={allowedPages.length === 0}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {allowedPages.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!createMode && (
              <Button size="sm" className="ml-auto" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Permissions'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}