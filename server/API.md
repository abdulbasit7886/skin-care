# Health Synapsis API contract

Express API at `/api` (dev: http://localhost:4000, proxied by Vite from :5173).
All JSON. Errors: HTTP 4xx/5xx with body `{ "error": { "code": "STRING", "message": "Human text" } }`.

## Sessions

- Login sets an httpOnly cookie `hs_session` (JWT, 12h). The browser sends it automatically (`credentials: 'include'`).
- Every non-GET request must carry header `X-HS-Client: web` (CSRF guard). Requests without it get 403.
- Super admin only: send header `X-Facility-Id: <facility id>` to choose which facility the clinic pages operate on.
  Other users are always locked to their own facility (header ignored).

## Roles

`super_admin`, `admin`, `doctor`, `reception` (labelled "Front Desk"), `accounts`.

## Password policy

At least 8 characters, with at least one uppercase letter, one number and one special character.
Regex used on both sides: `^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$`

## Auth — `/api/auth`

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/login` | `{ login, password }` (login = username or email) | `{ user: Me }` + cookie |
| POST | `/logout` | – | `{ success: true }` |
| GET | `/me` | – | `Me` or 401 |
| POST | `/forgot-password` | `{ login }` | `{ success: true }` always (emails a link `${APP_URL}/portal/reset-password?token=...`, valid 1h) |
| POST | `/reset-password` | `{ token, password }` | `{ success: true }` |
| POST | `/change-password` | `{ current_password, new_password }` | `{ success: true }` |

`Me`:
```json
{
  "id": "...", "username": "...", "email": "...", "full_name": "...",
  "role": "doctor", "effectiveRole": "doctor",
  "facility_id": "...", "facility_name": "...",
  "doctor_id": "..." , "employee_id": null,
  "permissions": ["/appointments", "/patients"] ,   // null = role defaults apply
  "landingPage": "/appointments",                      // may be null
  "facilities": [{ "id": "...", "name": "..." }]       // super_admin only: every active facility
}
```
`permissions` / `landingPage` come from the linked Doctor or Employee record.

## Entities — `/api/entities/:Entity`

Entity names: `Patient, Doctor, Employee, Appointment, EMR, EMRAddendum, Invoice, Service, Procedure, LabTest, TaxRate, Facility`.

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/:Entity/query` | `{ query?, sort?, limit?, skip?, cursor?, fields? }` | `{ items, total, has_more, next_cursor }` |
| POST | `/:Entity/count` | `{ query? }` | `{ count }` |
| POST | `/:Entity/aggregate` | `{ query?, groupBy, sum: [fields], sort? }` | `{ rows: [{ <groupBy>: v, count, sum_<field>: n, ... }] }` |
| GET | `/:Entity/:id` | – | record (404 if missing/deleted/out of facility) |
| POST | `/:Entity` | data | created record |
| POST | `/:Entity/bulk` | `[data, ...]` | `{ items: [...] }` |
| PATCH | `/:Entity/:id` | partial data | updated record |
| DELETE | `/:Entity/:id` | – | `{ success: true }` (soft delete, audited) |

- `query` uses Mongo-style operators: equality, `$in`, `$nin`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$exists`,
  `$regex` (+ `$options: 'i'`), `$or`, `$and`. Regex support is limited to plain text with optional `^`/`$` anchors
  (translated to contains / startsWith / endsWith / equals).
- `sort`: field name, `-` prefix for descending (e.g. `'-created_date'`).
- `limit` default 50, max 1000. `cursor` is opaque (from `next_cursor`).
- `fields`: array of field names to return (`id` always included).
- Every record has `id, facility_id, created_date, updated_date, created_by`.
- Dates such as `date`, `visit_date`, `effective_date`, `followup_date` are `YYYY-MM-DD` strings. Clinic timezone: Asia/Karachi.
- `Facility` is special: `query` returns only the caller's current facility (one item). Create/delete Facility via `/api/admin/facilities`.

### Server-enforced rules

- Every row is scoped to the caller's facility. Deletes are soft (`deleted_at`) and only `admin` / `super_admin` may delete.
- Every create / update / delete is written to the audit log with before/after values.
- **EMR**
  - Full EMR (clinical fields) is visible only to the doctor who owns it (`EMR.doctor_id === me.doctor_id`).
    Imported chart records (`doctor_id: 'imported'`) are visible in full to every doctor in the facility.
  - Everyone else (super_admin, admin, reception, accounts, other doctors) gets a limited record with only:
    `id, facility_id, appointment_id, patient_id, patient_name, mrn, doctor_id, doctor_name, visit_date, labs_tests,
    prescription, advise, services_offered, procedures_performed, followup_date, created_date, updated_date`.
  - Each EMR has computed `_access: 'full' | 'limited'` and `_can_edit: boolean`.
  - Create: only a `doctor` whose `doctor_id` matches the appointment's doctor. Exception: imported records
    (`doctor_id: 'imported'`) may be bulk-created by anyone with Scan Chart access.
  - Update: only the owning doctor, and only on the same clinic day the EMR was first saved. Afterwards → 403 `EMR_LOCKED`.
  - No one may delete an EMR.
- **EMRAddendum** `{ emr_id, text }` → server fills `doctor_id, doctor_name`. Create only by the EMR's owning doctor,
  any time. Readable only by that doctor. No update/delete.
- **Invoice**
  - Once `printed: true`, only `admin` / `super_admin` may update it. Such an update sets `is_corrected: true`,
    increments `revision`, and is audited. Others get 403 `INVOICE_LOCKED`.
  - Computed `_can_edit: boolean`.
- **Appointment**: `doctor_id` (attending physician) can be changed only while status is `booked` or `checked_in`
  and no EMR exists yet.
- **Doctor / Employee / Facility / TaxRate / Service / Procedure / LabTest** (SetUp): write = `admin` / `super_admin` only.
  `Employee.role = 'admin'` can be set only by `super_admin`.

## Users (logins) — `/api/admin/users` (admin, super_admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/?facility_id=` | – | `{ items: [User] }` (admin: own facility only) |
| POST | `/` | `{ username, email?, full_name, role, password, doctor_id? , employee_id?, facility_id? }` | User |
| PATCH | `/:id` | `{ email?, full_name?, role?, is_active? }` | User |
| POST | `/:id/reset-password` | `{ password }` | `{ success: true }` |

`User` = `{ id, username, email, full_name, role, facility_id, doctor_id, employee_id, is_active, last_login_at, created_date }`.
Admins cannot create, edit or reset `admin` / `super_admin` users. `facility_id` is honoured only for super_admin.
Lookup helper: `GET /api/admin/users?doctor_id=...` or `?employee_id=...` filters to that record's login.

## Custom roles — `/api/admin/roles`

Roles the super admin defines (e.g. Nurse, Lab Technician), available in every facility.
`CustomRole` = `{ id, name, description, base_role: 'reception'|'accounts', permissions: [page keys], landing_page, is_active, employee_count }`.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/` | admin, super_admin | `{ items }`; `employee_count` is per facility for admins, global for super admin |
| POST | `/` | super_admin | name unique (case-insensitive), not a built-in role name; pages ⊆ `/patients, /scheduling, /import-chart, /archived-records, /appointments, /reception, /, /reports` |
| PATCH | `/:id` | super_admin | changing `base_role` moves every employee with the role (and signs their logins out) |
| DELETE | `/:id` | super_admin | 409 `ROLE_IN_USE` while employees have it |

Assigning: `Employee.custom_role_id`. The server copies the role's `base_role` into `Employee.role` (that is the access level
enforced for data) and the employee's login always takes its role from the employee record. `Me` then carries
`role_name` and `custom_role_id`, and `permissions` / `landingPage` come from the role.

## Facilities — `/api/admin/facilities` (super_admin)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/` | – | `{ items: [Facility & { user_count }] }` |
| POST | `/` | Facility fields (`name` required) | Facility |
| PATCH | `/:id` | Facility fields, `is_active` | Facility |

## Audit log — `/api/admin/audit` (super_admin)

`GET /api/admin/audit?facility_id=&entity=&action=&user_id=&from=YYYY-MM-DD&to=YYYY-MM-DD&cursor=&limit=`
→ `{ items: [Audit], has_more, next_cursor }`

`Audit` = `{ id, facility_id, facility_name, entity, record_id, action, user_id, user_name, user_role, summary,
changes: { field: { from, to } } | null, snapshot: object | null, created_date }`.
`action` ∈ `create, update, delete, correct_invoice, print_invoice, login, password_reset, user_create, user_update`.
For `delete`, `snapshot` holds the full deleted record.

## Website messages — `/api/admin/messages` (super_admin, admin)

`GET /` → `{ items: [{ id, name, email, phone, subject, message, is_read, created_date }] }`, `PATCH /:id { is_read }`.

## Files — `/api/files`

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/upload?visibility=public` | multipart `file` | `{ file_url }` (served at `/uploads/...`) |
| POST | `/upload?visibility=private` | multipart `file` | `{ file_uri }` (`private://<id>`) |
| POST | `/signed-url` | `{ file_uri }` | `{ signed_url }` (valid 10 min) |

Max 15 MB; images (JPG/PNG/WebP) and PDF only.

## Functions — `/api/functions/:name`

`POST /api/functions/extractPatientChart` body `{ file_uri }` (a `private://` URI from a private upload).
Runs OCR (Tesseract, on the server, no external service) on the scanned chart. Accepts JPG/PNG/WebP images or a PDF
(each PDF page is rasterised). Every page is normalised to an A4 portrait sheet (2480×3508 px, 300 dpi) before OCR.
Returns:
```json
{
  "extraction": {
    "demographics": { "first_name": "", "last_name": "", "father_husband": "", "age": "", "sex": "",
                      "cnic": "", "mobile": "", "address": "", "profession": "", "referred_by": "", "previous_diagnosis": "" },
    "visits": [{ "date": "YYYY-MM-DD", "presenting_complaint": "", "diagnosis": "", "management_procedure": "" }]
  },
  "text": "full OCR text, pages separated by \\n\\n--- page N ---\\n\\n",
  "confidence": 0-100,
  "pages": 1
}
```
Fields OCR could not find are empty strings; staff must review before saving.
The no-show job runs on the server every 15 minutes (Asia/Karachi); no endpoint needed.

## Public website — `/api/public` (no auth)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/site` | – | `{ facility: { name, address, contact_number, email, website, logo_url } \| null, doctors: [{ id, title, name, specialization, photo_url, bio }], services: [{ id, name }], procedures: [{ id, name }] }` |
| POST | `/contact` | `{ name, email?, phone?, subject?, message }` | `{ success: true }` (rate limited) |
