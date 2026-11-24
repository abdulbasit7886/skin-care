import React, { Fragment, useEffect, useState } from 'react';
import { History, Loader2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_LABELS } from '@/lib/roles';
import { addDaysISO, formatClinicDateTime, todayISO } from '@/lib/clinicDate';
import { cn } from '@/lib/utils';

const ENTITIES = ['Patient', 'Appointment', 'Invoice', 'EMR', 'EMRAddendum', 'Doctor', 'Employee', 'Facility', 'Service', 'Procedure', 'LabTest', 'TaxRate', 'User'];
const ACTIONS = [
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Modified' },
  { value: 'delete', label: 'Deleted' },
  { value: 'correct_invoice', label: 'Invoice corrected' },
  { value: 'print_invoice', label: 'Invoice printed' },
  { value: 'login', label: 'Login' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'user_create', label: 'Login created' },
  { value: 'user_update', label: 'Login changed' },
];
const ACTION_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.value, a.label]));
const ACTION_STYLE = {
  delete: 'bg-rose-100 text-rose-800',
  correct_invoice: 'bg-amber-100 text-amber-800',
  update: 'bg-sky-100 text-sky-800',
  create: 'bg-emerald-100 text-emerald-800',
};
const ALL = '__all__';

const show = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Super Admin: every create / change / delete in every facility, including what an
// admin deleted or modified. Read-only — nothing here can be undone.
export default function AuditLog() {
  const { toast } = useToast();
  const { user } = useAuth();
  const facilities = Array.isArray(user?.facilities) ? user.facilities : [];

  const [filters, setFilters] = useState({
    facility_id: ALL, entity: ALL, action: ALL,
    from: addDaysISO(todayISO(), -30), to: todayISO(),
  });
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const params = (extra = {}) => ({
    facility_id: filters.facility_id === ALL ? undefined : filters.facility_id,
    entity: filters.entity === ALL ? undefined : filters.entity,
    action: filters.action === ALL ? undefined : filters.action,
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: 50,
    ...extra,
  });

  const load = async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res = await api.admin.audit.list(params(reset ? {} : { cursor }));
      setItems((prev) => (reset ? res.items || [] : [...prev, ...(res.items || [])]));
      setCursor(res.next_cursor || null);
      setHasMore(!!res.has_more);
      if (reset) setExpanded(null);
    } catch (e) {
      toast({ title: 'Could not load the audit log', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, []);

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const facilityName = (id, fallback) => fallback || facilities.find((f) => f.id === id)?.name || '—';

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <History className="h-7 w-7 text-primary" aria-hidden="true" /> Audit Log
        </h1>
        <p className="mt-1 text-muted-foreground">
          Every record created, modified or deleted in each facility, with who did it and what changed. Entries cannot be edited or undone.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(true); }}
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="space-y-1.5 lg:col-span-2">
          <Label>Facility</Label>
          <Select value={filters.facility_id} onValueChange={set('facility_id')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All facilities</SelectItem>
              {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Record type</Label>
          <Select value={filters.entity} onValueChange={set('entity')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {ENTITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select value={filters.action} onValueChange={set('action')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-6 lg:justify-end">
          <Button type="submit" className="gap-2" disabled={loading}><Search className="h-4 w-4" aria-hidden="true" /> Apply filters</Button>
        </div>
      </form>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Facility</th>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Record</th>
                  <th className="px-3 py-3">Summary</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const open = expanded === a.id;
                  const hasDetail = (a.changes && Object.keys(a.changes).length > 0) || a.snapshot;
                  return (
                    <Fragment key={a.id}>
                      <tr className={cn('border-t border-border align-top', hasDetail && 'cursor-pointer hover:bg-muted/30')} onClick={() => hasDetail && setExpanded(open ? null : a.id)}>
                        <td className="px-3 py-3 text-muted-foreground">
                          {hasDetail && (
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={open ? 'Hide details' : 'Show details'}
                              onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : a.id); }}
                            >
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">{formatClinicDateTime(a.created_date)}</td>
                        <td className="px-3 py-3">{facilityName(a.facility_id, a.facility_name)}</td>
                        <td className="px-3 py-3">
                          {a.user_name || '—'}
                          {a.user_role && <p className="text-xs text-muted-foreground">{ROLE_LABELS[a.user_role] || a.user_role}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', ACTION_STYLE[a.action] || 'bg-zinc-100 text-zinc-700')}>
                            {ACTION_LABEL[a.action] || a.action}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {a.entity}
                          {a.record_id && <p className="font-mono text-[11px] text-muted-foreground">{a.record_id}</p>}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{a.summary || '—'}</td>
                      </tr>
                      {open && (
                        <tr className="border-t border-border bg-muted/20">
                          <td />
                          <td colSpan={6} className="px-3 py-4">
                            {a.changes && Object.keys(a.changes).length > 0 && (
                              <div className="mb-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changes</p>
                                <table className="w-full text-xs">
                                  <thead className="text-left text-muted-foreground">
                                    <tr><th className="py-1 pr-4">Field</th><th className="py-1 pr-4">Before</th><th className="py-1">After</th></tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(a.changes).map(([field, c]) => (
                                      <tr key={field} className="border-t border-border/60 align-top">
                                        <td className="py-1.5 pr-4 font-mono">{field}</td>
                                        <td className="max-w-md break-words py-1.5 pr-4 text-rose-800 line-through decoration-rose-300">{show(c?.from)}</td>
                                        <td className="max-w-md break-words py-1.5 text-emerald-800">{show(c?.to)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {a.snapshot && (
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {a.action === 'delete' ? 'Deleted record' : 'Record'}
                                </p>
                                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                                  {Object.entries(a.snapshot).map(([k, v]) => (
                                    <div key={k} className="flex gap-2 border-b border-border/40 py-1">
                                      <dt className="w-40 shrink-0 font-mono text-muted-foreground">{k}</dt>
                                      <dd className="min-w-0 break-words">{show(v)}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No activity for these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => load(false)} disabled={loadingMore}>
            {loadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</> : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
