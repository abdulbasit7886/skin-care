// Every 15 minutes: appointments still "booked" 30 minutes after their start time become "no_show".
import cron from 'node-cron';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { clinicDate, clinicTime, parseTimeToMinutes } from '../time.js';
import { writeAudit } from '../audit.js';

const GRACE_MINUTES = 30;

export async function markNoShows(now = new Date()) {
  const today = clinicDate(now);
  const nowMinutes = parseTimeToMinutes(clinicTime(now));
  const candidates = await prisma.appointment.findMany({
    where: { status: 'booked', date: { lte: today }, deleted_at: null },
    select: { id: true, facility_id: true, date: true, start_time: true, patient_name: true, doctor_name: true },
    take: 2000,
  });
  const overdue = candidates.filter((a) => {
    if (a.date < today) return true;
    const start = parseTimeToMinutes(a.start_time);
    return start !== null && nowMinutes - start >= GRACE_MINUTES;
  });
  for (const a of overdue) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.appointment.updateMany({ where: { id: a.id, status: 'booked' }, data: { status: 'no_show' } });
      if (r.count) {
        await writeAudit(null, {
          facility_id: a.facility_id, entity: 'Appointment', record_id: a.id, action: 'update',
          user_name: 'System (no-show job)', user_role: 'system',
          changes: { status: { from: 'booked', to: 'no_show' } },
          summary: `Marked no-show: ${a.patient_name || ''} with ${a.doctor_name || ''} on ${a.date} ${a.start_time}`,
        }, tx);
      }
    });
  }
  return { checked: candidates.length, marked_no_show: overdue.length };
}

export function scheduleNoShowJob() {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const r = await markNoShows();
      if (r.marked_no_show) console.log(`[no-show] marked ${r.marked_no_show} appointment(s)`);
    } catch (e) {
      console.error('[no-show] job failed:', e.message);
    }
  }, { timezone: config.clinicTz });
}
