# Health Synapsis

Clinic website + EMR (electronic medical records) for **Dr Safoora Skin Chemistry**, as one full-stack app:

| Part | URL | Code |
|---|---|---|
| Public website (About, Doctors, Services, Gallery, Testimonials, Contact) | `/` | `src/site/` |
| EMR portal (staff login) | `/portal` | `src/` (pages, components, lib) |
| API (Node.js + Express) | `/api` | `server/src/` |
| Database (PostgreSQL via Prisma) | – | `server/prisma/schema.prisma` |

API reference: [server/API.md](server/API.md).

## Run it locally

Prerequisites: **Node.js 22+** and **Docker Desktop** (for the local PostgreSQL and mail catcher).

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # then edit it: JWT_SECRET, SUPER_ADMIN_PASSWORD, ...
npm run db:up               # PostgreSQL on :5434, Mailpit on :8026
npm run db:migrate          # create the tables
npm run db:seed             # first super admin (+ demo clinic if SEED_DEMO=true)
npm run dev                 # API on :4000 and website/portal on :5173
```

- Website: http://localhost:5173
- EMR portal: http://localhost:5173/portal
- Emails sent in development (password resets, contact form): http://localhost:8026

### Demo logins (development only, `SEED_DEMO=true`)

| User name | Role | Password |
|---|---|---|
| `superadmin` | Super Admin | `SUPER_ADMIN_PASSWORD` from `.env` |
| `clinicadmin` | Admin | `DEMO_PASSWORD` from `.env` |
| `dr.safoora`, `dr.bilal` | Doctor | `DEMO_PASSWORD` |
| `frontdesk` | Front Desk | `DEMO_PASSWORD` |
| `accounts` | Accounts | `DEMO_PASSWORD` |

You can log in with the user name or the email address.

## Roles and rules (enforced by the server)

- **Super Admin** (software owner): onboards facilities, creates each facility's admins, sees every page and the
  **Audit Log** (every create / change / delete in every facility, including deleted records, with who did it).
  Picks the facility to work in from the sidebar.
- **Admin** (facility owner/director): every page except the EMR; registers employees and assigns their pages;
  can correct a printed invoice (it reprints as **Corrected Invoice**); only admins can delete (soft delete — kept for the audit log).
- **Front Desk**: only the Reception module pages the admin assigns (Registration, Scheduling, Scan Chart,
  Archived Records, Daily List, Front Desk). Lands on the Daily List when allowed. Cannot change a printed invoice.
- **Doctor**: charts the EMR only for patients booked with them; can also register, schedule, see archived
  records, the daily list, reports and dashboard (as assigned).
- **Accounts**: billing / reports pages as assigned.
- **Custom roles** (Super Admin → Roles): e.g. Nurse, Lab Technician. Each runs on the Front Desk or Accounts access level
  and opens only the pages ticked for it (never the EMR or administration pages). Admins assign them under SetUp → Employees.
- **EMR privacy**: only the attending doctor sees clinical notes. Everyone else sees only what they need to bill and print
  (prescription, tests advised, services, procedures, follow-up). A patient moves to another doctor only when the
  attending physician is changed on the booking (before the EMR is started).
- **EMR locking**: the doctor can edit a saved EMR only on the same clinic day (Asia/Karachi). After that it is read-only and
  missed information is added as a date/time-stamped **addendum**. No one can delete an EMR.
- **Passwords**: at least 8 characters with one uppercase letter, one number and one special character. "Forgot password"
  emails a one-hour reset link; 5 wrong passwords lock the account for 15 minutes.

## Scan Chart (OCR)

Upload a scanned A4 chart page (JPG/PNG/WebP, or a PDF of up to 8 pages). The server normalises each page to an A4
sheet at 300 dpi and reads it with Tesseract OCR (runs locally — no external service, no per-scan cost), then pre-fills
the patient details and visit rows. OCR is reliable on printed/typed charts and weaker on handwriting, so staff review
every field before saving. A scan takes roughly 10–20 seconds per page.

## Website content

Edit `src/site/content.js` (clinic text, address, phone, WhatsApp, opening hours, social links, gallery captions,
testimonials — placeholders are marked `TODO`). Put gallery photos in `public/site/gallery/`. Doctors and services on
the website come from the EMR (SetUp → Doctors: "Show on website", photo and bio).

## Deploying to your hosting

The host needs Node.js 22+, a PostgreSQL database and an SMTP account. The app runs as one Node process that serves the
API, the website and the portal.

```bash
npm ci
npm run build                   # builds the website + portal into dist/
npm run db:deploy               # apply database migrations
npm run db:seed                 # first run only: creates the super admin from .env
NODE_ENV=production npm start   # listens on PORT (default 4000)
```

Production `.env` checklist (see `.env.example`):

- `NODE_ENV=production`, `APP_URL=https://your-domain`, `DATABASE_URL`, a long random `JWT_SECRET`.
- `SMTP_*` and `MAIL_FROM` for password-reset emails, `CONTACT_TO` for website enquiries.
- `SUPER_ADMIN_USERNAME / EMAIL / PASSWORD` for the first login (change the password after logging in).
- `SEED_DEMO=false`.

Put it behind HTTPS (e.g. Nginx or the host's proxy forwarding to the Node port). Login cookies are `Secure` in production,
so the portal only works over HTTPS. Keep the process running with your host's process manager (pm2, systemd, Passenger…).

**Back up** both the PostgreSQL database and the `server/storage/` folder (uploaded charts, logos, photos).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (auto-restart) + Vite dev server |
| `npm run build` / `npm start` | Production build / run |
| `npm run lint` | ESLint (frontend + server) |
| `npm run db:up` / `db:down` | Start / stop local PostgreSQL + Mailpit (Docker) |
| `npm run db:migrate` | Create a migration after editing `schema.prisma` (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Create the first super admin (+ demo data in development) |
| `npm run db:seed:sample` | Add ~6 weeks of sample patients, visits, EMRs and invoices to the demo clinic |
| `npm run db:studio` | Browse the database in Prisma Studio |
