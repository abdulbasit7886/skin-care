// Translates the frontend's Mongo-style queries into Prisma `where` / `orderBy`.
// Supported: equality, $in, $nin, $ne, $gt, $gte, $lt, $lte, $exists, $regex(+$options), $or, $and.
import { badRequest } from '../http.js';

const MATCH_NONE = { id: { in: [] } };

const coerce = (field, v) => {
  if (v === null || v === undefined) return null;
  switch (field.type) {
    case 'Int': {
      const n = Number(v);
      if (!Number.isFinite(n)) throw badRequest(`Invalid number for ${field.name}`);
      return Math.trunc(n);
    }
    case 'Float': {
      const n = Number(v);
      if (!Number.isFinite(n)) throw badRequest(`Invalid number for ${field.name}`);
      return n;
    }
    case 'Boolean':
      return v === true || v === 'true';
    case 'DateTime': {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw badRequest(`Invalid date for ${field.name}`);
      return d;
    }
    case 'String':
      return String(v);
    default:
      return v;
  }
};

// Plain text with optional ^ / $ anchors -> Prisma string filter.
function regexToFilter(pattern, options = '') {
  const mode = String(options).includes('i') ? 'insensitive' : 'default';
  let p = String(pattern);
  const anchoredStart = p.startsWith('^');
  const anchoredEnd = p.endsWith('$') && !p.endsWith('\\$');
  if (anchoredStart) p = p.slice(1);
  if (anchoredEnd) p = p.slice(0, -1);
  p = p.replace(/^(\.\*)+/, '').replace(/(\.\*)+$/, '');
  // split on unescaped .* into parts that must all appear
  const parts = p.split(/(?<!\\)\.\*/).map((s) => s.replace(/\\(.)/g, '$1'));
  if (parts.length > 1) {
    return { AND: parts.filter(Boolean).map((s) => ({ contains: s, mode })) };
  }
  const text = parts[0];
  if (anchoredStart && anchoredEnd) return { equals: text, mode };
  if (anchoredStart) return { startsWith: text, mode };
  if (anchoredEnd) return { endsWith: text, mode };
  return { contains: text, mode };
}

function fieldCondition(name, value, field) {
  const isOpObject = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
    && Object.keys(value).some((k) => k.startsWith('$'));

  // ----- list fields (String[]) -----
  if (field.isList) {
    if (!isOpObject) {
      if (Array.isArray(value)) return { [name]: { equals: value.map(String) } };
      if (value === null) return { [name]: { isEmpty: true } };
      return { [name]: { has: String(value) } };
    }
    const parts = [];
    for (const [op, v] of Object.entries(value)) {
      if (op === '$in') parts.push({ [name]: { hasSome: (v || []).map(String) } });
      else if (op === '$nin') parts.push({ NOT: { [name]: { hasSome: (v || []).map(String) } } });
      else if (op === '$ne') parts.push({ NOT: { [name]: { has: String(v) } } });
      else if (op === '$exists') parts.push(v ? { NOT: { [name]: { isEmpty: true } } } : { [name]: { isEmpty: true } });
      else if (op === '$options') continue;
      else throw badRequest(`Operator ${op} is not supported on ${name}`);
    }
    return parts.length === 1 ? parts[0] : { AND: parts };
  }

  // ----- JSON fields: equality only -----
  if (field.type === 'Json') {
    if (isOpObject) throw badRequest(`Operators are not supported on ${name}`);
    return { [name]: { equals: value } };
  }

  // ----- scalars -----
  // Required (non-nullable) columns can never be null, so null comparisons are resolved here.
  const nullable = !field.isRequired;
  const isNull = () => (nullable ? { [name]: null } : MATCH_NONE);
  const notNull = () => (nullable ? { [name]: { not: null } } : {});

  if (!isOpObject) {
    if (Array.isArray(value)) return { [name]: { in: value.map((v) => coerce(field, v)) } };
    if (value === null) return isNull();
    return { [name]: coerce(field, value) };
  }

  const parts = [];
  const range = {};
  for (const [op, v] of Object.entries(value)) {
    switch (op) {
      case '$eq': parts.push(v === null ? isNull() : { [name]: coerce(field, v) }); break;
      case '$in': parts.push({ [name]: { in: (Array.isArray(v) ? v : [v]).filter((x) => x !== null).map((x) => coerce(field, x)) } }); break;
      case '$nin': {
        const list = (Array.isArray(v) ? v : [v]).filter((x) => x !== null).map((x) => coerce(field, x));
        // Mongo semantics: missing values are "not in" the list too
        parts.push(nullable ? { OR: [{ [name]: { notIn: list } }, { [name]: null }] } : { [name]: { notIn: list } });
        break;
      }
      case '$ne':
        if (v === null) parts.push(notNull());
        else if (nullable) parts.push({ OR: [{ [name]: { not: coerce(field, v) } }, { [name]: null }] });
        else parts.push({ [name]: { not: coerce(field, v) } });
        break;
      case '$gt': range.gt = coerce(field, v); break;
      case '$gte': range.gte = coerce(field, v); break;
      case '$lt': range.lt = coerce(field, v); break;
      case '$lte': range.lte = coerce(field, v); break;
      case '$exists': parts.push(v ? notNull() : isNull()); break;
      case '$regex': {
        if (field.type !== 'String') { parts.push(MATCH_NONE); break; }
        const f = regexToFilter(v, value.$options);
        if (f.AND) parts.push({ AND: f.AND.map((c) => ({ [name]: c })) });
        else parts.push({ [name]: f });
        break;
      }
      case '$options': break;
      default: throw badRequest(`Unsupported operator ${op}`);
    }
  }
  if (Object.keys(range).length) parts.push({ [name]: range });
  if (parts.length === 0) return {};
  return parts.length === 1 ? parts[0] : { AND: parts };
}

export function toWhere(query, fields) {
  if (query === undefined || query === null) return {};
  if (typeof query !== 'object' || Array.isArray(query)) throw badRequest('query must be an object');
  const and = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(value)) throw badRequest(`${key} must be an array`);
      const sub = value.map((q) => toWhere(q, fields));
      if (key === '$or') and.push(sub.length ? { OR: sub } : MATCH_NONE);
      else if (sub.length) and.push({ AND: sub });
      continue;
    }
    if (key.startsWith('$')) throw badRequest(`Unsupported operator ${key}`);
    const field = fields[key];
    if (!field) throw badRequest(`Unknown field "${key}"`);
    const cond = fieldCondition(key, value, field);
    if (Object.keys(cond).length) and.push(cond);
  }
  if (and.length === 0) return {};
  return and.length === 1 ? and[0] : { AND: and };
}

export function toOrderBy(sort, fields) {
  const order = [];
  if (sort) {
    const list = Array.isArray(sort) ? sort : String(sort).split(',');
    for (const raw of list) {
      const s = String(raw).trim();
      if (!s) continue;
      const desc = s.startsWith('-');
      const name = desc ? s.slice(1) : s;
      const f = fields[name];
      if (!f || f.isList || f.type === 'Json') throw badRequest(`Cannot sort by "${name}"`);
      order.push({ [name]: desc ? 'desc' : 'asc' });
    }
  }
  order.push({ id: 'asc' }); // stable paging
  return order;
}

export const encodeCursor = (offset) => Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
export const decodeCursor = (cursor) => {
  if (!cursor) return 0;
  try {
    const { o } = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    return Number.isInteger(o) && o >= 0 ? o : 0;
  } catch {
    throw badRequest('Invalid cursor');
  }
};

export { MATCH_NONE };
