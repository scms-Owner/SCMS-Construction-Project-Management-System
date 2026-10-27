-- SCMS package assignment, handover, progress and cash ledger.
-- Additive migration: existing project/work-order/financial tables remain unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS scms.package_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code text NOT NULL UNIQUE,
  package_name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'প্যাকেজ',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES scms.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(package_code)) > 0),
  CHECK (length(trim(package_name)) > 0)
);
CREATE TABLE IF NOT EXISTS scms.project_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES scms.projects(id),
  package_id uuid NOT NULL REFERENCES scms.package_catalog(id),
  total_quantity numeric(18,4) NOT NULL CHECK (total_quantity > 0),
  unit_snapshot text NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES scms.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, package_id)
);
CREATE TABLE IF NOT EXISTS scms.package_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_code text NOT NULL UNIQUE,
  project_package_id uuid NOT NULL REFERENCES scms.project_packages(id),
  subcontractor_id uuid NOT NULL REFERENCES scms.subcontractors(id),
  assigned_quantity numeric(18,4) NOT NULL CHECK (assigned_quantity >= 0),
  rate_snapshot numeric(18,4) NOT NULL CHECK (rate_snapshot >= 0),
  opening_completed_quantity numeric(18,4) NOT NULL DEFAULT 0 CHECK (opening_completed_quantity >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','TRANSFERRED','COMPLETED','CANCELLED')),
  assigned_on date NOT NULL DEFAULT CURRENT_DATE,
  transferred_at timestamptz,
  transferred_to_assignment_id uuid REFERENCES scms.package_assignments(id),
  transfer_note text,
  created_by uuid REFERENCES scms.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (opening_completed_quantity <= assigned_quantity)
);
CREATE TABLE IF NOT EXISTS scms.package_progress_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES scms.package_assignments(id),
  progress_date date NOT NULL,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  notes text,
  created_by uuid REFERENCES scms.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scms.package_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES scms.package_assignments(id),
  payment_code text NOT NULL UNIQUE,
  payment_type text NOT NULL CHECK (payment_type IN ('ADVANCE','WORK_PAYMENT')),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES scms.app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_packages_project ON scms.project_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_package_assignments_package ON scms.package_assignments(project_package_id);
CREATE INDEX IF NOT EXISTS idx_package_assignments_contractor ON scms.package_assignments(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_package_progress_assignment_date ON scms.package_progress_entries(assignment_id, progress_date);
CREATE INDEX IF NOT EXISTS idx_package_payments_assignment_date ON scms.package_payment_transactions(assignment_id, paid_on);
COMMIT;
