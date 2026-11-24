// Cookie sessions (JWT), request context and role guards.
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { prisma } from './db.js';
import { badRequest, forbidden, unauthorized } from './http.js';

export const SESSION_COOKIE = 'hs_session';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
});

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, v: user.token_version }, config.jwtSecret, {
    expiresIn: `${config.sessionHours}h`,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: config.sessionHours * 3600 * 1000 });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

// Returns the active user for this request's session, or null.
export async function loadSessionUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { facility: true } });
  if (!user || !user.is_active || user.token_version !== payload.v) return null;
  if (user.role !== 'super_admin') {
    const f = user.facility;
    if (!f || !f.is_active || f.deleted_at) return null;
  }
  return user;
}

// The facility a request operates on. Super admins pick one with X-Facility-Id;
// everyone else is pinned to their own facility.
async function resolveFacilityId(req, user) {
  if (user.role !== 'super_admin') return user.facility_id;
  const requested = req.get('X-Facility-Id');
  if (!requested) return null;
  const f = await prisma.facility.findFirst({ where: { id: requested, deleted_at: null }, select: { id: true } });
  return f ? f.id : null;
}

export const requireAuth = async (req, res, next) => {
  const user = await loadSessionUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  req.ctx = {
    user,
    userId: user.id,
    userName: user.full_name,
    role: user.role,
    doctorId: user.doctor_id,
    employeeId: user.employee_id,
    facilityId: await resolveFacilityId(req, user),
    ip: req.ip,
  };
  next();
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.ctx || !roles.includes(req.ctx.role)) throw forbidden();
  next();
};

export const requireFacility = (req, res, next) => {
  if (!req.ctx?.facilityId) {
    throw badRequest('Select a facility first.', 'NO_FACILITY');
  }
  next();
};

// Mutating requests must come from our web client (simple CSRF guard on top of SameSite cookies).
export const csrfGuard = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-HS-Client') !== 'web') {
    return res.status(403).json({ error: { code: 'CSRF', message: 'Request blocked.' } });
  }
  next();
};

export const isAdminRole = (role) => role === 'super_admin' || role === 'admin';
