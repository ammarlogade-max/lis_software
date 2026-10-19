# Pathology LIS Platform — Setup & Deployment Guide

This README covers everything: database, backend, desktop frontend, packaging
for Windows/Mac/Linux PCs, and a path to mobile. Read the "Where this project
actually stands" section first — it's the most important part.

---

## 0. Where this project actually stands (read this first)

This delivery covers **Phases 1–4** from `docs/SRS_v1.0.md` (Foundation;
Patient/Billing/Masters; Dynamic Reports/PDF; a first cut of LIS/Analyzer
Integration), plus several items pulled forward from Phase 5 and general
hardening:

- FastAPI backend: JWT auth/RBAC with rate-limited login and refresh
  tokens, audit logging, Patients, Doctors, Collection Centres, Test
  Groups/Parameters (with the formula engine), Packages, Methods, Orders
  with real billing math, sample/barcode scan-in tracking, printable
  barcode labels, report branding (including logo/QR upload), PDF report
  generation, an ASTM E1381/E1394 analyzer integration layer, Inventory &
  Consumables, and Multi-Branch support (orders/users/inventory can each
  be scoped to a branch, sharing one backend and database).
- pytest suite covering all of the above, plus — importantly — **actually
  executed** (not just syntax-checked) tests of the ASTM frame parsing,
  the login rate limiter, and the refresh-token hashing logic, since those
  three have no external dependencies and could be run live in the sandbox
  this was built in. That process caught and fixed a real off-by-one bug
  in the ASTM checksum indexing, and a real bug where a renamed function
  was still being called under its old name in the report settings router.
- Electron + React desktop app covering the full daily loop (register →
  bill → collect sample → analyzer or manual result → report), with
  role-based screen visibility, plus Analyzers and Inventory management
  screens.

**What this is not yet:** a complete, production-hardened system safe to
sell to 1,000+ labs. Specifically still missing before you should trust
this with real patient data in production:

- Real hardware validation of the analyzer integration (see Section 8) —
  nothing here replaces actually testing against your HORIBA
- HL7/TCP/USB-CSV analyzer paths (only serial ASTM exists)
- HTTPS termination in front of the backend
- Patient/doctor portals, mobile apps, AI features
- Security review, penetration testing, and load testing
- Any regulatory/compliance review required in your jurisdiction for
  software that stores patient health data

I was not able to `pip install` or `npm install` in the sandbox this was
built in (no network access there), so **you must run the test suite
yourself as your first step** — don't assume it's proven correct until you
see it pass on your machine.

Treat this as a strong, real foundation to build the next milestones on —
not a finished product.

---

## 1. Prerequisites

Install these on your development machine:

- **Node.js 20+** and **npm** (or pnpm) — https://nodejs.org
- **Python 3.12+** — https://python.org
- **PostgreSQL 16** (production) — https://postgresql.org — or use the
  bundled `docker-compose.yml`. SQLite works with zero setup for local dev.
- **Git**
- (Optional) **Docker + Docker Compose** to run Postgres without installing
  it natively.

---

## 2. Database setup

### Option A — SQLite (fastest way to try it out)
Nothing to install. The backend defaults to a local `pathology_lis.db` file
when `DATABASE_URL` is left as the `.env.example` default. Good for your
first run and for automated tests — not for production or multi-user use.

### Option B — PostgreSQL via Docker (recommended for anything beyond a quick look)
```bash
cd docker
docker compose up -d db
```
This starts Postgres on `localhost:5432` with:
- user: `lis_user`
- password: `lis_password`
- database: `pathology_lis`

### Option C — PostgreSQL installed natively
Create a database and user yourself, then point `DATABASE_URL` at it (see
step 3).

---

## 3. Backend setup (FastAPI)

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env:
#  - DATABASE_URL -> point at Postgres (Option B/C) or leave as SQLite (Option A)
#  - SECRET_KEY   -> generate a real one: `openssl rand -hex 32`
```

**Run the test suite first** — this is how you confirm the code actually
works on your machine before trusting it:
```bash
pytest
```
All tests should pass. If something fails, stop and fix it before building
on top — don't proceed with a system that touches patient data on a red
test suite.

**Create the first admin user:**
```bash
python seed.py
```
This prints a default admin login (`admin` / `ChangeMe123!`). **Log in and
change that password immediately** — don't leave the default in place past
your first login.

**Run the backend:**
```bash
.venv\Scripts\activate
```
Visit `http://localhost:8000/api/health` — you should see `{"status":"ok"}`.
Interactive API docs are auto-generated at `http://localhost:8000/docs`.

**Migrations:** the app auto-creates tables on startup for convenience in
development (`Base.metadata.create_all`). For any real deployment, switch to
Alembic instead so schema changes are tracked and reversible:
```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## 4. Frontend setup (Electron + React desktop app)

```bash
cd apps/desktop
npm install
cp .env.example .env   # VITE_API_URL should point at your backend, e.g. http://localhost:8000
npm run dev
```
This starts the Vite dev server on `http://localhost:5173`. Open it in a
browser to develop the UI quickly, or run it inside Electron:
```bash
npm run electron:dev
```
Log in with the admin account you created with `seed.py`.

---

## 5. Packaging the desktop app for a lab's PC

The desktop app is Electron-based, so it packages to native installers for
Windows, macOS, and Linux from the same codebase.

1. Add an Electron packager (not yet wired up — this project currently only
   compiles the Electron TypeScript, it doesn't bundle an installer):
   ```bash
   npm install --save-dev electron-builder
   ```
2. Add a `build` config block to `apps/desktop/package.json` (electron-builder
   docs: https://www.electron.build) specifying `appId`, `productName`, and
   target platforms (`nsis` for Windows, `dmg` for macOS, `AppImage`/`deb`
   for Linux).
3. Build the web assets and package:
   ```bash
   npm run build
   npx electron-builder --win --mac --linux
   ```
4. The installer will need the backend URL baked in via `VITE_API_URL` at
   build time, or made configurable in a Settings screen — for a real
   multi-lab rollout, each lab's installer (or its settings) should point at
   that lab's own backend/database, since this is designed as
   single-tenant-per-lab, not a shared multi-lab cloud service.

**Where should the backend run for a real lab?** Options, roughly in order
of how much you'd want for a paying customer base:
- On a small server/PC within the lab's own network (closest to how Patho
  One works today — one backend + Postgres per lab).
- On a cloud VM per lab (more maintenance for you, easier updates).
- A genuine multi-tenant cloud backend — this needs real design work (tenant
  isolation, per-lab data separation, billing) that isn't part of this
  delivery yet.

---

## 6. Mobile (future phase)

The SRS lists mobile apps as Phase 6. Nothing mobile exists yet in this
codebase. When you get there, two realistic paths:
- **React Native** — reuse the API client patterns from
  `apps/desktop/src/lib/api.ts` and the FastAPI backend as-is; build a
  separate `apps/mobile` package in this same monorepo.
- **Capacitor** — wrap a mobile-optimized version of the existing React UI;
  faster to start, less native feel.
Either way, the backend in `apps/backend` doesn't need to change to support
a mobile client — it's already a plain REST API.

---

## 7. Project layout

```
pathology-lis-platform/
├── apps/
│   ├── backend/          FastAPI + SQLAlchemy + Postgres/SQLite
│   │   ├── app/
│   │   │   ├── models/       SQLAlchemy tables
│   │   │   ├── schemas/      Pydantic request/response shapes
│   │   │   ├── routers/      API endpoints
│   │   │   └── core/         security, audit log, formula engine
│   │   ├── alembic/          migration scaffold
│   │   ├── tests/            pytest suite — run this first
│   │   └── seed.py           creates the first admin user
│   └── desktop/          Electron + React + Vite + Tailwind
├── docker/
│   └── docker-compose.yml    Postgres (+ backend, optional)
├── docs/
│   ├── PROJECT_VISION.md
│   └── SRS_v1.0.md
└── SETUP_README.md       (this file)
```

---

## 8. Analyzer integration (Phase 4) — how to run it, and its real status

`analyzer_listener.py` is a **separate, long-running process** — it does not
run inside `uvicorn`/the API. On the PC physically wired to the analyzer
(COM1/COM2, per the photos of your HORIBA's rear panel):

```bash
cd apps/backend
source .venv/bin/activate
python analyzer_listener.py
```

Before that will do anything useful:
1. Log into the desktop app as admin, go to **Analyzers**, add the
   instrument (name, serial port, baud rate).
2. Register test groups/parameters in **Test Master** as usual.
3. Add **test-code mappings** on the Analyzers screen — the analyzer's own
   short code for each result (e.g. `WBC`, `HGB`) mapped to your
   parameter. You'll only know these exact codes once you capture real
   traffic from the instrument (see below).
4. When you create a visit, its `specimen_id` defaults to the generated
   Lab ID — that's what needs to be on the sample barcode/entered at the
   analyzer as the sample ID, so a result can be matched back to the order.

**Honest status of this piece, specifically:**
- The link-layer framing (`app/core/astm_link.py` — ENQ/ACK/NAK handshake,
  STX/ETX/ETB frame boundaries, checksum validation) is implemented per the
  published ASTM E1381 standard and has been **actually executed and
  verified** in this sandbox (not just syntax-checked) — including catching
  and fixing a real off-by-one indexing bug during that testing, and a test
  that feeds bytes one at a time to simulate real serial arrival.
- The record-content layer (`app/core/astm_records.py` — how an `R` record's
  fields map to test code/value/units/range) is written per the general
  E1394 spec, but **individual instruments diverge from the spec in their
  field layouts often enough that this should be treated as a starting
  point, not a finished driver.** Capture a raw serial log from your actual
  ES60 (log the raw bytes read from the COM port to a file) and check it
  against the field-index comments in that file before trusting parsed
  values on real patient samples.
- None of this has been run against real hardware — I have no way to do
  that in this environment. Test it on a bench with sample/QC runs before
  using it on real patient specimens.

---

## 9. Known gaps / honest next milestones

In rough priority order for getting to something you could pilot in one
real lab:

1. **Validate the analyzer integration against real hardware** — capture a
   raw serial log from the HORIBA, compare against `astm_records.py`, and
   run bench/QC samples through the full pipeline before trusting it on
   patient specimens.
2. **HTTPS** — refresh tokens now exist (see below), but there's still no
   TLS termination; put this behind HTTPS before exposing it beyond a
   lab's local network.
3. **Multiple analyzers/protocols** — HL7, TCP/IP, and USB/CSV import paths
   from the SRS aren't built; only serial ASTM is.
4. **Portals, mobile, AI features** — the remaining SRS Phase 5+ items not
   yet started.

Already done since the last status update: **role-based UI hiding**,
**login rate-limiting** (actually executed and verified — see
docs/STATUS_AND_TESTING.md), **Inventory & Consumables**, **database
backup scripts** (Postgres + SQLite, Linux/Mac + Windows), **report
logo/QR code image upload**, **refresh tokens**, **sample/barcode
tracking**, and **Multi-Branch support** — a `Branch` model plus optional
`branch_id` scoping on Orders, Users, and Inventory items. A user tied to
one branch (via their own `branch_id`) sees only that branch's orders and
branch-specific inventory by default; a branch-less user (typically an
admin) sees everything and can filter with `?branch_id=` on the relevant
endpoints. This is genuinely useful for a lab chain, but hasn't been
exercised with real multi-branch data volumes or a branch-switching UI
convenience (right now switching branches means picking a different value
in a dropdown per screen, not a persistent "current branch" selector).


Each of these deserves its own milestone with the same discipline you set
up originally (requirements → schema → API → UI → tests → docs → commit)
rather than being rushed.
