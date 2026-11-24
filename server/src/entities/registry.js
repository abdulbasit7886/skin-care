// Entity definitions + the business rules the server enforces for each one.
// Every rule here is the source of truth; the UI only mirrors them.
import { Prisma } from '@prisma/client';
import { badRequest, forbidden, HttpError, notFound } from '../http.js';
import { clinicDate } from '../time.js';
import { isAdminRole } from '../auth.js';

const ALL = ['super_admin', 'admin', 'doctor', 'reception', 'accounts'];
const ADMINS = ['super_admin', 'admin'];
const CLINICAL_STAFF = ['super_admin', 'admin', 'doctor', 'reception'];

export const SYSTEM_FIELDS = new Set([
  'id', 'facility_id', 'created_date', 'updated_date', 'created_by', 'deleted_at', 'deleted_by',
]);

const modelFields = (modelName) => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  if (!model) throw new Error(`Unknown model ${modelName}`);
  const out = {};
  for (const f of model.fields) if (f.kind === 'scalar' || f.kind === 'enum') out[f.name] = f;
  return out;
};

const define = (name, opts = {}) => ({
  name,
  delegate: name[0].toLowerCase() + name.slice(1),
  fields: modelFields(name),
  read: ALL,
  create: ADMINS,
  update: ADMINS,
  remove: ADMINS,
  protectedFields: [],
  ...opts,
});

// ---------------------------------------------------------------- EMR rules
const EMR_LIMITED_FIELDS = [
  'id', 'facility_id', 'appointment_id', 'patient_id', 'patient_name', 'mrn', 'doctor_id', 'doctor_name',
  'visit_date', 'labs_tests', 'prescription', 'advise', 'services_offered', 'procedures_performed',
  'followup_date', 'created_date', 'updated_date',
];
const IMPORTED = 'imported';

const ownsEmr = (ctx, emr) =>
  ctx.role === 'doctor' && !!ctx.doctorId && (emr.doctor_id === ctx.doctorId || emr.doctor_id === IMPORTED);

const emrEditable = (ctx, emr) =>
  ctx.role === 'doctor' && !!ctx.doctorId && emr.doctor_id === ctx.doctorId
  && clinicDate(emr.created_date) === clinicDate();

// ---------------------------------------------------------------- custom roles
// A custom role always runs on a built-in access level; the server enforces that level for data.
export const CUSTOM_ROLE_BASES = ['reception', 'accounts'];
// Pages a custom role may open (never the EMR or admin pages).
export const CUSTOM_ROLE_PAGES = ['/patients', '/scheduling', '/import-chart', '/archived-records', '/appointments', '/reception', '/', '/reports'];

async function applyCustomRole(data, tx) {
  if (!data.custom_role_id) {
    if ('custom_role_id' in data) data.custom_role_id = null;
    return;
  }
  const role = await tx.customRole.findFirst({ where: { id: data.custom_role_id, deleted_at: null } });
  if (!role) throw badRequest('That custom role no longer exists.');
  if (!role.is_active) throw badRequest(`The role "${role.name}" is inactive.`);
  data.role = role.base_role;
  data.permissions = Prisma.DbNull; // pages come from the role
  data.landing_page = null;
}

const doctorName = async (tx, ctx) => {
  if (!ctx.doctorId) return ctx.userName;
  const d = await tx.doctor.findFirst({ where: { id: ctx.doctorId }, select: { name: true } });
  return d?.name || ctx.userName;
};

// ---------------------------------------------------------------- definitions
const entities = {
  Facility: define('Facility', {
    // A facility is created/removed by the super admin via /api/admin/facilities.
    create: [],
    remove: [],
    update: ADMINS,
    protectedFields: ['is_active'],
    facilityScoped: false,
    scope: (ctx) => ({ id: ctx.facilityId }),
  }),

  Doctor: define('Doctor', {}),

  Employee: define('Employee', {
    beforeCreate: async (ctx, data, tx) => {
      await applyCustomRole(data, tx);
      if (data.role === 'admin' && ctx.role !== 'super_admin') {
        throw forbidden('Only the system super admin can create administrators.');
      }
      if (data.role && !['admin', 'reception', 'accounts', 'doctor'].includes(data.role)) {
        throw badRequest('Invalid role.');
      }
      return data;
    },
    beforeUpdate: async (ctx, existing, data, tx) => {
      if ('custom_role_id' in data || 'role' in data) {
        // choosing a built-in role clears the custom role; choosing a custom role sets the base role
        if (!('custom_role_id' in data) && data.role) data.custom_role_id = null;
        await applyCustomRole(data, tx);
      }
      if (ctx.role !== 'super_admin' && (existing.role === 'admin' || data.role === 'admin')) {
        throw forbidden('Only the system super admin can manage administrators.');
      }
      if (data.role && !['admin', 'reception', 'accounts', 'doctor'].includes(data.role)) {
        throw badRequest('Invalid role.');
      }
      if (data.role && data.role !== existing.role) {
        // keep the linked login's role in step (and sign it out so the new role applies)
        await tx.user.updateMany({
          where: { employee_id: existing.id },
          data: { role: data.role, token_version: { increment: 1 } },
        });
      }
      return { data };
    },
    beforeDelete: async (ctx, existing) => {
      if (ctx.role !== 'super_admin' && existing.role === 'admin') {
        throw forbidden('Only the system super admin can remove administrators.');
      }
    },
  }),

  Patient: define('Patient', {
    create: CLINICAL_STAFF,
    update: CLINICAL_STAFF,
    beforeCreate: async (ctx, data) => {
      if (!data.name && (data.first_name || data.last_name)) {
        data.name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      }
      return data;
    },
  }),

  Appointment: define('Appointment', {
    create: CLINICAL_STAFF,
    update: CLINICAL_STAFF,
    beforeCreate: async (ctx, data, tx) => {
      const doc = await tx.doctor.findFirst({ where: { id: data.doctor_id, facility_id: ctx.facilityId, deleted_at: null } });
      if (!doc) throw badRequest('Choose a doctor from this facility.');
      data.doctor_name = data.doctor_name || doc.name;
      return data;
    },
    beforeUpdate: async (ctx, existing, data, tx) => {
      if (data.doctor_id && data.doctor_id !== existing.doctor_id) {
        if (!['booked', 'checked_in'].includes(existing.status)) {
          throw new HttpError(409, 'APPOINTMENT_CLOSED', 'The attending doctor can only be changed before the visit is completed.');
        }
        const emr = await tx.eMR.findFirst({ where: { appointment_id: existing.id, facility_id: ctx.facilityId, deleted_at: null } });
        if (emr) throw new HttpError(409, 'EMR_STARTED', 'The attending doctor cannot be changed after the EMR has been started.');
        const doc = await tx.doctor.findFirst({ where: { id: data.doctor_id, facility_id: ctx.facilityId, deleted_at: null } });
        if (!doc) throw badRequest('Choose a doctor from this facility.');
        data.doctor_name = doc.name;
      }
      return { data };
    },
  }),

  EMR: define('EMR', {
    create: ['super_admin', 'admin', 'doctor', 'reception'], // non-doctors: imported charts only (checked below)
    update: ['doctor'],
    remove: [], // an EMR can never be deleted
    present: (ctx, rec) => {
      const full = ownsEmr(ctx, rec);
      const out = full ? { ...rec } : Object.fromEntries(EMR_LIMITED_FIELDS.map((k) => [k, rec[k]]));
      out._access = full ? 'full' : 'limited';
      out._can_edit = emrEditable(ctx, rec);
      return out;
    },
    beforeCreate: async (ctx, data, tx) => {
      if (data.doctor_id === IMPORTED) {
        // Historical paper chart entered through Scan Chart.
        if (!String(data.appointment_id || '').startsWith('imported:')) {
          throw badRequest('Imported records need an imported appointment reference.');
        }
        const patient = await tx.patient.findFirst({ where: { id: data.patient_id, facility_id: ctx.facilityId, deleted_at: null } });
        if (!patient) throw badRequest('Patient not found.');
        data.doctor_name = data.doctor_name || 'Imported record';
        return data;
      }
      if (ctx.role !== 'doctor' || !ctx.doctorId) {
        throw forbidden('Only the attending doctor can create an EMR.', 'EMR_DOCTOR_ONLY');
      }
      const appt = await tx.appointment.findFirst({
        where: { id: data.appointment_id, facility_id: ctx.facilityId, deleted_at: null },
      });
      if (!appt) throw badRequest('Appointment not found.');
      if (appt.doctor_id !== ctx.doctorId) {
        throw forbidden('This patient is booked with another doctor.', 'NOT_ATTENDING_DOCTOR');
      }
      if (['cancelled', 'no_show'].includes(appt.status)) {
        throw new HttpError(409, 'APPOINTMENT_CLOSED', 'This appointment was cancelled or marked as a no-show.');
      }
      const existing = await tx.eMR.findFirst({ where: { appointment_id: appt.id, facility_id: ctx.facilityId, deleted_at: null } });
      if (existing) throw new HttpError(409, 'EMR_EXISTS', 'An EMR already exists for this visit.');
      data.doctor_id = ctx.doctorId;
      data.doctor_name = appt.doctor_name || (await doctorName(tx, ctx));
      data.patient_id = appt.patient_id;
      data.patient_name = data.patient_name || appt.patient_name;
      data.mrn = data.mrn || appt.mrn;
      data.visit_date = data.visit_date || appt.date;
      return data;
    },
    beforeUpdate: async (ctx, existing, data) => {
      if (!ownsEmr(ctx, existing) || existing.doctor_id === IMPORTED) {
        throw forbidden('Only the attending doctor can change this EMR.', 'NOT_ATTENDING_DOCTOR');
      }
      if (!emrEditable(ctx, existing)) {
        throw forbidden('This EMR is locked because the day it was saved has passed. Add an addendum instead.', 'EMR_LOCKED');
      }
      for (const k of ['appointment_id', 'patient_id', 'doctor_id', 'doctor_name']) delete data[k];
      return { data };
    },
  }),

  EMRAddendum: define('EMRAddendum', {
    create: ['doctor'],
    update: [],
    remove: [],
    protectedFields: ['doctor_id', 'doctor_name', 'emr_doctor_id'],
    // Addenda are clinical: only the doctor who owns the EMR (or any doctor, for imported charts) sees them.
    scope: (ctx) => (ctx.role === 'doctor' && ctx.doctorId
      ? { emr_doctor_id: { in: [ctx.doctorId, IMPORTED] } }
      : { id: { in: [] } }),
    beforeCreate: async (ctx, data, tx) => {
      const text = String(data.text || '').trim();
      if (!text) throw badRequest('Addendum text is required.');
      const emr = await tx.eMR.findFirst({ where: { id: data.emr_id, facility_id: ctx.facilityId, deleted_at: null } });
      if (!emr) throw badRequest('EMR not found.');
      if (!ownsEmr(ctx, emr)) throw forbidden('Only the attending doctor can add an addendum.', 'NOT_ATTENDING_DOCTOR');
      return {
        emr_id: emr.id,
        emr_doctor_id: emr.doctor_id,
        doctor_id: ctx.doctorId,
        doctor_name: await doctorName(tx, ctx),
        text,
      };
    },
  }),

  Invoice: define('Invoice', {
    create: ['super_admin', 'admin', 'doctor', 'reception', 'accounts'],
    update: ['super_admin', 'admin', 'doctor', 'reception', 'accounts'],
    protectedFields: ['is_corrected', 'revision', 'corrected_at', 'corrected_by', 'printed_at'],
    present: (ctx, rec) => ({ ...rec, _can_edit: !rec.printed || isAdminRole(ctx.role) }),
    beforeCreate: async (ctx, data) => {
      if (data.printed) data.printed_at = new Date();
      return data;
    },
    beforeUpdate: async (ctx, existing, data) => {
      if (existing.printed) {
        if (!isAdminRole(ctx.role)) {
          throw forbidden('This invoice has been printed and is locked. Only an administrator can correct it.', 'INVOICE_LOCKED');
        }
        if (data.printed === false) delete data.printed; // a printed invoice can never be "unprinted"
        const changed = Object.keys(data).filter(
          (k) => k !== 'printed' && JSON.stringify(data[k]) !== JSON.stringify(existing[k]),
        );
        if (changed.length) {
          data.is_corrected = true;
          data.revision = (existing.revision || 0) + 1;
          data.corrected_at = new Date();
          data.corrected_by = ctx.userName;
          return { data, action: 'correct_invoice', summary: `Invoice corrected (revision ${data.revision})` };
        }
        return { data };
      }
      if (data.printed === true) {
        data.printed_at = new Date();
        return { data, action: 'print_invoice', summary: 'Invoice printed and locked' };
      }
      return { data };
    },
  }),

  // Catalog and tax (SetUp) are managed by administrators only.
  Service: define('Service', {}),
  Procedure: define('Procedure', {}),
  LabTest: define('LabTest', {}),
  TaxRate: define('TaxRate', {}),
};

export function getEntity(name) {
  const e = Object.prototype.hasOwnProperty.call(entities, name) ? entities[name] : null;
  if (!e) throw notFound(`Unknown entity "${name}".`);
  return e;
}

export const IMPORTED_DOCTOR = IMPORTED;
