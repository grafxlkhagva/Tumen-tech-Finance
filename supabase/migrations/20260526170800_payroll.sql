-- =============================================================================
-- 009 — Employees + Salary Records (Цалин)
-- =============================================================================
-- Mongolian payroll: ЭМНДШ 11.5%, ХХОАТ 10% (хагшаалтай), нэмэгдэл, шан
-- =============================================================================

CREATE TYPE salary_status AS ENUM (
  'draft',     -- Тооцоологдсон, batched биш
  'approved',  -- Хянагдсан, journal үүсэх бэлэн
  'posted',    -- Journal үүсгэгдсэн
  'paid',      -- Банкны бичилт хийгдсэн
  'cancelled'
);

CREATE TABLE employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  partner_id      uuid REFERENCES partners(id),   -- холбоотой partner record
  user_id         uuid REFERENCES auth.users(id), -- хэрэв систем хэрэглэгч бол
  -- Хувийн мэдээлэл
  first_name      text NOT NULL,
  last_name       text,
  full_name       text GENERATED ALWAYS AS (
                    COALESCE(last_name || ' ', '') || first_name
                  ) STORED,
  tin             text,                           -- регистрийн дугаар
  phone           text,
  email           citext,
  -- Ажлын мэдээлэл
  employee_code   text,
  title           text,                           -- ажлын байр
  department      text,
  hire_date       date,
  termination_date date,
  is_active       boolean NOT NULL DEFAULT true,
  -- Цалин (default)
  base_salary     numeric(18,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  advance_base    numeric(18,2) NOT NULL DEFAULT 0,   -- авлаганы суурь
  phone_allowance numeric(18,2) NOT NULL DEFAULT 0,
  experience_years int NOT NULL DEFAULT 0,
  -- Банкны мэдээлэл (цалин олгох)
  bank_name       text,
  bank_account    text,
  -- Бусад
  color           text,                           -- UI-д ялгахад
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, tin),
  UNIQUE (company_id, employee_code)
);

CREATE INDEX ix_employees_company_active ON employees (company_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX ix_employees_partner        ON employees (partner_id) WHERE partner_id IS NOT NULL;

CREATE TRIGGER tr_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_employees_audit
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Salary Records (сарын цалингийн дэлгэрэнгүй)
-- ---------------------------------------------------------------------------
CREATE TABLE salary_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  employee_id     uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  period_id       uuid NOT NULL REFERENCES periods(id),
  year            int  NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month           int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  -- Орлогын тал
  base_salary     numeric(18,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  worked_hours    numeric(10,2) NOT NULL DEFAULT 0,
  total_hours     numeric(10,2) NOT NULL DEFAULT 0,
  phone_allowance numeric(18,2) NOT NULL DEFAULT 0,
  sales_bonus     numeric(18,2) NOT NULL DEFAULT 0,
  leave_pay       numeric(18,2) NOT NULL DEFAULT 0,
  bod_salary      numeric(18,2) NOT NULL DEFAULT 0,    -- удирдлагын урамшуулал
  other_income    numeric(18,2) NOT NULL DEFAULT 0,
  total_income    numeric(18,2) NOT NULL DEFAULT 0,
  -- Хорогдуулга
  emndsh          numeric(18,2) NOT NULL DEFAULT 0,    -- ЭМНДШ (11.5%)
  hhoat_deduction numeric(18,2) NOT NULL DEFAULT 0,    -- ХХОАТ-аас хасах
  hhoat           numeric(18,2) NOT NULL DEFAULT 0,    -- ХХОАТ (10%)
  advance         numeric(18,2) NOT NULL DEFAULT 0,    -- авлага
  other_deduction numeric(18,2) NOT NULL DEFAULT 0,
  -- Цэвэр цалин
  net_pay         numeric(18,2) NOT NULL DEFAULT 0,
  -- Workflow
  status          salary_status NOT NULL DEFAULT 'draft',
  journal_id      uuid REFERENCES journals(id),
  paid_at         timestamptz,
  cash_txn_id     uuid REFERENCES cash_transactions(id),
  -- Нэмэлт
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  UNIQUE (employee_id, year, month)
);

CREATE INDEX ix_salary_company_period   ON salary_records (company_id, year DESC, month DESC);
CREATE INDEX ix_salary_employee         ON salary_records (employee_id, year DESC, month DESC);
CREATE INDEX ix_salary_status           ON salary_records (company_id, status);

COMMENT ON TABLE salary_records IS
  'Сарын цалингийн дэлгэрэнгүй. status workflow: draft → approved → posted → paid.';
COMMENT ON COLUMN salary_records.emndsh IS
  'Эрүүл мэндийн даатгал + Нийгмийн даатгалын шимтгэл (11.5% MN 2026).';
COMMENT ON COLUMN salary_records.hhoat IS
  'Хувь хүний орлогын албан татвар (10%). hhoat_deduction-ыг хасч тооцоолно.';

CREATE TRIGGER tr_salary_updated_at
  BEFORE UPDATE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_salary_audit
  AFTER INSERT OR UPDATE OR DELETE ON salary_records
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
