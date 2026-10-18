-- Close every SCMS table to direct Data API access until explicit, reviewed role policies exist.
-- This is intentionally fail-closed; trusted server-side API access is required.
BEGIN;
ALTER TABLE scms.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE scms.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scms.backup_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA scms FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA scms FROM anonymous;
REVOKE ALL ON ALL TABLES IN SCHEMA scms FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA scms FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA scms FROM anonymous;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA scms FROM authenticated;

COMMENT ON SCHEMA scms IS 'SCMS financial and project data. Direct client access is denied until reviewed policies are added.';
COMMENT ON TABLE scms.main_contracts IS 'OWNER_ADMIN only. Never expose main contract rates or owner margin in subcontractor responses.';
COMMENT ON TABLE scms.main_boq_items IS 'OWNER_ADMIN only. Subcontractor-facing APIs must use approved rate snapshots, never this table.';
COMMENT ON TABLE scms.rate_rules IS 'OWNER_ADMIN only. Contains reductions and approved subcontractor rates; never return main-rate or reduction fields to subcontractors.';
COMMENT ON TABLE scms.audit_logs IS 'Append-only audit trail. Read access is restricted to OWNER_ADMIN through a trusted API.';
COMMIT;
