// Unauthenticated endpoints used by the public clinic website.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { badRequest } from '../http.js';
import { sendContactNotification } from '../mail.js';

const router = Router();

async function websiteFacility() {
  if (config.websiteFacilityId) {
    const f = await prisma.facility.findFirst({ where: { id: config.websiteFacilityId, deleted_at: null, is_active: true } });
    if (f) return f;
  }
  return prisma.facility.findFirst({ where: { deleted_at: null, is_active: true }, orderBy: { created_date: 'asc' } });
}

router.get('/site', async (req, res) => {
  const f = await websiteFacility();
  if (!f) return res.json({ facility: null, doctors: [], services: [], procedures: [] });
  const scope = { facility_id: f.id, deleted_at: null };
  const [doctors, services, procedures] = await Promise.all([
    prisma.doctor.findMany({
      where: { ...scope, show_on_website: true },
      orderBy: { name: 'asc' },
      select: { id: true, title: true, name: true, specialization: true, photo_url: true, bio: true },
    }),
    prisma.service.findMany({ where: { ...scope, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.procedure.findMany({ where: { ...scope, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    facility: {
      name: f.name, address: f.address, contact_number: f.contact_number,
      email: f.email, website: f.website, logo_url: f.logo_url,
    },
    doctors,
    services,
    procedures,
  });
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'You have sent several messages already. Please try again later or call us.' } },
});

const clip = (v, n) => (v === undefined || v === null ? null : String(v).trim().slice(0, n) || null);

router.post('/contact', contactLimiter, async (req, res) => {
  const b = req.body || {};
  const name = clip(b.name, 120);
  const message = clip(b.message, 5000);
  const email = clip(b.email, 200);
  const phone = clip(b.phone, 40);
  if (!name) throw badRequest('Please enter your name.');
  if (!message) throw badRequest('Please enter a message.');
  if (!email && !phone) throw badRequest('Please give an email address or phone number so we can reply.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('Please enter a valid email address.');
  const msg = await prisma.contactMessage.create({
    data: { name, email, phone, subject: clip(b.subject, 200), message, ip: req.ip },
  });
  sendContactNotification(msg).catch((e) => console.error('[mail] contact notification failed:', e.message));
  res.status(201).json({ success: true });
});

export default router;
