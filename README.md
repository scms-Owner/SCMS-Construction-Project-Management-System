# SCMS Construction Project Management System

**Company:** Sohanur Construction & Manpower Solution (SCMS)  
**Tagline:** Building Trust, Delivering Quality

Mobile-first construction project, BOQ, subcontractor, measurement, attendance, billing, payment, retention, expenses and reporting platform.

## Architecture
- Frontend: responsive web application / PWA target.
- Database: dedicated Neon PostgreSQL project, database `scms_construction`.
- Authentication: Neon Managed Auth (Better Auth) provisioned on the main branch.
- Data API: provisioned for the `scms` schema, but direct table grants are revoked and RLS remains fail-closed until reviewed role policies and application endpoints are implemented.
- Backend: must use a trusted server-side API; never expose database credentials to browser code.
- Roles: OWNER_ADMIN, SUPERVISOR and SUBCONTRACTOR with project-level isolation.
- Financial records: decimal monetary columns, rate snapshots, approval workflow, audit and reversal patterns.

## Current implementation status
The current `index.html`, `styles.css`, and `app.js` remain a **UI preview**, not a production-ready application. Demo dashboard figures are not live records. Authentication UI, trusted API authorization, full CRUD workflows, role-specific views, report exports, tested backup/restore, and production deployment still need to be completed and verified. Do not use the preview to record real financial transactions.

## Database migrations
Apply these in order to a fresh SCMS database using a trusted migration environment:
1. `database/migrations/001_initial_schema.sql` — baseline 27-table schema and initial RLS.
2. `database/migrations/002_seed_river_ctg_payment_schedule.sql` — imports the user's RIVER CTG schedule as main-contract lump-sum schedule lines.
3. `database/migrations/003_financial_calculations_and_audit.sql` — rate calculation, bill net-payable calculation, and append-only audit triggers.
4. `database/migrations/004_fail_closed_access_control.sql` — enables RLS on all sensitive tables and revokes direct client grants until explicit policies are reviewed.

The current Neon database has these migrations' changes applied and the RIVER CTG schedule imported. The numeric total is BDT 3,259,141; the source file's amount-in-words says BDT 3,752,000. This discrepancy is noted on the project and must be confirmed before official billing.

## Security principles
- Main contract rates, reduction rules, gross spread, and owner profit are OWNER_ADMIN-only.
- Subcontractor-facing endpoints must use explicit field allow-lists and authorization in the server, not UI hiding.
- Approved work orders retain immutable rate snapshots; revised rates require a new revision.
- Approved financial records must be adjusted/reversed rather than silently overwritten.
- Direct client database access is intentionally denied until role policies are fully implemented and tested.
- Never claim payments, SMS, WhatsApp, backup, or restore are operational until a real provider/workflow is configured and tested.
- Never commit a real `.env` file or expose connection strings to browser code.

## Local frontend preview
Open `index.html` for the static Phase 1 interface. It uses demonstration-only sample metrics and does not write financial records to the database.

## Server environment
See `.env.example`. Keep all secrets server-side.


## Secure login and server-side database connection (initial integration)

The repository now includes Vercel Node API routes:
- `/api/auth/*` proxies only sign-in, sign-up, sign-out and get-session to Neon Managed Auth using same-origin cookies.
- `/api/me` verifies the Neon Auth session server-side and resolves the SCMS role from `scms.app_users`.
- `/api/health` checks the server-side Neon database connection without returning credentials or database details.
- The browser does not receive `DATABASE_URL`. New accounts cannot select their own SCMS role. The configured owner email can be bootstrapped as `OWNER_ADMIN`; other users must be assigned a role by an authorized administrator.

### Required Vercel environment variables

In Vercel, open the `scmssubproject` project -> Settings -> Environment Variables. Add these values for **Production** (and Preview only if needed), then redeploy:

- `DATABASE_URL`: Neon pooled connection string for the `scms_construction` database on the `main` branch. Copy it from Neon; do not put it in GitHub or send it in chat.
- `NEON_AUTH_BASE_URL`: `https://ep-lucky-hill-a1ygsl60.neonauth.ap-southeast-1.aws.neon.tech/scms_construction/auth`
- `SCMS_OWNER_EMAIL`: the exact email address the company owner will use to register/sign in. This address is not set in source code.
- `APP_BASE_URL`: `https://scmssubproject.vercel.app`

After deployment, test `/api/health` (expected JSON has `ok: true`, `database: true`, `auth: true`) and test sign-up/sign-in with the owner email. If the owner already exists in `scms.app_users`, do not duplicate the account; check the `auth_subject` mapping before first login.

**Scope limitation:** This is the first secure login/database connectivity layer, not completion of all SCMS workflows. Project CRUD, BOQ, measurement approvals, billing, attendance, payments, role-specific data APIs, backup/restore and end-to-end security tests remain incomplete. Keep RLS and direct client grants fail-closed; do not expose the Neon Data API directly to the browser.


## Owner-only implementation milestone (2026-10-19)

- The app is intended for one SCMS Owner; subcontractors do not receive accounts.
- Public sign-up is not available. First-time account creation is restricted server-side to the exact `SCMS_OWNER_EMAIL` environment variable.
- `/api/me`, `/api/projects`, and `/api/subcontractors` verify the authenticated session and require the `OWNER_ADMIN` role server-side.
- The Projects page reads/writes project records in Neon and creates the linked main-contract record. The Subcontractors page manages the private office directory; subcontractors do not get logins.
- The BOQ page reads/writes main-company items, quantities, and main rates per project. Audit log entries are written for project, BOQ item, and subcontractor creation.
- Work orders can be generated from the project's main BOQ and a subcontract sale value. The average reduction percentage is calculated proportionally; each item rate is snapshotted in the work order. The print/PDF view exposes subcontract rates only and omits main rates and internal margin.
- Dashboard metrics are based on API data; fabricated demo project rows and financial figures were removed.
- Daily progress approval, measured quantity workflow, payment caps, main-company receivables, expense ledger, and profit/loss remain planned modules and must not be treated as live until their APIs and database workflows are implemented and tested.
- The Vercel project is connected to this GitHub repository. Each commit triggered a production deployment marked READY, but the deployment could not be independently fetched from this tool session because Vercel denied the current connection access to the protected deployment.
