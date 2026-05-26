-- =============================================================================
-- 007 — VAT records (Mongolian eBarimt + НӨАТ-ын тооцоо)
-- =============================================================================
-- ДДТД (Дугаар Дугаар Төгрөг Дугаар) — eBarimt receipt ID
-- Tax types: zero (0%), reduced (товлогдсон), exempt (чөлөөлөгдсөн), standard (10%)
-- =============================================================================

CREATE TYPE vat_direction AS ENUM (
  'inbound',    -- Орох НӨАТ (зардлын талд - сууцгуулах) — supplier-аас
  'outbound'    -- Гарах НӨАТ (борлуулалт - цуглуулсан) — customer-руу
);

CREATE TYPE vat_tax_type AS ENUM (
  'standard',   -- 10%
  'zero',       -- 0% (экспорт)
  'reduced',    -- 1% (зарим тус анги)
  'exempt'      -- чөлөөлөгдсөн
);

CREATE TYPE vat_source AS ENUM (
  'ebarimt',    -- eBarimt системээс
  'manual',     -- гараар оруулсан
  'import',     -- import script-ээс
  'invoice'     -- Receivable/Payable-аас үүсгэсэн
);

CREATE TYPE vat_status AS ENUM (
  'pending',        -- хараахан process хийгээгүй
  'matched',        -- партнер & journal-тай холбогдсон
  'reconciled',     -- cash-тэй reconcile хийгдсэн
  'declared',       -- НӨАТ-ын тайланд орсон
  'cancelled'       -- буцаасан/цуцалсан
);

CREATE TABLE vat_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  -- Чухал тодорхойлогч
  direction       vat_direction NOT NULL,
  tax_type        vat_tax_type NOT NULL DEFAULT 'standard',
  date            date NOT NULL,
  -- eBarimt-ийн дугаар
  ddtd            text,                           -- ДДТД (eBarimt ID)
  parent_ddtd     text,                           -- буцаалт болон зөв sub-receipt-ын эх
  invoice_no      text,                           -- худалдаа авах нэхэмжлэхийн дугаар
  -- Counterparty (хэн санам)
  partner_id      uuid REFERENCES partners(id),
  partner_name    text,                           -- raw text from source
  partner_register text,                          -- УБДУС регистр (raw)
  -- Дүн (МНТ)
  amount          numeric(18,2) NOT NULL CHECK (amount >= 0),       -- НӨАТгүй дүн
  vat_amount      numeric(18,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount    numeric(18,2) NOT NULL CHECK (total_amount >= 0),  -- НӨАТтай
  -- Payment / reconciliation tracking
  paid_amount     numeric(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining       numeric(18,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  -- Workflow status
  status          vat_status NOT NULL DEFAULT 'pending',
  source          vat_source NOT NULL DEFAULT 'manual',
  ebarimt_status  text,                           -- raw eBarimt status code
  -- Линкүүд
  journal_id      uuid REFERENCES journals(id),   -- үүссэн journal
  receivable_id   uuid,                           -- forward ref (см receivables table)
  payable_id      uuid,                           -- forward ref
  -- Татварын тайлангийн period
  reported_period_id uuid REFERENCES periods(id), -- ямар сард declare хийсэн
  -- Нэмэлт
  description     text,
  raw_data        jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  -- Constraints
  CONSTRAINT chk_total_eq_amount_plus_vat
    CHECK (total_amount = amount + vat_amount),
  CONSTRAINT chk_paid_le_total
    CHECK (paid_amount <= total_amount),
  -- Davhardlaas хамгаалах: ижил ДДТД хоёр удаа орохгүй
  UNIQUE (company_id, direction, ddtd) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX ix_vat_company_date      ON vat_records (company_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_vat_direction         ON vat_records (company_id, direction, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_vat_partner           ON vat_records (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX ix_vat_ddtd              ON vat_records (ddtd) WHERE ddtd IS NOT NULL;
CREATE INDEX ix_vat_parent_ddtd       ON vat_records (parent_ddtd) WHERE parent_ddtd IS NOT NULL;
CREATE INDEX ix_vat_pending           ON vat_records (company_id, status) WHERE status = 'pending';
CREATE INDEX ix_vat_reported_period   ON vat_records (reported_period_id) WHERE reported_period_id IS NOT NULL;
CREATE INDEX ix_vat_journal           ON vat_records (journal_id) WHERE journal_id IS NOT NULL;

COMMENT ON TABLE vat_records IS
  'НӨАТ-ын дэлгэрэнгүй бүртгэл. eBarimt + гараар + import-ээс ирнэ. paid_amount-аар авлага/өглөгийг мөшгинө.';
COMMENT ON COLUMN vat_records.ddtd IS
  'eBarimt receipt-ийн ДДТД (Дугаар Дугаар Төгрөг Дугаар) — Mongolian e-receipt ID.';
COMMENT ON COLUMN vat_records.parent_ddtd IS
  'Хэрэв энэ нь буцаалт, залруулга бол анхны eBarimt-ийн ДДТД.';

CREATE TRIGGER tr_vat_updated_at
  BEFORE UPDATE ON vat_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_vat_audit
  AFTER INSERT OR UPDATE OR DELETE ON vat_records
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
