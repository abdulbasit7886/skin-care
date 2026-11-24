// Clinic role-based access control (UI side; the server enforces the same rules).
// Roles: super_admin, admin, doctor, reception (Front Desk), accounts.
import { useEffect, useState } from 'react';
import { api } from '@/api/client';

export const CLINIC_ROLES = ['super_admin', 'admin', 'doctor', 'reception', 'accounts'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  doctor: 'Doctor',
  reception: 'Front Desk',
  accounts: 'Accounts',
};

// Every page / subpage in the app, with a human label for the permissions grid.
export const ROUTE_PAGES = [
  { key: '/', label: 'Dashboard' },
  { key: '/patients', label: 'Registration' },
  { key: '/scheduling', label: 'Scheduling' },
  { key: '/appointments', label: 'Daily List' },
  { key: '/reception', label: 'Front Desk' },
  { key: '/emr', label: 'EMR' },
  { key: '/reports', label: 'Reports' },
  { key: '/setup', label: 'SetUp' },
  { key: '/import-chart', label: 'Scan Chart' },
  { key: '/archived-records', label: 'Archived Records' },
  { key: '/user-permissions', label: 'User Permissions' },
  { key: '/messages', label: 'Website Messages' },
];

// The Front Desk "RECEPTION MODULE": the submodules an admin can grant to a front desk employee.
export const RECEPTION_MODULE = ['/patients', '/scheduling', '/import-chart', '/archived-records', '/appointments', '/reception'];

// Pages a custom role (created by the super admin) may open — never the EMR or admin pages.
export const CUSTOM_ROLE_PAGES = ['/patients', '/scheduling', '/import-chart', '/archived-records', '/appointments', '/reception', '/', '/reports'];
// Access levels a custom role can run on (the server enforces these for data).
export const CUSTOM_ROLE_BASES = [
  { value: 'reception', label: 'Front Desk access', hint: 'Register patients, book visits, scan charts, collect payments' },
  { value: 'accounts', label: 'Accounts access', hint: 'Billing, payments and reports only' },
];

// What a doctor can be given: the EMR plus register, schedule, archived records, daily list, reports, dashboard.
export const DOCTOR_PAGES = ['/appointments', '/emr', '/patients', '/scheduling', '/archived-records', '/', '/reports'];

// Pages an admin may grant to a person with the given role.
// Front desk staff can only be given submodules of the reception module; the EMR
// can only ever be given to doctors. Admins and super admins see every page anyway.
export const pagesForRole = (role) => {
  const r = CLINIC_ROLES.includes(role) ? role : 'reception';
  if (r === 'reception') return ROUTE_PAGES.filter((p) => RECEPTION_MODULE.includes(p.key));
  if (r === 'doctor') return ROUTE_PAGES.filter((p) => DOCTOR_PAGES.includes(p.key));
  return ROUTE_PAGES.filter((p) => p.key !== '/emr');
};

// Admin roles have every page (except the EMR) without per-page grants.
export const hasFullAccess = (role) => role === 'super_admin' || role === 'admin';

// Pages that never depend on per-user grants.
const ALWAYS_ALLOWED = ['/account'];
// Pages only for the system owner.
const SUPER_ADMIN_ONLY = ['/facilities', '/audit-log', '/roles'];

// route key -> roles allowed (built-in defaults; overridden by Facility.role_permissions)
export const ROUTE_PERMISSIONS = {
  '/': ['super_admin', 'admin', 'doctor', 'accounts'],
  '/patients': ['super_admin', 'admin', 'doctor', 'reception'],
  '/scheduling': ['super_admin', 'admin', 'doctor', 'reception'],
  '/appointments': ['super_admin', 'admin', 'doctor', 'reception'],
  '/emr': ['doctor'],
  '/reception': ['super_admin', 'admin', 'reception', 'accounts'],
  '/setup': ['super_admin', 'admin'],
  '/reports': ['super_admin', 'admin', 'doctor', 'accounts'],
  '/import-chart': ['super_admin', 'admin', 'reception'],
  '/archived-records': ['super_admin', 'admin', 'doctor', 'reception'],
  '/user-permissions': ['super_admin', 'admin'],
  '/facilities': ['super_admin'],
  '/audit-log': ['super_admin'],
  '/roles': ['super_admin'],
  '/messages': ['super_admin', 'admin'],
  '/account': ['super_admin', 'admin', 'doctor', 'reception', 'accounts'],
};

// first page a role sees after login / on unauthorized access (defaults)
export const ROLE_LANDING = {
  super_admin: '/',
  admin: '/',
  doctor: '/appointments',
  reception: '/appointments',
  accounts: '/reception',
};

// Roles that can edit clinical charges (fees, prices, tax) in Setup
export const CHARGE_EDITOR_ROLES = ['super_admin', 'admin'];

// --- runtime overrides (loaded once from the Facility record) ---
let _permissions = ROUTE_PERMISSIONS;
let _landing = ROLE_LANDING;
let _loaded = false;

export const setRolePermissions = ({ permissions, landing } = {}) => {
  if (permissions && typeof permissions === 'object') {
    // Facility overrides never unlock the EMR for non-doctors, nor owner-only pages.
    _permissions = { ...ROUTE_PERMISSIONS, ...permissions, '/emr': ['doctor'] };
    SUPER_ADMIN_ONLY.forEach((k) => { _permissions[k] = ['super_admin']; });
    ALWAYS_ALLOWED.forEach((k) => { _permissions[k] = ROUTE_PERMISSIONS[k]; });
  }
  if (landing && typeof landing === 'object') _landing = { ...ROLE_LANDING, ...landing };
};

export const getRolePermissions = () => _permissions;
export const getRoleLanding = () => _landing;

// Loads role permission / landing overrides from the Facility record once,
// then re-renders the calling component. Returns true once loaded.
export const useRolePermissions = () => {
  const [loaded, setLoaded] = useState(_loaded);
  useEffect(() => {
    if (_loaded) return;
    let active = true;
    (async () => {
      try {
        const { items } = await api.entities.Facility.list({ limit: 1, fields: ['role_permissions', 'role_landing'] });
        const f = items[0];
        if (f) setRolePermissions({ permissions: f.role_permissions, landing: f.role_landing });
      } catch (e) {
        // ignore — fall back to defaults
      }
      if (active) { _loaded = true; setLoaded(true); }
    })();
    return () => { active = false; };
  }, []);
  return loaded;
};

export const normalizeRole = (role) => (CLINIC_ROLES.includes(role) ? role : 'reception');

const roleOf = (user) => normalizeRole(user?.effectiveRole || user?.role);

// The most a role can ever reach, whatever a facility setting or per-user grant says.
const ROLE_CEILING = { doctor: DOCTOR_PAGES, reception: RECEPTION_MODULE };
// People with a custom role are bounded by the custom-role pages instead of their base role's ceiling.
let _customRoleUser = false;
const withinCeiling = (role, routeKey) => {
  if (_customRoleUser) return CUSTOM_ROLE_PAGES.includes(routeKey);
  return !ROLE_CEILING[role] || ROLE_CEILING[role].includes(routeKey);
};
const ceilingFor = (user) => { _customRoleUser = !!user?.custom_role_id; };

// Display name of a person's role: their custom role's name, else the built-in label.
export const roleLabel = (user) => user?.role_name || ROLE_LABELS[normalizeRole(user?.effectiveRole || user?.role)] || '';

export const canAccess = (role, routeKey) => {
  if (routeKey === '/emr') return role === 'doctor';
  if (ALWAYS_ALLOWED.includes(routeKey)) return true;
  if (SUPER_ADMIN_ONLY.includes(routeKey)) return role === 'super_admin';
  // Super admin and admin have every page (except the EMR); they can never be locked out.
  if (hasFullAccess(role)) return true;
  if (!withinCeiling(role, routeKey)) return false;
  const allowed = _permissions[routeKey];
  return !allowed || allowed.includes(role);
};

export const canEditCharges = (role) => CHARGE_EDITOR_ROLES.includes(role);

// Admins (super_admin / admin) can amend a printed invoice and reprint it as corrected.
export const isAdminRole = (role) => role === 'super_admin' || role === 'admin';

// EMR (clinical charting) is reserved for doctors. No other role — not even
// super admin or admin — may open it, even if a per-user page grant lists '/emr'.
export const EMR_ROLES = ['doctor'];
export const canUseEMR = (user) => EMR_ROLES.includes(roleOf(user));

export const matchRouteKey = (pathname) => {
  if (pathname === '/') return '/';
  return '/' + pathname.split('/')[1];
};

export const landingForRole = (role) => {
  const l = _landing[role] || ROLE_LANDING[role] || '/';
  return canAccess(role, l) ? l : '/account';
};

// --- per-user permissions (override role defaults when present) ---
// `user.permissions` is an array of route keys granted to this individual.
export const landingForUser = (user) => {
  const role = roleOf(user);
  ceilingFor(user);
  if (hasFullAccess(role)) return landingForRole(role);
  const perms = user?.permissions;
  if (Array.isArray(perms)) {
    const allowed = (key) => perms.includes(key) && withinCeiling(role, key) && (key !== '/emr' || role === 'doctor');
    // Front desk: the Daily List is the landing page whenever it is granted;
    // otherwise the first granted submodule of the reception module.
    if (role === 'reception') {
      if (allowed('/appointments')) return '/appointments';
      const sub = RECEPTION_MODULE.find(allowed);
      if (sub) return sub;
    }
    if (user?.landingPage && allowed(user.landingPage)) return user.landingPage;
    const first = ROUTE_PAGES.find((p) => allowed(p.key));
    if (first) return first.key;
    return '/account';
  }
  return landingForRole(role);
};

export const canAccessUser = (user, routeKey) => {
  const role = roleOf(user);
  ceilingFor(user);
  if (routeKey === '/emr') return role === 'doctor';
  if (ALWAYS_ALLOWED.includes(routeKey)) return true;
  if (SUPER_ADMIN_ONLY.includes(routeKey)) return role === 'super_admin';
  if (hasFullAccess(role)) return true;
  if (!withinCeiling(role, routeKey)) return false;
  const perms = user?.permissions;
  if (Array.isArray(perms)) {
    if (perms.includes(routeKey)) return true;
    return routeKey === landingForUser(user);
  }
  return canAccess(role, routeKey);
};
