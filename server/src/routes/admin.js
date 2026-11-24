import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireRoles } from '../auth.js';
import { badRequest, forbidden, notFound, HttpError } from '../http.js';
import { assertPasswordPolicy, hashPassword } from '../password.js';
import { publicUser } from '../profile.js';
import { writeAudit, diff } from '../audit.js';
import { encodeCursor, decodeCursor } from '../entities/query.js';
import { stripNulls } from '../entities/service.js';
import { clinicDayBoundary } from '../time.js';
import { CUSTOM_ROLE_BASES, CUSTOM_ROLE_PAGES } from '../entities/registry.js';

const router = Router();
router.use(requireAuth);

const USERNAME_RULE = /^[a-z0-9._@-]{3,64}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_ROLES = ['super_admin', 'admin', 'doctor', 'reception', 'accounts'];

const normEmail = (v) => {
  if (v === undefined) return undefined;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (!EMAIL_RULE.test(s)) throw badRequest('Enter a valid email address.');
  return s;
};

// Can the caller manage this (existing or proposed) login?
function assertCanManage(ctx, target) {
  if (ctx.role === 'super_admin') return;
  if (ctx.role !== 'admin') throw forbidden();
  if (target.facility_id !== ctx.user.facility_id) throw notFound();
  if (target.role === 'admin' || target.role === 'super_admin') {
    throw forbidden('Only the system super admin can manage administrator logins.');
  }
}

// ------------------------------------------------------------------ users
router.get('/users', requireRoles('super_admin', 'admin'), async (req, res) => {
  const where = {};
  if (req.ctx.role === 'admin') where.facility_id = req.ctx.user.facility_id;
  else if (req.query.facility_id) where.facility_id = String(req.query.facility_id);
  if (req.query.doctor_id) where.doctor_id = String(req.query.doctor_id);
  if (req.query.employee_id) where.employee_id = String(req.query.employee_id);
  const users = await prisma.user.findMany({ where, orderBy: [{ role: 'asc' }, { username: 'asc' }] });
  res.json({ items: users.map(publicUser) });
});

router.post('/users', requireRoles('super_admin', 'admin'), async (req, res) => {
  const ctx = req.ctx;
  const b = req.body || {};
  let role = String(b.role || '');
  // An employee's login always carries the employee's own role (custom roles resolve to their access level).
  if (b.employee_id) {
    const scopeFacility = ctx.role === 'super_admin' ? String(b.facility_id || ctx.facilityId || '') : ctx.user.facility_id;
    const e = scopeFacility && await prisma.employee.findFirst({
      where: { id: String(b.employee_id), facility_id: scopeFacility, deleted_at: null }, select: { role: true },
    });
    if (!e) throw badRequest('Employee record not found in this facility.');
    role = e.role;
  }
  if (!LOGIN_ROLES.includes(role)) throw badRequest('Choose a valid role.');
  if (role === 'super_admin' && ctx.role !== 'super_admin') throw forbidden();

  let facilityId = null;
  if (role !== 'super_admin') {
    facilityId = ctx.role === 'super_admin' ? String(b.facility_id || ctx.facilityId || '') : ctx.user.facility_id;
    const facility = facilityId && await prisma.facility.findFirst({ where: { id: facilityId, deleted_at: null } });
    if (!facility) throw badRequest('Choose the facility for this login.');
  }
  assertCanManage(ctx, { facility_id: facilityId, role });

  const username = String(b.username || '').trim().toLowerCase();
  if (!USERNAME_RULE.test(username)) {
    throw badRequest('User name must be 3–64 characters: letters, numbers, dot, dash, underscore or @.');
  }
  const email = normEmail(b.email);
  assertPasswordPolicy(b.password);

  let fullName = String(b.full_name || '').trim();
  let doctorId = null;
  let employeeId = null;
  if (b.doctor_id) {
    const d = await prisma.doctor.findFirst({ where: { id: String(b.doctor_id), facility_id: facilityId, deleted_at: null } });
    if (!d) throw badRequest('Doctor record not found in this facility.');
    if (role !== 'doctor') throw badRequest('A doctor record must have the doctor role.');
    doctorId = d.id;
    fullName = fullName || d.name;
  } else if (role === 'doctor') {
    throw badRequest('Doctor logins must be linked to a doctor record (create it under SetUp → Doctors).');
  }
  if (b.employee_id) {
    const e = await prisma.employee.findFirst({ where: { id: String(b.employee_id), facility_id: facilityId, deleted_at: null } });
    if (!e) throw badRequest('Employee record not found in this facility.');
    employeeId = e.id;
    fullName = fullName || `${e.first_name} ${e.last_name}`.trim();
  }
  if (!fullName) throw badRequest('Full name is required.');

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        facility_id: facilityId,
        username,
        email,
        full_name: fullName,
        role,
        doctor_id: doctorId,
        employee_id: employeeId,
        password_hash: await hashPassword(b.password),
        password_changed_at: new Date(),
        created_by: ctx.userId,
      },
    });
    await writeAudit(ctx, {
      facility_id: facilityId, entity: 'User', record_id: created.id, action: 'user_create',
      summary: `Created ${role} login "${username}" for ${fullName}`,
    }, tx);
    return created;
  });
  res.status(201).json(publicUser(user));
});

router.patch('/users/:id', requireRoles('super_admin', 'admin'), async (req, res) => {
  const ctx = req.ctx;
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound();
  assertCanManage(ctx, target);
  const b = req.body || {};
  const data = {};
  if (b.email !== undefined) data.email = normEmail(b.email);
  if (b.full_name !== undefined) {
    data.full_name = String(b.full_name || '').trim();
    if (!data.full_name) throw badRequest('Full name is required.');
  }
  if (b.role !== undefined && b.role !== target.role) {
    if (!LOGIN_ROLES.includes(b.role)) throw badRequest('Choose a valid role.');
    assertCanManage(ctx, { ...target, role: b.role });
    if (target.doctor_id && b.role !== 'doctor') throw badRequest('A doctor login must keep the doctor role.');
    data.role = b.role;
  }
  if (b.is_active !== undefined) {
    if (target.id === ctx.userId && !b.is_active) throw badRequest('You cannot disable your own login.');
    data.is_active = !!b.is_active;
  }
  if (!Object.keys(data).length) return res.json(publicUser(target));
  if (data.is_active === false || data.role) data.token_version = { increment: 1 };
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: target.id }, data });
    const changes = diff(
      { email: target.email, full_name: target.full_name, role: target.role, is_active: target.is_active },
      { email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active },
    );
    await writeAudit(ctx, {
      facility_id: target.facility_id, entity: 'User', record_id: target.id, action: 'user_update', changes,
      summary: `Updated login "${target.username}"`,
    }, tx);
    return u;
  });
  res.json(publicUser(updated));
});

router.post('/users/:id/reset-password', requireRoles('super_admin', 'admin'), async (req, res) => {
  const ctx = req.ctx;
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound();
  assertCanManage(ctx, target);
  assertPasswordPolicy(req.body?.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        password_hash: await hashPassword(req.body.password),
        password_changed_at: new Date(),
        failed_logins: 0,
        locked_until: null,
        reset_token_hash: null,
        reset_token_expires: null,
        token_version: { increment: 1 },
      },
    });
    await writeAudit(ctx, {
      facility_id: target.facility_id, entity: 'User', record_id: target.id, action: 'password_reset',
      summary: `Password for "${target.username}" reset by ${ctx.userName}`,
    }, tx);
  });
  res.json({ success: true });
});

// ------------------------------------------------------------------ custom roles
// Listed for admins (to assign to employees); created/changed only by the super admin.
const ROLE_NAME_RULE = /^[A-Za-z][A-Za-z0-9 .&/()-]{1,39}$/;
const BUILT_IN_NAMES = ['super admin', 'admin', 'administrator', 'doctor', 'front desk', 'reception', 'accounts'];

async function cleanRoleInput(b, existing) {
  const out = {};
  if (b.name !== undefined || !existing) {
    const name = String(b.name || '').trim().replace(/\s+/g, ' ');
    if (!ROLE_NAME_RULE.test(name)) throw badRequest('Role name must be 2–40 characters and start with a letter.');
    if (BUILT_IN_NAMES.includes(name.toLowerCase())) throw badRequest(`"${name}" is a built-in role. Choose another name.`);
    const clash = await prisma.customRole.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, deleted_at: null, ...(existing ? { NOT: { id: existing.id } } : {}) },
    });
    if (clash) throw badRequest(`A role called "${clash.name}" already exists.`);
    out.name = name;
  }
  if (b.description !== undefined) out.description = String(b.description || '').trim().slice(0, 300) || null;
  if (b.base_role !== undefined || !existing) {
    if (!CUSTOM_ROLE_BASES.includes(b.base_role)) throw badRequest('Choose an access level: Front Desk or Accounts.');
    out.base_role = b.base_role;
  }
  if (b.permissions !== undefined || !existing) {
    const pages = [...new Set((Array.isArray(b.permissions) ? b.permissions : []).map(String))];
    const bad = pages.filter((p) => !CUSTOM_ROLE_PAGES.includes(p));
    if (bad.length) throw badRequest('Custom roles cannot open the EMR or administration pages.');
    if (!pages.length) throw badRequest('Give the role at least one page.');
    out.permissions = pages;
  }
  const pages = out.permissions || existing?.permissions || [];
  if (b.landing_page !== undefined || out.permissions) {
    const landing = b.landing_page !== undefined ? b.landing_page : existing?.landing_page;
    out.landing_page = landing && pages.includes(landing) ? landing : pages[0] || null;
  }
  if (b.is_active !== undefined) out.is_active = !!b.is_active;
  return out;
}

const roleCounts = async (facilityId) => {
  const groups = await prisma.employee.groupBy({
    by: ['custom_role_id'],
    where: { custom_role_id: { not: null }, deleted_at: null, ...(facilityId ? { facility_id: facilityId } : {}) },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.custom_role_id, g._count._all]));
};

router.get('/roles', requireRoles('super_admin', 'admin'), async (req, res) => {
  const roles = await prisma.customRole.findMany({ where: { deleted_at: null }, orderBy: { name: 'asc' } });
  const counts = await roleCounts(req.ctx.role === 'admin' ? req.ctx.user.facility_id : null);
  res.json({ items: roles.map((r) => ({ ...stripNulls(r), employee_count: counts[r.id] || 0 })) });
});

router.post('/roles', requireRoles('super_admin'), async (req, res) => {
  const data = await cleanRoleInput(req.body || {}, null);
  const role = await prisma.$transaction(async (tx) => {
    const r = await tx.customRole.create({ data: { ...data, created_by: req.ctx.userId } });
    await writeAudit(req.ctx, {
      facility_id: null, entity: 'CustomRole', record_id: r.id, action: 'create', snapshot: r,
      summary: `Created custom role "${r.name}" (${r.base_role === 'accounts' ? 'Accounts' : 'Front Desk'} access)`,
    }, tx);
    return r;
  });
  res.status(201).json({ ...stripNulls(role), employee_count: 0 });
});

router.patch('/roles/:id', requireRoles('super_admin'), async (req, res) => {
  const existing = await prisma.customRole.findFirst({ where: { id: req.params.id, deleted_at: null } });
  if (!existing) throw notFound();
  const data = await cleanRoleInput(req.body || {}, existing);
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.customRole.update({ where: { id: existing.id }, data });
    if (data.base_role && data.base_role !== existing.base_role) {
      // move everyone with this role (and their logins) to the new access level
      const emps = await tx.employee.findMany({ where: { custom_role_id: r.id, deleted_at: null }, select: { id: true } });
      await tx.employee.updateMany({ where: { custom_role_id: r.id }, data: { role: r.base_role } });
      await tx.user.updateMany({
        where: { employee_id: { in: emps.map((e) => e.id) } },
        data: { role: r.base_role, token_version: { increment: 1 } },
      });
    }
    const keys = Object.keys(data);
    const changes = diff(Object.fromEntries(keys.map((k) => [k, existing[k]])), Object.fromEntries(keys.map((k) => [k, r[k]])));
    if (changes) {
      await writeAudit(req.ctx, {
        facility_id: null, entity: 'CustomRole', record_id: r.id, action: 'update', changes, summary: `Updated custom role "${r.name}"`,
      }, tx);
    }
    return r;
  });
  const counts = await roleCounts(null);
  res.json({ ...stripNulls(updated), employee_count: counts[updated.id] || 0 });
});

router.delete('/roles/:id', requireRoles('super_admin'), async (req, res) => {
  const existing = await prisma.customRole.findFirst({ where: { id: req.params.id, deleted_at: null } });
  if (!existing) throw notFound();
  const inUse = await prisma.employee.count({ where: { custom_role_id: existing.id, deleted_at: null } });
  if (inUse) {
    throw new HttpError(409, 'ROLE_IN_USE', `"${existing.name}" is assigned to ${inUse} employee${inUse === 1 ? '' : 's'}. Give them another role first, or mark this role inactive.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.customRole.update({ where: { id: existing.id }, data: { deleted_at: new Date(), deleted_by: req.ctx.userId } });
    await writeAudit(req.ctx, {
      facility_id: null, entity: 'CustomRole', record_id: existing.id, action: 'delete', snapshot: existing,
      summary: `Deleted custom role "${existing.name}"`,
    }, tx);
  });
  res.json({ success: true });
});

// ------------------------------------------------------------------ facilities (super admin)
const FACILITY_FIELDS = [
  'name', 'address', 'contact_number', 'proprietor_1', 'proprietor_2', 'registration_number',
  'email', 'website', 'tax_number', 'logo_url', 'is_active',
];
const pickFacility = (b = {}) => {
  const out = {};
  for (const k of FACILITY_FIELDS) {
    if (b[k] === undefined) continue;
    out[k] = k === 'is_active' ? !!b[k] : (b[k] === null ? null : String(b[k]).trim());
  }
  return out;
};

router.get('/facilities', requireRoles('super_admin'), async (req, res) => {
  const facilities = await prisma.facility.findMany({
    where: { deleted_at: null },
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });
  res.json({ items: facilities.map(({ _count, ...f }) => ({ ...stripNulls(f), user_count: _count.users })) });
});

router.post('/facilities', requireRoles('super_admin'), async (req, res) => {
  const data = pickFacility(req.body);
  if (!data.name) throw badRequest('Facility name is required.');
  const facility = await prisma.$transaction(async (tx) => {
    const f = await tx.facility.create({ data: { ...data, created_by: req.ctx.userId } });
    await writeAudit(req.ctx, {
      facility_id: f.id, entity: 'Facility', record_id: f.id, action: 'create', summary: `Onboarded facility "${f.name}"`, snapshot: f,
    }, tx);
    return f;
  });
  res.status(201).json(stripNulls(facility));
});

router.patch('/facilities/:id', requireRoles('super_admin'), async (req, res) => {
  const existing = await prisma.facility.findFirst({ where: { id: req.params.id, deleted_at: null } });
  if (!existing) throw notFound();
  const data = pickFacility(req.body);
  if (data.name === '') throw badRequest('Facility name is required.');
  const updated = await prisma.$transaction(async (tx) => {
    const f = await tx.facility.update({ where: { id: existing.id }, data });
    const keys = Object.keys(data);
    const changes = diff(Object.fromEntries(keys.map((k) => [k, existing[k]])), Object.fromEntries(keys.map((k) => [k, f[k]])));
    if (changes) {
      await writeAudit(req.ctx, {
        facility_id: f.id, entity: 'Facility', record_id: f.id, action: 'update', changes, summary: `Updated facility "${f.name}"`,
      }, tx);
    }
    return f;
  });
  res.json(stripNulls(updated));
});

// ------------------------------------------------------------------ audit log (super admin)
router.get('/audit', requireRoles('super_admin'), async (req, res) => {
  const q = req.query;
  const and = [];
  if (q.facility_id) and.push({ facility_id: String(q.facility_id) });
  if (q.entity) and.push({ entity: String(q.entity) });
  if (q.action) and.push({ action: String(q.action) });
  if (q.user_id) and.push({ user_id: String(q.user_id) });
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (q.from && dateRe.test(q.from)) and.push({ created_date: { gte: clinicDayBoundary(q.from) } });
  if (q.to && dateRe.test(q.to)) and.push({ created_date: { lte: clinicDayBoundary(q.to, true) } });
  const where = and.length ? { AND: and } : {};
  const take = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const skip = decodeCursor(q.cursor);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: [{ created_date: 'desc' }, { id: 'desc' }], skip, take }),
    prisma.auditLog.count({ where }),
  ]);
  const facilityIds = [...new Set(rows.map((r) => r.facility_id).filter(Boolean))];
  const facilities = await prisma.facility.findMany({ where: { id: { in: facilityIds } }, select: { id: true, name: true } });
  const names = Object.fromEntries(facilities.map((f) => [f.id, f.name]));
  const has_more = skip + rows.length < total;
  res.json({
    items: rows.map((r) => ({ ...r, facility_name: r.facility_id ? names[r.facility_id] || null : null })),
    total,
    has_more,
    next_cursor: has_more ? encodeCursor(skip + rows.length) : null,
  });
});

// ------------------------------------------------------------------ website messages
router.get('/messages', requireRoles('super_admin', 'admin'), async (req, res) => {
  const items = await prisma.contactMessage.findMany({ orderBy: { created_date: 'desc' }, take: 500 });
  res.json({ items: items.map(({ ip: _ip, ...m }) => m) });
});

router.patch('/messages/:id', requireRoles('super_admin', 'admin'), async (req, res) => {
  const msg = await prisma.contactMessage.update({
    where: { id: req.params.id },
    data: { is_read: !!req.body?.is_read },
  });
  const { ip: _ip, ...rest } = msg;
  res.json(rest);
});

export default router;
