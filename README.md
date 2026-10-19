# Pathology LIS Platform

Enterprise-grade desktop-first Pathology Laboratory Information System (PLIS/LIS).

## Vision
Build a modern, configurable laboratory platform with offline-first support, analyzer integration, dynamic report designer, formula engine, and future cloud synchronization.

## Technology Stack
- Electron
- React + TypeScript + Vite
- FastAPI
- PostgreSQL (Production)
- SQLite (Development)
- Tailwind CSS
- shadcn/ui

## Planned Repository Structure
- apps/
- packages/
- docs/
- scripts/
- docker/
- .github/

## Development Phases
- Phase 0: Planning ✅
- Phase 1: Foundation ✅ (auth/RBAC, Electron/React desktop shell, audit log)
- Phase 2: Patient, Billing & Masters ✅ (Doctor/Collection Centre/Method/
  Package/Test masters, formula engine, New Visit + billing screen)
- Phase 3: Dynamic Reports / PDF Engine ✅ (report header/footer branding
  settings, results entry screen, PDF report generation with abnormal-value
  flagging — see SETUP_README.md)
- Phase 4: LIS & Analyzer Integration ⚠️ first cut done (ASTM E1381/E1394
  over serial, analyzer/test-code mapping UI, sample/barcode scan-in
  tracking, Code128 barcode label printing — link-layer logic actually
  tested, but NOT yet validated against real hardware — see
  SETUP_README.md section 8)
- Phase 5: Inventory ✅, Multi-branch ✅ (branches share one backend/DB;
  orders, users, and inventory can each be scoped to a branch) — Portals,
  Mobile, Cloud, AI still not started
- Hardening: role-based UI hiding ✅, login rate-limiting ✅ (actually
  executed and verified, see docs/STATUS_AND_TESTING.md), DB backup
  scripts ✅ (scripts/backup_db.sh + .ps1), report logo/QR image upload ✅,
  refresh tokens ✅ (30-min access tokens + 14-day refresh tokens, hashed
  at rest) — HTTPS/deployment hardening still open

This repository is being developed incrementally, milestone by milestone.
**See `SETUP_README.md` for full setup instructions and an honest account of
what is and isn't production-ready yet.**