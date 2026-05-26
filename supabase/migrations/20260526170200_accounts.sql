-- =============================================================================
-- 003 — Chart of Accounts (hierarchical)
-- =============================================================================
-- Дансны төлөвлөгөө. Шаталсан (parent_id self-reference).
-- Postable account-ууд л journal_line-аар бичигдэнэ. Эцэг данс зөвхөн bal
-- roll-up хийгдэх зориулалттай.
-- =============================================================================

CREATE TYPE account_type AS ENUM (
  'asset',      -- Хөрөнгө (Dr-side normal balance)
  'liability',  -- Өр төлбөр (Cr-side)
  'equity',     -- Эзний өмч (Cr-side)
  'income',     -- Орлого (Cr-side)
  'expense'     -- Зардал (Dr-side)
);

CREATE TABLE accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code            text NOT NULL,
  name            text NOT NULL,
  name_en         text,
  type            account_type NOT NULL,
  parent_id       uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  level           int  NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  is_postable     boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  currency        text NOT NULL DEFAULT 'MNT',
  -- Тайлангийн бүлэглэл
  category        text,           -- жишээ нь 'Current Asset', 'Long-term Liability'
  cashflow_class  text,           -- 'operating' | 'investing' | 'financing'
  -- Татварын мэдээлэл
  vat_applicable  boolean NOT NULL DEFAULT false,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, code)
);

CREATE INDEX ix_accounts_company_type   ON accounts (company_id, type) WHERE deleted_at IS NULL;
CREATE INDEX ix_accounts_company_parent ON accounts (company_id, parent_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_accounts_postable       ON accounts (company_id, is_postable) WHERE is_postable = true AND deleted_at IS NULL;

COMMENT ON TABLE accounts IS
  'Дансны төлөвлөгөө. Шаталсан бүтэц parent_id-аар. is_postable=false бол зөвхөн roll-up parent.';
COMMENT ON COLUMN accounts.is_postable IS
  'true үед journal_line энэ дансанд бичигдэх боломжтой. false бол зөвхөн child-уудын нийлбэр.';
COMMENT ON COLUMN accounts.cashflow_class IS
  'Cash flow statement-д ангилах: operating/investing/financing.';

-- Mongolian accounting: жишээлбэл "11" Эргэлтийн хөрөнгө (parent), "111" Касс, "1111" Касс MNT гэх мэт.
-- Code-ийн дотоод дараалал: prefix matching ашиглан roll-up хийнэ.

CREATE TRIGGER tr_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Constraint: parent данс нь ижил company-д хамаарах ёстой
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_account_parent_same_company()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_company uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT company_id INTO v_parent_company FROM accounts WHERE id = NEW.parent_id;
  IF v_parent_company <> NEW.company_id THEN
    RAISE EXCEPTION 'Parent account % belongs to different company', NEW.parent_id;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Account cannot be its own parent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_accounts_parent_company
  BEFORE INSERT OR UPDATE OF parent_id, company_id ON accounts
  FOR EACH ROW EXECUTE FUNCTION check_account_parent_same_company();
