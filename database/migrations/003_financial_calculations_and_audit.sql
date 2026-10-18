-- SCMS financial calculation and audit foundation.
-- The audit log is append-only; audit entries intentionally do not grant application access.
BEGIN;

CREATE OR REPLACE FUNCTION scms.calculate_rate_rule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE source_rate numeric(18,4);
BEGIN
  SELECT main_rate INTO source_rate
  FROM scms.main_boq_items
  WHERE id = NEW.boq_item_id AND project_id = NEW.project_id AND active = true;
  IF source_rate IS NULL THEN
    RAISE EXCEPTION 'BOQ item is missing, inactive, or belongs to another project';
  END IF;

  IF NEW.method = 'PERCENTAGE' THEN
    IF NEW.reduction_percent IS NULL OR NEW.reduction_percent < 0 OR NEW.reduction_percent > 100 THEN
      RAISE EXCEPTION 'Percentage reduction must be between 0 and 100';
    END IF;
    NEW.approved_rate := round(source_rate * (1 - NEW.reduction_percent / 100), 4);
  ELSIF NEW.method = 'FIXED_REDUCTION' THEN
    IF NEW.fixed_reduction IS NULL OR NEW.fixed_reduction < 0 OR NEW.fixed_reduction > source_rate THEN
      RAISE EXCEPTION 'Fixed reduction cannot exceed the main rate';
    END IF;
    NEW.approved_rate := round(source_rate - NEW.fixed_reduction, 4);
  ELSIF NEW.method = 'MANUAL_OVERRIDE' THEN
    IF NEW.manual_rate IS NULL OR NEW.manual_rate < 0 THEN
      RAISE EXCEPTION 'Manual rate must be zero or greater';
    END IF;
    NEW.approved_rate := NEW.manual_rate;
  END IF;
  IF NEW.approved_rate < 0 THEN
    RAISE EXCEPTION 'Approved rate cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_rate_rule ON scms.rate_rules;
CREATE TRIGGER trg_calculate_rate_rule
BEFORE INSERT OR UPDATE OF boq_item_id, project_id, method, reduction_percent, fixed_reduction, manual_rate
ON scms.rate_rules
FOR EACH ROW EXECUTE FUNCTION scms.calculate_rate_rule();

CREATE OR REPLACE FUNCTION scms.calculate_subcontractor_bill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.gross_amount < 0 OR NEW.advance_recovery < 0 OR NEW.retention_amount < 0 OR NEW.other_deductions < 0 THEN
    RAISE EXCEPTION 'Gross amount and deductions cannot be negative';
  END IF;
  NEW.net_payable := round(
    NEW.gross_amount - NEW.advance_recovery - NEW.retention_amount
    - NEW.other_deductions + NEW.adjustment_amount, 2
  );
  IF NEW.net_payable < 0 THEN
    RAISE EXCEPTION 'Net payable cannot be negative; revise recoveries, deductions, or adjustments';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_subcontractor_bill ON scms.subcontractor_bills;
CREATE TRIGGER trg_calculate_subcontractor_bill
BEFORE INSERT OR UPDATE OF gross_amount, advance_recovery, retention_amount, other_deductions, adjustment_amount
ON scms.subcontractor_bills
FOR EACH ROW EXECUTE FUNCTION scms.calculate_subcontractor_bill();

CREATE OR REPLACE FUNCTION scms.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, scms
AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
  row_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
  row_id := COALESCE(new_row->>'id', old_row->>'id',
                     COALESCE(new_row, old_row)::text);
  INSERT INTO scms.audit_logs(action, entity_type, entity_id, old_values, new_values)
  VALUES (TG_OP, TG_TABLE_NAME, row_id, old_row, new_row);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION scms.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log entries are immutable; append a corrective event instead';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON scms.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON scms.audit_logs
FOR EACH ROW EXECUTE FUNCTION scms.prevent_audit_log_mutation();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'projects','user_project_assignments','main_contracts','main_boq_items','subcontractors',
    'rate_rules','work_orders','work_order_items','measurements','subcontractor_bills',
    'subcontractor_bill_items','advances','advance_recoveries','payments','retention_ledger',
    'attendance_sheets','attendance_entries','khoraki_claims','client_bills','client_receipts',
    'expenses','attachments','notifications','app_users','app_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON scms.%I', 'trg_audit_' || t, t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON scms.%I FOR EACH ROW EXECUTE FUNCTION scms.audit_row_change()', 'trg_audit_' || t, t);
  END LOOP;
END $$;

COMMIT;
