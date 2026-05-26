-- =============================================================================
-- 008 — Receivables, Payables, Invoice Payments
-- =============================================================================
-- AR (авлага): нэхэмжлэх илгээсэн → төлбөр хүлээж буй
-- AP (өглөг): нэхэмжлэх хүлээн авсан → төлбөр хийх ёстой
-- =============================================================================

CREATE TYPE ar_ap_status AS ENUM (
  'draft',          -- бичсэн, илгээгээгүй
  'open',           -- илгээсэн, төлөөгүй
  'partial',        -- хагас төлөгдсөн
  'paid',           -- бүрэн төлөгдсөн
  'overdue',        -- хугацаа хэтэрсэн (computed)
  'cancelled',      -- цуцалсан
  'written_off'     -- хорогдсон
);

-- ---------------------------------------------------------------------------
-- Receivables (Авлага)
-- ---------------------------------------------------------------------------
CREATE TABLE receivables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  partner_id      uuid NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  -- Нэхэмжлэхийн мэдээлэл
  invoice_no      text,
  invoice_date    date NOT NULL,
  due_date        date,
  description     text,
  -- Дүн
  amount          numeric(18,2) NOT NULL CHECK (amount > 0),       -- НӨАТгүй
  vat_amount      numeric(18,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount    numeric(18,2) NOT NULL CHECK (total_amount > 0), -- НӨАТтай
  paid_amount     numeric(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining       numeric(18,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  currency        text NOT NULL DEFAULT 'MNT',
  exchange_rate   numeric(18,6) NOT NULL DEFAULT 1.0,
  -- Workflow
  status          ar_ap_status NOT NULL DEFAULT 'draft',
  responsible     text,                           -- Хариуцсан KAM
  -- Холбоосууд
  vat_record_id   uuid REFERENCES vat_records(id), -- хариулсан eBarimt
  journal_id      uuid REFERENCES journals(id),    -- үүсгэсэн journal
  ar_account_id   uuid NOT NULL REFERENCES accounts(id), -- авлагын данс
  income_account_id uuid REFERENCES accounts(id),  -- орлогын данс (журнал үүсгэхэд)
  -- Нэмэлт
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, invoice_no),
  CONSTRAINT chk_ar_total_eq_amount_plus_vat
    CHECK (total_amount = amount + vat_amount),
  CONSTRAINT chk_ar_paid_le_total
    CHECK (paid_amount <= total_amount)
);

CREATE INDEX ix_receivables_company_date  ON receivables (company_id, invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_receivables_partner       ON receivables (partner_id);
CREATE INDEX ix_receivables_status        ON receivables (company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_receivables_due           ON receivables (company_id, due_date) WHERE status IN ('open','partial');
CREATE INDEX ix_receivables_responsible   ON receivables (company_id, responsible) WHERE responsible IS NOT NULL;

CREATE TRIGGER tr_receivables_updated_at
  BEFORE UPDATE ON receivables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_receivables_audit
  AFTER INSERT OR UPDATE OR DELETE ON receivables
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Forward FK from vat_records.receivable_id
ALTER TABLE vat_records
  ADD CONSTRAINT fk_vat_receivable
  FOREIGN KEY (receivable_id) REFERENCES receivables(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Payables (Өглөг)
-- ---------------------------------------------------------------------------
CREATE TABLE payables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  partner_id      uuid NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  invoice_no      text,
  invoice_date    date NOT NULL,
  due_date        date,
  description     text,
  amount          numeric(18,2) NOT NULL CHECK (amount > 0),
  vat_amount      numeric(18,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  total_amount    numeric(18,2) NOT NULL CHECK (total_amount > 0),
  paid_amount     numeric(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  remaining       numeric(18,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  currency        text NOT NULL DEFAULT 'MNT',
  exchange_rate   numeric(18,6) NOT NULL DEFAULT 1.0,
  status          ar_ap_status NOT NULL DEFAULT 'draft',
  responsible     text,
  vat_record_id   uuid REFERENCES vat_records(id),
  journal_id      uuid REFERENCES journals(id),
  ap_account_id   uuid NOT NULL REFERENCES accounts(id),
  expense_account_id uuid REFERENCES accounts(id),
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, partner_id, invoice_no),
  CONSTRAINT chk_ap_total_eq_amount_plus_vat
    CHECK (total_amount = amount + vat_amount),
  CONSTRAINT chk_ap_paid_le_total
    CHECK (paid_amount <= total_amount)
);

CREATE INDEX ix_payables_company_date     ON payables (company_id, invoice_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_payables_partner          ON payables (partner_id);
CREATE INDEX ix_payables_status           ON payables (company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_payables_due              ON payables (company_id, due_date) WHERE status IN ('open','partial');

CREATE TRIGGER tr_payables_updated_at
  BEFORE UPDATE ON payables
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_payables_audit
  AFTER INSERT OR UPDATE OR DELETE ON payables
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Forward FK from vat_records.payable_id
ALTER TABLE vat_records
  ADD CONSTRAINT fk_vat_payable
  FOREIGN KEY (payable_id) REFERENCES payables(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Invoice Payments (нэхэмжлэх ↔ cash transaction reconciliation)
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Нэг тал заавал заагдсан байх ёстой (XOR)
  receivable_id   uuid REFERENCES receivables(id) ON DELETE CASCADE,
  payable_id      uuid REFERENCES payables(id) ON DELETE CASCADE,
  cash_txn_id     uuid NOT NULL REFERENCES cash_transactions(id) ON DELETE RESTRICT,
  amount          numeric(18,2) NOT NULL CHECK (amount > 0),
  payment_date    date NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  CONSTRAINT chk_invoice_xor
    CHECK ((receivable_id IS NOT NULL)::int + (payable_id IS NOT NULL)::int = 1)
);

CREATE INDEX ix_invoice_payments_receivable ON invoice_payments (receivable_id) WHERE receivable_id IS NOT NULL;
CREATE INDEX ix_invoice_payments_payable    ON invoice_payments (payable_id)    WHERE payable_id IS NOT NULL;
CREATE INDEX ix_invoice_payments_cash       ON invoice_payments (cash_txn_id);

COMMENT ON TABLE invoice_payments IS
  'Cash transaction ↔ Receivable/Payable холболт. Нэг cash хэдэн invoice-д хуваагдаж болно.';

CREATE TRIGGER tr_invoice_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
