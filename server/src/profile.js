import { prisma } from './db.js';

// The `Me` object returned by /api/auth/me (see server/API.md).
export async function buildMe(user) {
  let permissions = null;
  let landingPage = null;
  let customRole = null;
  if (user.doctor_id) {
    const d = await prisma.doctor.findFirst({ where: { id: user.doctor_id, deleted_at: null } });
    if (d) {
      permissions = Array.isArray(d.permissions) ? d.permissions : null;
      landingPage = d.landing_page || null;
    }
  } else if (user.employee_id) {
    const e = await prisma.employee.findFirst({ where: { id: user.employee_id, deleted_at: null } });
    if (e) {
      permissions = Array.isArray(e.permissions) ? e.permissions : null;
      landingPage = e.landing_page || null;
      if (e.custom_role_id) {
        // a custom role's pages apply to everyone who has it
        const role = await prisma.customRole.findFirst({ where: { id: e.custom_role_id, deleted_at: null } });
        if (role) {
          customRole = { id: role.id, name: role.name };
          permissions = role.is_active ? role.permissions : [];
          landingPage = role.landing_page || null;
        }
      }
    }
  }
  const me = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    effectiveRole: user.role,
    facility_id: user.facility_id,
    facility_name: user.facility?.name ?? null,
    doctor_id: user.doctor_id,
    employee_id: user.employee_id,
    permissions: user.role === 'super_admin' ? null : permissions,
    landingPage,
    custom_role_id: customRole?.id ?? null,
    role_name: customRole?.name ?? null, // display name when a custom role applies
  };
  if (user.role === 'super_admin') {
    me.facilities = await prisma.facility.findMany({
      where: { deleted_at: null, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  return me;
}

export const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  full_name: u.full_name,
  role: u.role,
  facility_id: u.facility_id,
  doctor_id: u.doctor_id,
  employee_id: u.employee_id,
  is_active: u.is_active,
  last_login_at: u.last_login_at,
  created_date: u.created_date,
});
