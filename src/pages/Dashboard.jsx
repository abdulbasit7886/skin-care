import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, CalendarDays, Stethoscope, ClipboardList, ArrowRight, Activity, CheckCircle2, CalendarClock } from 'lucide-react';
import { todayISO, addDaysISO } from '@/lib/clinicDate';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { normalizeRole, canAccessUser } from '@/lib/roles';

// Clinic-wide figures for admins / accounts.
async function loadClinicStats() {
  const today = todayISO();
  const [patients, doctors, todayAppts, checkedIn] = await Promise.all([
    api.entities.Patient.count(),
    api.entities.Doctor.count(),
    api.entities.Appointment.count({ date: today, status: { $ne: 'cancelled' } }),
    api.entities.Appointment.count({ date: today, status: 'checked_in' }),
  ]);
  return [
    { label: 'Registered Patients', value: patients, icon: Users, to: '/patients', tint: 'bg-[hsl(172_42%_20%)]' },
    { label: 'Doctors', value: doctors, icon: Stethoscope, to: '/patients', tint: 'bg-[hsl(340_55%_52%)]' },
    { label: "Today's Appointments", value: todayAppts, icon: CalendarDays, to: '/appointments', tint: 'bg-[hsl(38_70%_52%)]' },
    { label: 'Checked In', value: checkedIn, icon: Activity, to: '/appointments', tint: 'bg-[hsl(200_60%_45%)]' },
  ];
}

// A doctor's own day: only their bookings and follow-ups.
async function loadDoctorStats(doctorId) {
  const today = todayISO();
  const mine = { doctor_id: doctorId, date: today };
  const [booked, waiting, seen, followups] = await Promise.all([
    api.entities.Appointment.count({ ...mine, status: { $nin: ['cancelled'] } }),
    api.entities.Appointment.count({ ...mine, status: 'checked_in' }),
    api.entities.Appointment.count({ ...mine, status: 'completed' }),
    api.entities.EMR.count({ doctor_id: doctorId, followup_date: { $gte: today, $lte: addDaysISO(today, 7) } }),
  ]);
  return [
    { label: 'My Appointments Today', value: booked, icon: CalendarDays, to: '/appointments', tint: 'bg-[hsl(172_42%_20%)]' },
    { label: 'Waiting (Checked In)', value: waiting, icon: Activity, to: '/appointments', tint: 'bg-[hsl(200_60%_45%)]' },
    { label: 'Seen Today', value: seen, icon: CheckCircle2, to: '/appointments', tint: 'bg-[hsl(340_55%_52%)]' },
    { label: 'Follow-ups Due (7 days)', value: followups, icon: CalendarClock, to: '/appointments', tint: 'bg-[hsl(38_70%_52%)]' },
  ];
}

export default function Dashboard() {
  const { user } = useAuth();
  const isDoctor = normalizeRole(user?.effectiveRole || user?.role) === 'doctor' && !!user?.doctor_id;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setCards(isDoctor ? await loadDoctorStats(user.doctor_id) : await loadClinicStats());
      } catch (e) {
        // ignore — cards show a dash
      } finally {
        setLoading(false);
      }
    })();
  }, [isDoctor, user?.doctor_id]);

  const actions = (isDoctor
    ? [
      { title: "Today's Worklist", desc: 'See your patients for today and open their EMR', to: '/appointments', icon: ClipboardList },
      { title: 'Register a Patient', desc: 'Add a new patient and generate an MRN number', to: '/patients', icon: Users },
      { title: 'Book an Appointment', desc: 'Schedule a visit on the calendar', to: '/scheduling', icon: CalendarDays },
    ]
    : [
      { title: 'Register a Patient', desc: 'Add a new patient and generate an MRN number', to: '/patients', icon: Users },
      { title: 'Book an Appointment', desc: 'Schedule on the calendar across all doctors', to: '/scheduling', icon: CalendarDays },
      { title: "Today's List", desc: 'See arrivals and today\'s visits', to: '/appointments', icon: ClipboardList },
    ]).filter((a) => canAccessUser(user, a.to));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <header className="mb-9">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/70">Dermatology · Aesthetic · Laser</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {isDoctor ? `Welcome, ${user?.full_name || 'Doctor'}` : 'Welcome back'}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {isDoctor
            ? 'Your clinic day at a glance — only your own patients are counted here.'
            : 'Manage patients, schedule appointments, and record consultations — all in one place.'}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(cards.length ? cards : Array.from({ length: 4 }, (_, i) => ({ label: '', value: '', icon: Activity, to: '/appointments', tint: 'bg-muted', key: i }))).map((c) => (
          <Link
            key={c.label || c.key}
            to={canAccessUser(user, c.to) ? c.to : '#'}
            className="group rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`mb-4 grid h-11 w-11 place-items-center rounded-xl text-white ${c.tint}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="font-display text-3xl font-semibold">{loading ? '—' : c.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </section>

      {actions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-xl font-semibold">Quick actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {actions.map((a) => (
              <Link
                key={a.title}
                to={a.to}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
