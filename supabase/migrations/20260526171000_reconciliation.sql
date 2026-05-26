-- =============================================================================
-- 011 — Reconciliation (НӨАТ ↔ Cash, харилцагчтай тулгалт)
-- =============================================================================
-- Mongolian "Тулгалтын акт" — partner-той balance-ыг харьцуулж тохирох.
-- VAT record ↔ Cash transaction-ийг match хийнэ.
-- =============================================================================

CREATE TYPE recon_type AS ENUM (
  'vat_cash',       -- НӨАТ record ↔ Cash transaction
  'partner',        -- харилцагчийн нийт balance
  'bank',           -- bank statement ↔ GL bank account
  'intercompany'    -- холбоотой компаниудтай
);

CREATE TYPE recon_status AS ENUM (
  'pending',
  'matched',
  'disputed',
  'resolved',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Reconciliations (нэг тулгалтын бичлэг)
-- ---------------------------------------------------------------------------
CREATE TABLE reconciliations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  type            recon_type NOT NULL,
  status          recon_status NOT NULL DEFAULT 'pending',
  -- Хэн юутай хийсэн
  partner_id      uuid REFERENCES partners(id),
  period_id       uuid REFERENCES periods(id),
  -- Холбогдох мөрүүд (type-ээс хамаараад нэг нь л дүүрнэ)
  vat_record_id   uuid REFERENCES vat_records(id),
  cash_txn_id     uuid REFERENCES cash_transactions(id),
  -- Дүн ба зөрүү
  matched_amount  numeric(18,2) NOT NULL CHECK (matched_amount >= 0),
  expected_amount numeric(18,2),
  actual_amount   numeric(18,2),
  diff            numeric(18,2) GENERATED ALWAYS AS
                    (COALESCE(actual_amount,0) - COALESCE(expected_amount,0)) STORED,
  -- Дэлгэрэнгүй
  notes           text,
  matched_by      uuid REFERENCES auth.users(id),
  matched_at      timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  resolved_at     timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX ix_recon_company_type    ON reconciliations (company_id, type, status);
CREATE INDEX ix_recon_partner         ON reconciliations (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX ix_recon_vat             ON reconciliations (vat_record_id) WHERE vat_record_id IS NOT NULL;
CREATE INDEX ix_recon_cash            ON reconciliations (cash_txn_id) WHERE cash_txn_id IS NOT NULL;

CREATE TRIGGER tr_recon_updated_at
  BEFORE UPDATE ON reconciliations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_recon_audit
  AFTER INSERT OR UPDATE OR DELETE ON reconciliations
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Match rules (автомат match хийх дүрэм)
-- ---------------------------------------------------------------------------
CREATE TABLE match_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            recon_type NOT NULL,
  -- Match шалгуурууд
  partner_match   text NOT NULL DEFAULT 'exact', -- exact | fuzzy | alias
  amount_tolerance numeric(18,2) NOT NULL DEFAULT 0,
  date_tolerance_days int NOT NULL DEFAULT 3,
  description_pattern text,
  -- Тохиргоо
  is_active       boolean NOT NULL DEFAULT true,
  priority        int NOT NULL DEFAULT 100,
  -- Statistics
  match_count     int NOT NULL DEFAULT 0,
  last_used_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_match_rules_company ON match_rules (company_id, is_active, priority);

CREATE TRIGGER tr_match_rules_updated_at
  BEFORE UPDATE ON match_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
