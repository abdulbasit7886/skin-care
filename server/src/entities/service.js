// Generic, policy-checked CRUD over the entity registry.
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { writeAudit, diff } from '../audit.js';
import { badRequest, forbidden, notFound } from '../http.js';
import { toWhere, toOrderBy, encodeCursor, decodeCursor } from './query.js';
import { SYSTEM_FIELDS } from './registry.js';

const EMR_QUERYABLE_BY_ANYONE = new Set([
  'id', 'appointment_id', 'patient_id', 'patient_name', 'mrn', 'doctor_id', 'doctor_name', 'visit_date',
  'followup_date', 'created_date', 'updated_date',
]);

const can = (e, ctx, action) => e[action].includes(ctx.role);

const baseWhere = (e, ctx) => {
  const parts = [{ deleted_at: null }];
  if (e.facilityScoped !== false) parts.push({ facility_id: ctx.facilityId });
  if (e.scope) parts.push(e.scope(ctx));
  return parts;
};

// Field names referenced anywhere in a Mongo-style query (or a sort spec).
const referencedFields = (query, out = new Set()) => {
  if (!query || typeof query !== 'object') return out;
  for (const [k, v] of Object.entries(query)) {
    if (k === '$or' || k === '$and') (Array.isArray(v) ? v : []).forEach((q) => referencedFields(q, out));
    else if (!k.startsWith('$')) out.add(k);
  }
  return out;
};

// Searching or sorting EMRs by clinical fields is only allowed over records you may read in full,
// otherwise the search itself would reveal clinical information.
function clinicalSearchGuard(e, ctx, query, sort) {
  if (e.name !== 'EMR') return null;
  const used = referencedFields(query);
  String(sort || '').split(',').map((s) => s.trim().replace(/^-/, '')).filter(Boolean).forEach((s) => used.add(s));
  const clinical = [...used].filter((f) => !EMR_QUERYABLE_BY_ANYONE.has(f));
  if (!clinical.length) return null;
  if (ctx.role !== 'doctor' || !ctx.doctorId) {
    throw forbidden('Clinical EMR fields are restricted to the attending doctor.', 'EMR_RESTRICTED');
  }
  return { doctor_id: { in: [ctx.doctorId, 'imported'] } };
}

const coerceWrite = (field, v) => {
  if (field.isList) {
    if (v === null || v === undefined || v === '') return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr
      .filter((x) => x !== null && x !== undefined && x !== '')
      .map((x) => (typeof x === 'string' ? x : typeof x === 'object' ? JSON.stringify(x) : String(x)));
  }
  if (v === null) return field.type === 'Json' ? Prisma.DbNull : null;
  switch (field.type) {
    case 'String':
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    case 'Int':
    case 'Float': {
      if (v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) throw badRequest(`"${field.name}" must be a number.`);
      return field.type === 'Int' ? Math.trunc(n) : n;
    }
    case 'Boolean':
      return v === true || v === 'true' || v === 1;
    case 'DateTime': {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw badRequest(`"${field.name}" must be a date.`);
      return d;
    }
    case 'Json':
      return v;
    default:
      return v;
  }
};

function cleanData(e, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('Body must be an object.');
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || SYSTEM_FIELDS.has(k) || e.protectedFields.includes(k)) continue;
    const f = e.fields[k];
    if (!f) continue; // unknown or computed (e.g. _access) fields are ignored
    out[k] = coerceWrite(f, v);
  }
  return out;
}

function requireFields(e, data) {
  for (const f of Object.values(e.fields)) {
    if (SYSTEM_FIELDS.has(f.name) || !f.isRequired || f.hasDefaultValue || f.isUpdatedAt || f.isList) continue;
    const v = data[f.name];
    if (v === undefined || v === null || v === '') throw badRequest(`"${f.name}" is required.`, 'MISSING_FIELD');
  }
}

// Empty (null) fields are omitted, as the frontend expects (form inputs treat missing as '').
export const stripNulls = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null));

// Reads omit nulls; write responses keep them so a cleared field overwrites the caller's copy.
function present(e, ctx, rec, fields, { keepNulls = false } = {}) {
  const base = e.present ? e.present(ctx, rec) : { ...rec };
  let out = keepNulls ? base : stripNulls(base);
  delete out.deleted_at;
  delete out.deleted_by;
  if (Array.isArray(fields) && fields.length) {
    const keep = new Set(['id', ...fields]);
    out = Object.fromEntries(Object.entries(out).filter(([k]) => keep.has(k) || k.startsWith('_')));
  }
  return out;
}

export const summarize = (e, rec) => {
  const who = rec.name || rec.patient_name
    || [rec.first_name, rec.last_name].filter(Boolean).join(' ') || '';
  switch (e.name) {
    case 'Invoice': return `Invoice for ${who || rec.patient_id} — total ${rec.total ?? 0}, paid ${rec.amount_paid ?? 0}`;
    case 'Appointment': return `Appointment: ${who} with ${rec.doctor_name || rec.doctor_id} on ${rec.date} ${rec.start_time} (${rec.status})`;
    case 'EMR': return `EMR for ${who} by ${rec.doctor_name || rec.doctor_id} (${rec.visit_date || ''})`;
    case 'EMRAddendum': return `Addendum by ${rec.doctor_name || rec.doctor_id} on EMR ${rec.emr_id}`;
    case 'TaxRate': return `Tax rate ${rec.rate}% from ${rec.effective_date}`;
    default: return `${e.name}: ${who || rec.id}`;
  }
};

const clampLimit = (n) => Math.min(Math.max(Number.isFinite(Number(n)) ? Number(n) : 50, 1), 1000);

export async function queryEntity(e, ctx, body = {}) {
  if (!can(e, ctx, 'read')) throw forbidden();
  const { query, sort, limit, skip, cursor, fields } = body;
  const extra = clinicalSearchGuard(e, ctx, query, sort);
  const take = clampLimit(limit);
  const offset = cursor ? decodeCursor(cursor) : Math.max(0, Math.trunc(Number(skip) || 0));
  const where = { AND: [...baseWhere(e, ctx), toWhere(query, e.fields), ...(extra ? [extra] : [])] };
  const delegate = prisma[e.delegate];
  const [rows, total] = await Promise.all([
    delegate.findMany({ where, orderBy: toOrderBy(sort, e.fields), skip: offset, take }),
    delegate.count({ where }),
  ]);
  const has_more = offset + rows.length < total;
  return {
    items: rows.map((r) => present(e, ctx, r, fields)),
    total,
    has_more,
    next_cursor: has_more ? encodeCursor(offset + rows.length) : null,
  };
}

export async function countEntity(e, ctx, body = {}) {
  if (!can(e, ctx, 'read')) throw forbidden();
  const extra = clinicalSearchGuard(e, ctx, body.query);
  const where = { AND: [...baseWhere(e, ctx), toWhere(body.query, e.fields), ...(extra ? [extra] : [])] };
  return { count: await prisma[e.delegate].count({ where }) };
}

export async function aggregateEntity(e, ctx, body = {}) {
  if (!can(e, ctx, 'read')) throw forbidden();
  if (e.name === 'EMR' || e.name === 'EMRAddendum') throw forbidden('Aggregates are not available for clinical records.');
  const { query, groupBy, sum = [], sort } = body;
  const gf = e.fields[groupBy];
  if (!gf || gf.isList || gf.type === 'Json') throw badRequest('Invalid groupBy field.');
  const sums = (Array.isArray(sum) ? sum : [sum]).filter(Boolean);
  for (const f of sums) {
    if (!e.fields[f] || !['Int', 'Float'].includes(e.fields[f].type)) throw badRequest(`Cannot sum "${f}".`);
  }
  const where = { AND: [...baseWhere(e, ctx), toWhere(query, e.fields)] };
  const groups = await prisma[e.delegate].groupBy({
    by: [groupBy],
    where,
    _count: { _all: true },
    ...(sums.length ? { _sum: Object.fromEntries(sums.map((f) => [f, true])) } : {}),
  });
  let rows = groups.map((g) => ({
    [groupBy]: g[groupBy],
    count: g._count._all,
    ...Object.fromEntries(sums.map((f) => [`sum_${f}`, g._sum?.[f] ?? 0])),
  }));
  if (sort) {
    const desc = String(sort).startsWith('-');
    const key = desc ? String(sort).slice(1) : String(sort);
    rows = rows.sort((a, b) => {
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  return { rows };
}

export async function getEntityRecord(e, ctx, id) {
  if (!can(e, ctx, 'read')) throw forbidden();
  const rec = await prisma[e.delegate].findFirst({ where: { AND: [...baseWhere(e, ctx), { id: String(id) }] } });
  if (!rec) throw notFound();
  return present(e, ctx, rec);
}

async function createOne(e, ctx, body, tx) {
  let data = cleanData(e, body);
  if (e.beforeCreate) data = await e.beforeCreate(ctx, data, tx);
  requireFields(e, data);
  const rec = await tx[e.delegate].create({
    data: {
      ...data,
      ...(e.facilityScoped !== false ? { facility_id: ctx.facilityId } : {}),
      created_by: ctx.userId,
    },
  });
  await writeAudit(ctx, {
    entity: e.name, record_id: rec.id, action: 'create', summary: summarize(e, rec), snapshot: rec,
  }, tx);
  return rec;
}

export async function createEntity(e, ctx, body) {
  if (!can(e, ctx, 'create')) throw forbidden();
  const rec = await prisma.$transaction((tx) => createOne(e, ctx, body, tx));
  return present(e, ctx, rec, undefined, { keepNulls: true });
}

export async function bulkCreateEntity(e, ctx, rows) {
  if (!can(e, ctx, 'create')) throw forbidden();
  if (!Array.isArray(rows)) throw badRequest('Body must be an array.');
  if (rows.length > 200) throw badRequest('At most 200 records per request.');
  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    for (const row of rows) out.push(await createOne(e, ctx, row, tx));
    return out;
  });
  return { items: created.map((r) => present(e, ctx, r, undefined, { keepNulls: true })) };
}

export async function updateEntity(e, ctx, id, body) {
  if (!can(e, ctx, 'update')) throw forbidden();
  const rec = await prisma.$transaction(async (tx) => {
    const existing = await tx[e.delegate].findFirst({ where: { AND: [...baseWhere(e, ctx), { id: String(id) }] } });
    if (!existing) throw notFound();
    let data = cleanData(e, body);
    let action = 'update';
    let summary;
    if (e.beforeUpdate) {
      const r = await e.beforeUpdate(ctx, existing, data, tx);
      data = r.data;
      action = r.action || 'update';
      summary = r.summary;
    }
    if (!Object.keys(data).length) return existing;
    const updated = await tx[e.delegate].update({ where: { id: existing.id }, data });
    const keys = Object.keys(data);
    const changes = diff(
      Object.fromEntries(keys.map((k) => [k, existing[k]])),
      Object.fromEntries(keys.map((k) => [k, updated[k]])),
    );
    if (changes || action !== 'update') {
      await writeAudit(ctx, {
        entity: e.name, record_id: existing.id, action, changes, summary: summary || summarize(e, updated),
      }, tx);
    }
    return updated;
  });
  return present(e, ctx, rec, undefined, { keepNulls: true });
}

export async function deleteEntity(e, ctx, id) {
  if (!can(e, ctx, 'remove')) throw forbidden(e.remove.length ? undefined : `${e.name} records cannot be deleted.`);
  await prisma.$transaction(async (tx) => {
    const existing = await tx[e.delegate].findFirst({ where: { AND: [...baseWhere(e, ctx), { id: String(id) }] } });
    if (!existing) throw notFound();
    if (e.beforeDelete) await e.beforeDelete(ctx, existing, tx);
    await tx[e.delegate].update({ where: { id: existing.id }, data: { deleted_at: new Date(), deleted_by: ctx.userId } });
    // Removing a doctor/employee also disables their login.
    if (e.name === 'Doctor' || e.name === 'Employee') {
      const key = e.name === 'Doctor' ? 'doctor_id' : 'employee_id';
      await tx.user.updateMany({
        where: { [key]: existing.id },
        data: { is_active: false, token_version: { increment: 1 } },
      });
    }
    await writeAudit(ctx, {
      entity: e.name, record_id: existing.id, action: 'delete', summary: `Deleted ${summarize(e, existing)}`, snapshot: existing,
    }, tx);
  });
  return { success: true };
}
