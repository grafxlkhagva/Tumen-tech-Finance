-- =============================================================================
-- 010 — Fixed Assets + Depreciation Schedule
-- =============================================================================
-- Straight-line depreciation (шугаман арга): сар бүр (purchase - salvage) / life
-- =============================================================================

CREATE TYPE asset_status AS ENUM (
  'active',         -- ашиглаж байгаа
  'inactive',       -- түр зогссон (depreciation тооцоологдохгүй)
  'disposed',       -- зарагдсан
  'written_off'     -- хорогдуулсан
);

CREATE TYPE depreciation_method AS ENUM (
  'straight_line',  -- шугаман
  'declining',      -- буурах баланс
  'units'           -- ашиглалтын нэгжтэй
);

CREATE TABLE fixed_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  -- Тодорхойлогч
  code            text,                           -- ҮХ-001
  name            text NOT NULL,
  category        text,                           -- 'IT тоног төхөөрөмж', 'Барилга', ...
  serial_number   text,
  -- Худалдан авалт
  purchase_date   date NOT NULL,
  purchase_amount numeric(18,2) NOT NULL CHECK (purchase_amount > 0),
  supplier_id     uuid REFERENCES partners(id),
  supplier_invoice text,
  -- Депресc
  depreciation_method depreciation_method NOT NULL DEFAULT 'straight_line',
  useful_life_months int NOT NULL CHECK (useful_life_months > 0), -- ашиглалтын хугацаа сараар
  salvage_value   numeric(18,2) NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  accumulated_depreciation numeric(18,2) NOT NULL DEFAULT 0 CHECK (accumulated_depreciation >= 0),
  -- Бэлэн утга (computed for convenience)
  net_book_value  numeric(18,2) GENERATED ALWAYS AS
                    (purchase_amount - accumulated_depreciation) STORED,
  monthly_depreciation numeric(18,2) GENERATED ALWAYS AS
                    ((purchase_amount - salvage_value) / GREATEST(useful_life_months, 1)) STORED,
  -- GL accounts (баримтын журналд)
  asset_account_id      uuid NOT NULL REFERENCES accounts(id), -- үндсэн хөрөнгийн данс
  depreciation_account_id uuid REFERENCES accounts(id),        -- хуримтлагдсан элэгдлийн данс
  expense_account_id    uuid REFERENCES accounts(id),          -- элэгдлийн зардлын данс
  -- Disposal
  disposed_at     date,
  disposal_amount numeric(18,2),
  disposal_journal_id uuid REFERENCES journals(id),
  -- Бусад
  location        text,
  responsible_person text,
  status          asset_status NOT NULL DEFAULT 'active',
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, code),
  CONSTRAINT chk_accumulated_le_purchase
    CHECK (accumulated_depreciation <= purchase_amount),
  CONSTRAINT chk_salvage_lt_purchase
    CHECK (salvage_value < purchase_amount)
);

CREATE INDEX ix_assets_company_status ON fixed_assets (company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_assets_category       ON fixed_assets (company_id, category) WHERE deleted_at IS NULL;
CREATE INDEX ix_assets_purchase_date  ON fixed_assets (company_id, purchase_date);

CREATE TRIGGER tr_assets_updated_at
  BEFORE UPDATE ON fixed_assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_assets_audit
  AFTER INSERT OR UPDATE OR DELETE ON fixed_assets
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Depreciation Schedule (сар бүрийн элэгдлийн бичлэг)
-- ---------------------------------------------------------------------------
CREATE TABLE depreciation_schedule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  asset_id        uuid NOT NULL REFERENCES fixed_assets(id) ON DELETE RESTRICT,
  period_id       uuid NOT NULL REFERENCES periods(id),
  year            int  NOT NULL,
  month           int  NOT NULL,
  depreciation_amount numeric(18,2) NOT NULL CHECK (depreciation_amount >= 0),
  accumulated_before  numeric(18,2) NOT NULL,
  accumulated_after   numeric(18,2) NOT NULL,
  net_book_value_after numeric(18,2) NOT NULL,
  journal_id      uuid REFERENCES journals(id),
  posted_at       timestamptz,
  posted_by       uuid REFERENCES auth.users(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, year, month)
);

CREATE INDEX ix_depschedule_period   ON depreciation_schedule (period_id);
CREATE INDEX ix_depschedule_company  ON depreciation_schedule (company_id, year DESC, month DESC);

COMMENT ON TABLE depreciation_schedule IS
  'Сар бүрийн элэгдлийн тооцоо. calculate_depreciation() функцээр үүснэ.';

CREATE TRIGGER tr_depschedule_audit
  AFTER INSERT OR UPDATE OR DELETE ON depreciation_schedule
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
