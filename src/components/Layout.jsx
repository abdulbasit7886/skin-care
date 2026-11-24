import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, LogOut, Menu, X, Stethoscope, Settings, ConciergeBell,
  BarChart3, ScanLine, Archive, ShieldCheck, Building2, History, Inbox, UserCircle, ChevronsUpDown, UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole, canAccessUser, roleLabel, useRolePermissions } from '@/lib/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Sidebar sections per role. Within a section, each item still needs page access (canAccessUser).
const navGroups = [
  {
    title: 'Reception',
    roles: ['super_admin', 'admin', 'reception', 'accounts'],
    items: [
      { to: '/patients', label: 'Registration', icon: Users },
      { to: '/scheduling', label: 'Scheduling', icon: CalendarDays },
      { to: '/import-chart', label: 'Scan Chart', icon: ScanLine },
      { to: '/archived-records', label: 'Archived Records', icon: Archive },
      { to: '/appointments', search: 'src=frontdesk', label: 'Daily List', icon: ClipboardList },
      { to: '/reception', label: 'Front Desk', icon: ConciergeBell },
    ],
  },
  {
    // The doctor's Daily List is the clinical worklist (it opens the EMR).
    title: 'Doctor',
    roles: ['doctor'],
    items: [
      { to: '/appointments', label: 'Daily List', icon: ClipboardList },
      { to: '/patients', label: 'Registration', icon: Users },
      { to: '/scheduling', label: 'Scheduling', icon: CalendarDays },
      { to: '/archived-records', label: 'Archived Records', icon: Archive },
    ],
  },
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Administration',
    roles: ['super_admin', 'admin'],
    items: [
      { to: '/setup', label: 'SetUp', icon: Settings },
      { to: '/user-permissions', label: 'User Permissions', icon: ShieldCheck },
      { to: '/messages', label: 'Website Messages', icon: Inbox },
    ],
  },
  {
    title: 'System',
    roles: ['super_admin'],
    items: [
      { to: '/facilities', label: 'Facilities', icon: Building2 },
      { to: '/roles', label: 'Roles', icon: UserCog },
      { to: '/audit-log', label: 'Audit Log', icon: History },
    ],
  },
];

const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout, activeFacilityId, switchFacility } = useAuth();
  const navigate = useNavigate();
  useRolePermissions();
  const role = normalizeRole(user?.effectiveRole || user?.role);
  const isSuper = role === 'super_admin';
  const facilities = Array.isArray(user?.facilities) ? user.facilities : [];

  // The Doctor group's Daily List is the clinical worklist (it opens the EMR);
  // the Reception group's Daily List (?src=frontdesk) never does.
  const visibleGroups = navGroups
    .filter((group) => !group.roles || group.roles.includes(role))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessUser(user, item.to)),
    }))
    .filter((group) => group.items.length > 0);

  const displayName = user?.full_name || user?.username || user?.email || 'User';
  const facilityName = user?.facility_name || (isSuper ? 'No facility selected' : '');

  const SidebarContent = () => (
    <div className="flex h-full flex-col text-slate-700" style={{ background: 'linear-gradient(to bottom, #f0fdf9 0%, #e8faf0 55%, #ffffff 68%, #fff7ed 80%, #ffedd5 100%)' }}>
      <div className="px-6 py-6 border-b border-emerald-100/60">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-lg font-semibold text-teal-900">Health Synapsis</p>
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-teal-600/80">EMR Portal</p>
          </div>
        </div>
        {isSuper ? (
          <div className="mt-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-600/70">Facility</p>
            {facilities.length ? (
              <Select value={activeFacilityId || undefined} onValueChange={switchFacility}>
                <SelectTrigger className="h-9 bg-white/80 text-sm" aria-label="Switch facility">
                  <SelectValue placeholder="Choose a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-slate-500">No facilities yet — add one under Facilities.</p>
            )}
          </div>
        ) : facilityName ? (
          <p className="mt-3 truncate text-sm font-medium text-teal-800" title={facilityName}>{facilityName}</p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Main">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-600/70">
              {group.title}
            </p>
            <div className="ml-2.5 space-y-0.5 border-l border-emerald-200/80 pl-2">
              {group.items.map((item) => (
                <NavLink
                  key={`${group.title}-${item.to}`}
                  to={item.search ? `${item.to}?${item.search}` : item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-emerald-100/70 hover:text-teal-800'
                    }`
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-emerald-100/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-emerald-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-slate-800">{displayName}</span>
                <span className="block truncate text-[11px] uppercase tracking-[0.12em] text-teal-600/80">{roleLabel(user)}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{displayName}</p>
              {user?.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { setOpen(false); navigate('/account'); }}>
              <UserCircle className="mr-2 h-4 w-4" aria-hidden="true" /> My account
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => logout()} className="text-orange-800 focus:text-orange-900">
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block sticky top-0 h-screen">
        <SidebarContent />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-5 py-3.5 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-border" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate px-3 font-display text-base font-semibold">{facilityName || 'Health Synapsis'}</span>
          <div className="w-10" />
        </header>
        <main className="flex-1 overflow-x-hidden bg-emerald-50/40">
          <Outlet />
        </main>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-emerald-100/70" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
}
