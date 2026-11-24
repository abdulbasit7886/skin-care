# AGENTS.md

## Project context

Health Synapsis is a full-stack clinic app: a public website (`src/site/`, served at `/`), an EMR portal
(`src/`, served at `/portal` with React Router `basename="/portal"`), and a Node.js/Express API (`server/src/`)
backed by PostgreSQL through Prisma (`server/prisma/schema.prisma`). Treat it as user-owned application code,
keep changes focused on the request, and preserve existing conventions. Start with `README.md`.

## Key files

- `server/API.md` — the API contract. Keep it in sync when endpoints or rules change.
- `server/src/entities/registry.js` — per-entity permissions and business rules (EMR privacy/locking, invoice
  locking, admin-only actions). **Security rules live on the server**; the UI only mirrors them.
- `server/src/entities/service.js` + `query.js` — generic CRUD with facility scoping, soft deletes, audit logging,
  and the Mongo-style query translation the frontend uses.
- `src/api/client.js` — the only way the frontend talks to the API (`api.entities.X.filter/get/create/update/...`).
- `src/lib/roles.js` — page access per role/user (mirrors the server rules for navigation).
- `src/site/content.js` — editable website content.

## Working notes

- Local dev: `npm run db:up` (Docker PostgreSQL on :5434 + Mailpit on :8026), then `npm run dev`
  (API :4000 + Vite :5173, Vite proxies `/api` and `/uploads`).
- After changing `schema.prisma`: `npm run db:migrate -- --name <change>`; never edit applied migrations.
- Every clinic table has `facility_id`, `created_by`, `deleted_at`; never hard-delete clinic records and never
  bypass `service.js` for writes (it writes the audit trail inside the same transaction).
- Calendar dates are `YYYY-MM-DD` strings in the clinic timezone (`CLINIC_TZ`, default Asia/Karachi) — use
  `server/src/time.js` and `src/lib/clinicDate.js`, not `toISOString()`.
- Mutating requests need the `X-HS-Client: web` header (the client adds it).
- Run `npm run lint` and `npm run build` before finishing changes.
