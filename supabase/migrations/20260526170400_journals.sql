-- =============================================================================
-- 005 — Journals + Journal Lines (REDESIGNED to standard double-entry)
-- =============================================================================
-- ВАЖНО: Хуучин schema:
--   journal_lines (debit_account_id, credit_account_id, amount)
--   → нэг мөрөнд хоёр account + нэг amount (стандарт биш!)
--
-- Шинэ schema:
--   journal_lines (account_id, debit, credit)
--   → мөр бүр НЭГ account-той, debit ЭСВЭЛ credit утгатай.
--
-- Data migration: 1 хуучин мөр → 2 шинэ мөр (нэг Dr, нэг Cr).
-- =============================================================================

CREATE TYPE journal_status AS ENUM (
  'draft',     -- бичигдсэн, posted болоогүй (засагдах боломжтой)
  'posted',    -- хүчинтэй, account balance-д оролцоно (засагдахгүй)
  'reversed'   -- буцаасан (өөр reverse journal үүсгэсэн)
);

CREATE TYPE journal_source AS ENUM (
  'manual',       -- гараар оруулсан
  'cash_import',  -- банкны statement import
  'vat',          -- НӨАТ-аас үүсгэсэн
  'ebarimt',      -- eBarimt-аас үүсгэсэн
  'payroll',      -- цалин батлагдсан
  'depreciation', -- үндсэн хөрөнгийн элэгдэл
  'opening',      -- эхний үлдэгдэл
  'closing',      -- сар хаалт
  'reversal',     -- reverse entry
  'import'        -- бусад import
);

-- ---------------------------------------------------------------------------
-- Journals (header)
-- ---------------------------------------------------------------------------
CREATE TABLE journals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  period_id       uuid NOT NULL REFERENCES periods(id) ON DELETE RESTRICT,
  number          text NOT NULL,                   -- "202605-0001" хэлбэртэй
  date            date NOT NULL,
  reference       text,                            -- гадаад дугаар (нэхэмжлэх, эвэрбит)
  description     text,
  status          journal_status NOT NULL DEFAULT 'draft',
  source          journal_source NOT NULL DEFAULT 'manual',
  source_ref      text,                            -- эх сурвалжийн ID (cash_txn_id, vat_id, etc.)
  -- Posting / reversal tracking
  posted_at       timestamptz,
  posted_by       uuid REFERENCES auth.users(id),
  reversed_at     timestamptz,
  reversed_by_journal_id uuid REFERENCES journals(id),
  reversal_reason text,
  -- Total amounts (cached, validation-д ашиглана)
  total_debit     numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_debit  >= 0),
  total_credit    numeric(18,2) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
  -- Currency
  currency        text NOT NULL DEFAULT 'MNT',
  exchange_rate   numeric(18,6) NOT NULL DEFAULT 1.0,
  -- Notes & metadata
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, number)
);

CREATE INDEX ix_journals_company_date    ON journals (company_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX ix_journals_period          ON journals (period_id, status);
CREATE INDEX ix_journals_status          ON journals (company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX ix_journals_source_ref      ON journals (source, source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX ix_journals_posted_at       ON journals (company_id, posted_at DESC) WHERE status = 'posted';

COMMENT ON TABLE journals IS
  'Журналын header. Статус: draft → posted → (reversed). Posted journal-ыг засах боломжгүй.';

-- ---------------------------------------------------------------------------
-- Journal Lines (стандарт double-entry: account + debit + credit)
-- ---------------------------------------------------------------------------
CREATE TABLE journal_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id      uuid NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  line_no         int  NOT NULL CHECK (line_no > 0),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  partner_id      uuid REFERENCES partners(id) ON DELETE RESTRICT,
  debit           numeric(18,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit          numeric(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description     text,
  -- Multi-currency support
  currency        text NOT NULL DEFAULT 'MNT',
  fx_debit        numeric(18,2),                  -- валютаар бичсэн дүн (info-only)
  fx_credit       numeric(18,2),
  -- Дотоод reference
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Invariants
  CONSTRAINT chk_debit_xor_credit
    CHECK (
      (debit  > 0 AND credit = 0) OR
      (credit > 0 AND debit  = 0)
    ),
  UNIQUE (journal_id, line_no)
);

CREATE INDEX ix_journal_lines_account     ON journal_lines (account_id);
CREATE INDEX ix_journal_lines_partner     ON journal_lines (partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX ix_journal_lines_journal     ON journal_lines (journal_id);

COMMENT ON TABLE journal_lines IS
  'Standard double-entry: мөр бүр НЭГ account-той, debit ЭСВЭЛ credit утгатай.';

-- ---------------------------------------------------------------------------
-- Trigger: line бүртэй ижил company-д хамаарах ёстой
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_journal_line_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_journal_company uuid;
  v_account_company uuid;
  v_partner_company uuid;
BEGIN
  SELECT company_id INTO v_journal_company FROM journals WHERE id = NEW.journal_id;
  SELECT company_id INTO v_account_company FROM accounts WHERE id = NEW.account_id;

  IF v_account_company <> v_journal_company THEN
    RAISE EXCEPTION 'Account % belongs to different company than journal', NEW.account_id;
  END IF;

  IF NEW.partner_id IS NOT NULL THEN
    SELECT company_id INTO v_partner_company FROM partners WHERE id = NEW.partner_id;
    IF v_partner_company <> v_journal_company THEN
      RAISE EXCEPTION 'Partner % belongs to different company than journal', NEW.partner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_journal_lines_company
  BEFORE INSERT OR UPDATE OF journal_id, account_id, partner_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION check_journal_line_company();

-- ---------------------------------------------------------------------------
-- Trigger: account нь is_postable=true байх ёстой
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_account_postable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_postable boolean;
BEGIN
  SELECT is_postable INTO v_is_postable FROM accounts WHERE id = NEW.account_id;
  IF NOT v_is_postable THEN
    RAISE EXCEPTION 'Account % is not postable (parent/rollup account only)', NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_journal_lines_postable
  BEFORE INSERT OR UPDATE OF account_id ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION check_account_postable();

-- ---------------------------------------------------------------------------
-- Trigger: posted journal-ыг засах, устгахыг хориглох
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_posted_journal_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status journal_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Cannot delete posted journal %. Use reverse_journal() instead.', OLD.number;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: posted -> posted дээр зөвхөн зарим талбар л өөрчилж болно
  IF OLD.status = 'posted' AND NEW.status = 'posted' THEN
    IF (OLD.date, OLD.total_debit, OLD.total_credit) IS DISTINCT FROM
       (NEW.date, NEW.total_debit, NEW.total_credit) THEN
      RAISE EXCEPTION 'Cannot modify date/amounts of posted journal %', OLD.number;
    END IF;
  END IF;

  -- posted -> draft буцаах боломжгүй (зөвхөн reverse)
  IF OLD.status = 'posted' AND NEW.status = 'draft' THEN
    RAISE EXCEPTION 'Cannot revert posted journal to draft. Use reverse_journal().';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_journals_prevent_posted_change
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_change();

-- ---------------------------------------------------------------------------
-- Trigger: posted journal-ийн line-уудыг засах, устгах боломжгүй
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_posted_journal_line_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status journal_status;
  v_journal_id uuid;
BEGIN
  v_journal_id := COALESCE(NEW.journal_id, OLD.journal_id);
  SELECT status INTO v_status FROM journals WHERE id = v_journal_id;
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Cannot modify lines of posted journal %', v_journal_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tr_journal_lines_prevent_posted_change
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_change();

-- ---------------------------------------------------------------------------
-- Trigger: хаагдсан period-д journal оруулах боломжгүй
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_period_open()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status period_status;
BEGIN
  SELECT status INTO v_status FROM periods WHERE id = NEW.period_id;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Period is % — cannot insert/update journals', v_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_journals_period_open
  BEFORE INSERT OR UPDATE OF period_id, date ON journals
  FOR EACH ROW EXECUTE FUNCTION check_period_open();

-- updated_at + audit triggers
CREATE TRIGGER tr_journals_updated_at
  BEFORE UPDATE ON journals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_journals_audit
  AFTER INSERT OR UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

CREATE TRIGGER tr_journal_lines_audit
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
