import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { issueSession, clearSession, requireAuth } from '../auth.js';
import { badRequest, HttpError, unauthorized } from '../http.js';
import { assertPasswordPolicy, hashPassword, verifyPassword, newResetToken, sha256 } from '../password.js';
import { sendPasswordResetEmail } from '../mail.js';
import { buildMe } from '../profile.js';
import { writeAudit } from '../audit.js';

const router = Router();

const limitMessage = { error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please wait a few minutes and try again.' } };
// Only failed attempts count, so a whole clinic logging in from one shared IP isn't blocked.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, skipSuccessfulRequests: true,
  standardHeaders: 'draft-7', legacyHeaders: false, message: limitMessage,
});
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: limitMessage });

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Compared against when the user does not exist, so response time doesn't reveal valid user names.
const dummyHash = hashPassword(newResetToken().token);

const findByLogin = (login) => {
  const v = String(login || '').trim().toLowerCase();
  if (!v) return null;
  return prisma.user.findFirst({
    where: { OR: [{ username: v }, { email: v }] },
    include: { facility: true },
  });
};

router.post('/login', loginLimiter, async (req, res) => {
  const { login, password } = req.body || {};
  if (typeof login !== 'string' || typeof password !== 'string' || !login.trim() || !password) {
    throw badRequest('Enter your user name (or email) and password.');
  }
  const user = await findByLogin(login);
  if (user?.locked_until && user.locked_until > new Date()) {
    const mins = Math.ceil((user.locked_until - new Date()) / 60000);
    throw new HttpError(429, 'ACCOUNT_LOCKED', `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }
  const ok = await verifyPassword(password, user?.password_hash || (await dummyHash));
  if (!user || !ok) {
    if (user) {
      const failed = user.failed_logins + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED
          ? { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60000) }
          : { failed_logins: failed },
      });
    }
    throw unauthorized('Invalid user name or password.', 'INVALID_LOGIN');
  }
  if (!user.is_active) throw new HttpError(403, 'ACCOUNT_DISABLED', 'This account is disabled. Contact your administrator.');
  if (user.role !== 'super_admin' && (!user.facility || !user.facility.is_active || user.facility.deleted_at)) {
    throw new HttpError(403, 'FACILITY_INACTIVE', 'Your facility is not active. Contact the system administrator.');
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failed_logins: 0, locked_until: null, last_login_at: new Date() },
    include: { facility: true },
  });
  issueSession(res, updated);
  await writeAudit(null, {
    facility_id: user.facility_id, entity: 'User', record_id: user.id, action: 'login',
    user_id: user.id, user_name: user.full_name, user_role: user.role, ip: req.ip, summary: `${user.username} logged in`,
  });
  res.json({ user: await buildMe(updated) });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(await buildMe(req.user));
});

router.post('/forgot-password', resetLimiter, async (req, res) => {
  const user = await findByLogin(req.body?.login);
  if (user && user.is_active && user.email) {
    const { token, hash } = newResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { reset_token_hash: hash, reset_token_expires: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const link = `${config.appUrl}/portal/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail(user, link);
    } catch (e) {
      console.error('[mail] password reset email failed:', e.message);
    }
  }
  // Same answer whether or not the account exists.
  res.json({ success: true });
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token) throw badRequest('This reset link is invalid or has expired.', 'INVALID_TOKEN');
  assertPasswordPolicy(password);
  const user = await prisma.user.findFirst({
    where: { reset_token_hash: sha256(token), reset_token_expires: { gt: new Date() } },
  });
  if (!user) throw badRequest('This reset link is invalid or has expired.', 'INVALID_TOKEN');
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash: await hashPassword(password),
      reset_token_hash: null,
      reset_token_expires: null,
      password_changed_at: new Date(),
      failed_logins: 0,
      locked_until: null,
      token_version: { increment: 1 }, // sign out existing sessions
    },
  });
  await writeAudit(null, {
    facility_id: user.facility_id, entity: 'User', record_id: user.id, action: 'password_reset',
    user_id: user.id, user_name: user.full_name, user_role: user.role, ip: req.ip,
    summary: `${user.username} reset their password via email link`,
  });
  res.json({ success: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const user = req.user;
  if (typeof current_password !== 'string' || !(await verifyPassword(current_password, user.password_hash))) {
    throw badRequest('Your current password is incorrect.', 'WRONG_PASSWORD');
  }
  assertPasswordPolicy(new_password);
  if (new_password === current_password) throw badRequest('Choose a password different from the current one.');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { password_hash: await hashPassword(new_password), password_changed_at: new Date(), token_version: { increment: 1 } },
  });
  issueSession(res, updated); // keep this session, sign out the others
  await writeAudit(req.ctx, {
    facility_id: user.facility_id, entity: 'User', record_id: user.id, action: 'password_reset',
    summary: `${user.username} changed their password`,
  });
  res.json({ success: true });
});

export default router;
