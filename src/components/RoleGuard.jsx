import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { matchRouteKey, useRolePermissions, canAccessUser, landingForUser } from '@/lib/roles';

// Sits inside the authenticated area: redirects users away from pages they may
// not access, to their landing page. Per-user grants (from the linked Doctor /
// Employee record) win over role defaults; the EMR is always doctor-only.
// The server enforces the same rules — this only keeps the UI tidy.
export default function RoleGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const loaded = useRolePermissions();
  if (!loaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }
  const key = matchRouteKey(location.pathname);
  if (key && user && !canAccessUser(user, key)) {
    const landing = landingForUser(user);
    if (landing !== key) return <Navigate to={landing} replace />;
  }
  return <Outlet />;
}
