// HTTP client for the Health Synapsis API (see server/API.md).
// Sessions use an httpOnly cookie, so no token handling is needed here.

const BASE = '/api';
const FACILITY_KEY = 'hs_facility_id';

export class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// --- active facility (super admin chooses which facility the clinic pages use) ---
export const getActiveFacilityId = () => {
  try { return window.localStorage.getItem(FACILITY_KEY) || null; } catch { return null; }
};
export const setActiveFacilityId = (id) => {
  try {
    if (id) window.localStorage.setItem(FACILITY_KEY, id);
    else window.localStorage.removeItem(FACILITY_KEY);
  } catch { /* storage unavailable */ }
};

async function request(method, path, body, { isForm = false } = {}) {
  const headers = { 'X-HS-Client': 'web' };
  const facilityId = getActiveFacilityId();
  if (facilityId) headers['X-Facility-Id'] = facilityId;
  let payload;
  if (body !== undefined) {
    if (isForm) payload = body;
    else { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  }
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, credentials: 'include' });
  } catch (e) {
    throw new ApiError('Cannot reach the server. Check your connection.', { status: 0, code: 'NETWORK' });
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = data && data.error;
    throw new ApiError((err && err.message) || res.statusText || 'Request failed', {
      status: res.status,
      code: err && err.code,
      data,
    });
  }
  return data;
}

const qs = (params = {}) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  });
  const str = s.toString();
  return str ? `?${str}` : '';
};

// Entity helper with the same call shapes the pages already use:
//   filter(query, { sort, limit, cursor, fields }) -> { items, total, has_more, next_cursor }
//   list({ sort, limit, fields })                  -> same as filter({}, opts)
//   get(id), create(data), update(id, data), delete(id), bulkCreate([...]) -> items
//   count(query) -> number,  aggregate({ query, groupBy, sum, sort }) -> { rows }
const entity = (name) => {
  const base = `/entities/${encodeURIComponent(name)}`;
  return {
    filter: (query = {}, opts = {}) => request('POST', `${base}/query`, { query, ...opts }),
    list: (opts = {}) => request('POST', `${base}/query`, { query: {}, ...opts }),
    get: (id) => request('GET', `${base}/${encodeURIComponent(id)}`),
    create: (data) => request('POST', base, data),
    bulkCreate: async (rows) => (await request('POST', `${base}/bulk`, rows)).items,
    update: (id, data) => request('PATCH', `${base}/${encodeURIComponent(id)}`, data),
    delete: (id) => request('DELETE', `${base}/${encodeURIComponent(id)}`),
    count: async (query = {}) => (await request('POST', `${base}/count`, { query })).count,
    aggregate: (opts) => request('POST', `${base}/aggregate`, opts),
  };
};

const entityCache = {};

export const api = {
  entities: new Proxy({}, {
    get: (_, name) => {
      if (typeof name !== 'string') return undefined;
      if (!entityCache[name]) entityCache[name] = entity(name);
      return entityCache[name];
    },
  }),

  auth: {
    login: (login, password) => request('POST', '/auth/login', { login, password }),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/auth/me'),
    forgotPassword: (login) => request('POST', '/auth/forgot-password', { login }),
    resetPassword: (token, password) => request('POST', '/auth/reset-password', { token, password }),
    changePassword: (current_password, new_password) =>
      request('POST', '/auth/change-password', { current_password, new_password }),
  },

  files: {
    uploadPublic: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('POST', '/files/upload?visibility=public', fd, { isForm: true });
    },
    uploadPrivate: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return request('POST', '/files/upload?visibility=private', fd, { isForm: true });
    },
    signedUrl: (file_uri) => request('POST', '/files/signed-url', { file_uri }),
  },

  functions: {
    invoke: (name, payload = {}) => request('POST', `/functions/${encodeURIComponent(name)}`, payload),
  },

  admin: {
    users: {
      list: (params) => request('GET', `/admin/users${qs(params)}`),
      create: (data) => request('POST', '/admin/users', data),
      update: (id, data) => request('PATCH', `/admin/users/${encodeURIComponent(id)}`, data),
      resetPassword: (id, password) =>
        request('POST', `/admin/users/${encodeURIComponent(id)}/reset-password`, { password }),
    },
    roles: {
      list: () => request('GET', '/admin/roles'),
      create: (data) => request('POST', '/admin/roles', data),
      update: (id, data) => request('PATCH', `/admin/roles/${encodeURIComponent(id)}`, data),
      remove: (id) => request('DELETE', `/admin/roles/${encodeURIComponent(id)}`),
    },
    facilities: {
      list: () => request('GET', '/admin/facilities'),
      create: (data) => request('POST', '/admin/facilities', data),
      update: (id, data) => request('PATCH', `/admin/facilities/${encodeURIComponent(id)}`, data),
    },
    audit: {
      list: (params) => request('GET', `/admin/audit${qs(params)}`),
    },
    messages: {
      list: () => request('GET', '/admin/messages'),
      update: (id, data) => request('PATCH', `/admin/messages/${encodeURIComponent(id)}`, data),
    },
  },

  public: {
    site: () => request('GET', '/public/site'),
    contact: (data) => request('POST', '/public/contact', data),
  },
};

// Password rule shared with the server: 8+ chars, one uppercase, one number, one special character.
export const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_HINT = 'At least 8 characters, including one uppercase letter, one number and one special character.';
