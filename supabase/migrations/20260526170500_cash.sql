-- =============================================================================
-- 006 — Bank Accounts + Cash Transactions
-- =============================================================================
-- Bank account-уудыг GL account-той холбоно (GL account-аар дамжуулан баланс).
-- Cash transaction нь банкны statement-ийн нэг мөр.
-- =============================================================================

CREATE TYPE cash_direction AS ENUM (
  'income',   -- мөнгө орох (Dr Bank)
  'expense'   -- мөнгө гарах (Cr Bank)
);

-- ---------------------------------------------------------------------------
-- Bank accounts (тогтмол бүртгэлийн дансууд: МонголБанк, ТТБ, Голомт г.м.)
-- ---------------------------------------------------------------------------
CREATE TABLE bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name            text NOT NULL,            -- "Голомт MNT гүйлгээ"
  bank_name       text NOT NULL,            -- "Голомт банк"
  bank_code       text,                     -- swift/short code
  account_number  text NOT NULL,
  currency        text NOT NULL DEFAULT 'MNT',
  gl_account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, account_number, currency)
);

CREATE INDEX ix_bank_accounts_company ON bank_accounts (company_id) WHERE deleted_at IS NULL;

CREATE TRIGGER tr_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_bank_accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Cash transactions (банкны statement-ийн мөрүүд)
-- ---------------------------------------------------------------------------
CREATE TABLE cash_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  txn_date        date NOT NULL,
  txn_timestamp   timestamptz,                    -- statement-аас яг цаг
  direction       cash_direction NOT NULL,
  amount          numeric(18,2) NOT NULL CHECK (amount > 0),
  -- Counterparty info from statement
  description     text,
  partner_name    text,                           -- бичсэн нэр (raw)
  partner_acc     text,                           -- эсрэг талын данс
  partner_id      uuid REFERENCES partners(id),   -- match хийгдсэн бол
  -- Категори & GL mapping
  category        text,                           -- 'sales', 'utility', 'salary', ...
  contra_account_id uuid REFERENCES accounts(id), -- эсрэг GL account (auto-resolved)
  -- Currency
  currency        text NOT NULL DEFAULT 'MNT',
  exchange_rate   numeric(18,6) NOT NULL DEFAULT 1.0,
  -- Statement-ийн нэмэлт мэдээлэл
  reference       text,                           -- bank ref number
  source_row_num  int,                            -- xlsx-ийн мөрийн дугаар
  -- Workflow
  is_reconciled   boolean NOT NULL DEFAULT false,
  journal_id      uuid REFERENCES journals(id),   -- үүсгэсэн journal
  -- Original raw row (отгайз backup)
  raw_data        jsonb,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  -- Duplicate prevention
  UNIQUE (bank_account_id, txn_date, amount, reference, description)
);

CREATE INDEX ix_cash_company_date     ON cash_transactions (company_id, txn_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_cash_bank_date        ON cash_transactions (bank_account_id, txn_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_cash_partner          ON cash_transactions (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX ix_cash_unreconciled     ON cash_transactions (company_id, is_reconciled) WHERE is_reconciled = false;
CREATE INDEX ix_cash_journal          ON cash_transactions (journal_id) WHERE journal_id IS NOT NULL;
CREATE INDEX ix_cash_description_trgm ON cash_transactions USING gin (description gin_trgm_ops) WHERE description IS NOT NULL;

COMMENT ON TABLE cash_transactions IS
  'Банкны statement-ийн мөр. Партнер & GL account-ыг auto-resolve, journal үүсгэх боломжтой.';

CREATE TRIGGER tr_cash_updated_at
  BEFORE UPDATE ON cash_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_cash_audit
  AFTER INSERT OR UPDATE OR DELETE ON cash_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Category → GL account mapping rules
-- ---------------------------------------------------------------------------
CREATE TABLE cash_category_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category        text NOT NULL,                  -- 'sales', 'utility', etc.
  direction       cash_direction NOT NULL,
  contra_account_id uuid NOT NULL REFERENCES accounts(id),
  pattern         text,                           -- regex/keyword for description match
  priority        int  NOT NULL DEFAULT 100,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, category, direction)
);

CREATE INDEX ix_cash_rules_company ON cash_category_rules (company_id, is_active, priority);

COMMENT ON TABLE cash_category_rules IS
  'Категориос автомат GL account-руу mapping. Bank import-ийн үед ашиглана.';
