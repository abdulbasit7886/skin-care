import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { ROUTE_PAGES, ROLE_LABELS, normalizeRole, hasFullAccess, pagesForRole } from '@/lib/roles';
import { useAuth } from '@/lib/AuthContext';

// Read-only overview of every doctor and employee and the pages each may access.
export default function UserPermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, eRes] = await Promise.all([
          api.entities.Doctor.filter({}, { sort: 'name', limit: 200, fields: ['name', 'permissions', 'landing_page'] }),
          api.entities.Employee.filter({}, { sort: 'first_name', limit: 200, fields: ['first_name', 'last_name', 'role', 'permissions', 'landing_page'] }),
        ]);
        const docs = dRes.items.map((d) => ({
          id: d.id, name: d.name, role: 'doctor',
          permissions: d.permissions || [], landing: d.landing_page,
        }));
        const emps = eRes.items.map((e) => ({
          id: e.id, name: `${e.first_name} ${e.last_name}`,
          role: e.role, permissions: e.permissions || [], landing: e.landing_page,
        }));
        setPeople([...docs, ...emps]);
      } catch (e) {
        toast({ title: 'Could not load users', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const viewerIsAdmin = ['super_admin', 'admin'].includes(normalizeRole(user?.effectiveRole || user?.role));

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-semibold">User Permissions</h1>
          <p className="text-sm text-muted-foreground">Who can access which page. Edit per person in Setup → Doctors / Employees.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-muted/50">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Landing</th>
                {ROUTE_PAGES.map((p) => (
                  <th key={p.key} className="px-2 py-3 text-center" title={p.label}>{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const role = normalizeRole(p.role);
                const grantable = pagesForRole(role).map((r) => r.key);
                const perms = hasFullAccess(role) ? grantable : p.permissions.filter((k) => grantable.includes(k));
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium sticky left-0 bg-card">{p.name}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{ROLE_LABELS[p.role] || p.role}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{ROUTE_PAGES.find((r) => r.key === p.landing)?.label || '—'}</td>
                    {ROUTE_PAGES.map((r) => (
                      <td key={r.key} className="px-2 py-3 text-center">
                        {perms.includes(r.key) ? (
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-border" />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {people.length === 0 && (
                <tr><td colSpan={3 + ROUTE_PAGES.length} className="px-4 py-6 text-center text-muted-foreground">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!viewerIsAdmin && <p className="mt-3 text-xs text-muted-foreground">View only — ask an administrator to change permissions.</p>}
    </div>
  );
}