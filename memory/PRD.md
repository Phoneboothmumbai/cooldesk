# CoolDesk — AC Complaint Ticketing Platform

## Original Problem Statement
Build a ticketing platform (inspired by osTicket) for an AC distribution company. Dealers raise complaints on behalf of customers (installation / repair / service). When a ticket is raised, brand-specific stakeholders are auto-added as CC collaborators and emailed the full details. An admin panel defines stakeholder email IDs brand-wise. Example: a Voltas installation complaint auto-notifies the Voltas team.

## Architecture
- **Frontend**: React 19 (CRA/craco), Tailwind, shadcn/ui, phosphor-icons, react-router. JWT stored in localStorage.
- **Backend**: FastAPI, Motor (async MongoDB). All routes under `/api`.
- **DB**: MongoDB — collections: `users`, `brands`, `tickets`, `settings`, `counters`.
- **Email**: Emergent-managed Resend by default; optional BYO Resend (admin-configurable). Anti-phishing gate on every send.

## User Personas
- **Dealer** (no login): uses public form `/` to raise complaints.
- **Agent**: logs in, works tickets (status/priority/assign/reply).
- **Admin**: everything agents can do + manage brands/routing, agents, settings, email provider.

## Core Requirements (static)
- Public dealer complaint form (brand + type + customer/dealer details).
- Brand-prefixed ticket IDs (VOLT-000001).
- Auto-CC brand stakeholders per brand + per complaint type, with "always CC" catch-all and global default fallback.
- Real email notification to collaborators on creation.
- Admin brand-wise email routing panel.
- Ticket lifecycle, threaded replies (+ internal notes), agent assignment, dashboard stats & filters.

## Implemented (2026-06)
- ✅ JWT auth (admin seeded from env), role gating (admin vs agent).
- ✅ Public form + brand dropdown + success screen with copy ticket ID.
- ✅ Ticket creation with atomic per-brand numbering + collaborator resolution + email send.
- ✅ Dashboard (stats, by-type/brand bars, recent), tickets list (search + filters), ticket detail (status/priority/assign/reply/internal notes, collaborator + email status view).
- ✅ Brands & routing CRUD (catch-all + per-type emails).
- ✅ Agents CRUD.
- ✅ Settings: default stakeholders + email provider toggle (Emergent managed OR own Resend key/from) + send test email.
- ✅ Seeded brands: Voltas, LG, Daikin, Blue Star. Tested 100% (23 backend + full frontend e2e).

## Backlog (prioritized)
- P1: File/photo attachments on complaints (customer AC photos, invoices).
- P1: Customer-facing status link / SMS on ticket updates.
- P2: Ticket pagination + CSV export.
- P2: SLA timers & aging alerts.
- P2: Per-brand logo on the public form.

## Test Credentials
See `/app/memory/test_credentials.md`.
