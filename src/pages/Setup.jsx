import React, { useState } from 'react';
import { Stethoscope, Users, FlaskConical, Percent, Lock, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { canEditCharges as canEdit } from '@/lib/roles';
import DoctorsTab from '@/components/setup/DoctorsTab';
import EmployeesTab from '@/components/setup/EmployeesTab';
import CatalogTab from '@/components/setup/CatalogTab';
import TaxTab from '@/components/setup/TaxTab';
import FacilityTab from '@/components/setup/FacilityTab';

const tabs = [
  { id: 'facility', label: 'Facility', icon: Building2 },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'catalog', label: 'Investigations & Services', icon: FlaskConical },
  { id: 'tax', label: 'Tax / Cost', icon: Percent },
];

export default function Setup() {
  const [tab, setTab] = useState('facility');
  const { user } = useAuth();
  const canEditCharges = canEdit(user?.effectiveRole || user?.role);
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">SetUp</h1>
        <p className="mt-1 text-muted-foreground">Manage doctors, employees, and the investigations & services catalog.</p>
      </div>
      {!canEditCharges && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Lock className="h-3.5 w-3.5" /> Charges are read-only — only administrators can edit fees and prices.
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all',
              tab === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground/70 hover:border-primary/40'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'facility' && <FacilityTab />}
      {tab === 'doctors' && <DoctorsTab canEditCharges={canEditCharges} user={user} />}
      {tab === 'employees' && <EmployeesTab user={user} canEditCharges={canEditCharges} />}
      {tab === 'catalog' && <CatalogTab canEditCharges={canEditCharges} />}
      {tab === 'tax' && <TaxTab canEditCharges={canEditCharges} />}
    </div>
  );
}