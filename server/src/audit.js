import { prisma } from './db.js';

const IGNORED = new Set(['updated_date', 'created_date']);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// { field: { from, to } } for fields whose value changed.
export function diff(before, after) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (IGNORED.has(k)) continue;
    const from = before?.[k];
    const to = after?.[k];
    if (!same(from, to)) changes[k] = { from: from ?? null, to: to ?? null };
  }
  return Object.keys(changes).length ? changes : null;
}

const toJson = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Writes an audit entry. Pass `tx` to include it in the caller's transaction.
export async function writeAudit(ctx, entry, tx = prisma) {
  await tx.auditLog.create({
    data: {
      facility_id: entry.facility_id ?? ctx?.facilityId ?? null,
      entity: entry.entity,
      record_id: entry.record_id,
      action: entry.action,
      user_id: ctx?.userId ?? entry.user_id ?? null,
      user_name: ctx?.userName ?? entry.user_name ?? null,
      user_role: ctx?.role ?? entry.user_role ?? null,
      summary: entry.summary ?? null,
      changes: toJson(entry.changes ?? undefined),
      snapshot: toJson(entry.snapshot ?? undefined),
      ip: ctx?.ip ?? entry.ip ?? null,
    },
  });
}
