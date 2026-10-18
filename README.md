# SCMS Construction Project Management System

**Company:** Sohanur Construction & Manpower Solution (SCMS)  
**Tagline:** Building Trust, Delivering Quality

Mobile-first construction project, BOQ, subcontractor, measurement, attendance, billing, payment, retention, expenses and reporting platform.

## Architecture
- Frontend: responsive PWA-ready web application.
- Database: Neon PostgreSQL.
- Backend: trusted server-side API; never expose database credentials to the browser.
- Authorization: OWNER_ADMIN, SUPERVISOR and SUBCONTRACTOR with project-level isolation.
- Financial records: decimal monetary columns, approval workflow, snapshots, audit and reversal patterns.

## Current status
Phase 1 foundation. The UI is a frontend prototype and the database migration is a starting schema, not a production-ready release. Authentication, trusted API authorization, fully scoped RLS policies, financial transaction services, automated tests, backup/restore and deployment still require implementation and verification.

## Database
Migration: `database/migrations/001_initial_schema.sql`

Apply migrations only from a trusted environment with a private connection string. Do not place secrets in frontend code or commit a real `.env` file.

## Local frontend
Open `index.html` for the static Phase 1 interface. It uses demonstration-only sample metrics and does not write financial records to a database.

## Required environment variables (server only)
See `.env.example`.

## Security principles
- Main contract rates and owner margin are owner-only data.
- Subcontractor-facing endpoints must use explicit field allow-lists and authorization in the server, not UI hiding.
- Approved financial records must be adjusted/reversed rather than silently overwritten.
- Never claim payments, SMS, WhatsApp, backup or restore are operational until a real provider/workflow is configured and tested.
