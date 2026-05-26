-- =============================================================================
-- 004 — Partners (харилцагч: захиалагч, нийлүүлэгч, ажилчин)
-- =============================================================================
-- Хуучин SQLite-д partner.aliases TEXT (JSON string) хадгалдаг байсан.
-- Шинээр: aliases JSONB array болгож trgm-аар индекслэнэ.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- IMMUTABLE wrapper for unaccent() — required to use in generated columns
-- and function-based indexes. The bare unaccent() is STABLE not IMMUTABLE
-- because it depends on dictionary state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

COMMENT ON FUNCTION immutable_unaccent IS
  'IMMUTABLE wrapper around unaccent() for use in generated columns/indexes.';

CREATE TYPE partner_type AS ENUM (
  'customer',
  'supplier',
  'both',
  'employee',
  'other'
);

CREATE TABLE partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  code            text,                           -- Дотоод код (optional)
  name            text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(immutable_unaccent(name))) STORED,
  register        text,                           -- УБДУС регистр
  tin             text,                           -- Татвар төлөгчийн дугаар
  type            partner_type NOT NULL DEFAULT 'customer',
  phone           text,
  email           citext,
  address         text,
  contact_person  text,
  -- Дедупликаци: alias-аар хайх (Cyrillic/Latin/different spellings)
  aliases         jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Default account-ууд (optional, тооцоо хийхэд хэрэглэнэ)
  default_ar_account_id uuid REFERENCES accounts(id),
  default_ap_account_id uuid REFERENCES accounts(id),
  -- Татварын статус
  is_vat_payer    boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id),
  updated_by      uuid REFERENCES auth.users(id),
  deleted_at      timestamptz,
  UNIQUE (company_id, code)
);

-- Дедуплкацийн индексүүд
CREATE INDEX ix_partners_company_active   ON partners (company_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX ix_partners_register         ON partners (company_id, register) WHERE register IS NOT NULL;
CREATE INDEX ix_partners_tin              ON partners (company_id, tin) WHERE tin IS NOT NULL;
CREATE INDEX ix_partners_name_trgm        ON partners USING gin (name_normalized gin_trgm_ops);
CREATE INDEX ix_partners_aliases          ON partners USING gin (aliases jsonb_path_ops);

COMMENT ON TABLE partners IS
  'Захиалагч, нийлүүлэгч, ажилчин. aliases дотор хувилбар нэрсийг хадгалж дедупликаци хийнэ.';
COMMENT ON COLUMN partners.name_normalized IS
  'Жижиг үсэг + unaccent. trgm индексээр хурдан fuzzy search хийнэ.';
COMMENT ON COLUMN partners.aliases IS
  'Array of strings (JSONB). Жишээ: ["Бат-Эрдэнэ ХХК", "Bat-Erdene LLC", "BAT-ERDENE"].';

CREATE TRIGGER tr_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_partners_audit
  AFTER INSERT OR UPDATE OR DELETE ON partners
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ---------------------------------------------------------------------------
-- Helper: alias-аар partner хайх
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_partner_by_name(
  p_company_id uuid,
  p_search text,
  p_threshold real DEFAULT 0.4
)
RETURNS TABLE (
  partner_id uuid,
  name text,
  similarity real,
  match_source text  -- 'name' | 'alias'
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT lower(immutable_unaccent(p_search)) AS q
  )
  SELECT
    p.id,
    p.name,
    similarity(p.name_normalized, n.q) AS sim,
    'name'::text AS match_source
  FROM partners p, normalized n
  WHERE p.company_id = p_company_id
    AND p.deleted_at IS NULL
    AND similarity(p.name_normalized, n.q) >= p_threshold

  UNION ALL

  SELECT
    p.id,
    p.name,
    similarity(lower(immutable_unaccent(alias)), n.q) AS sim,
    'alias'::text
  FROM partners p, normalized n,
       jsonb_array_elements_text(p.aliases) AS alias
  WHERE p.company_id = p_company_id
    AND p.deleted_at IS NULL
    AND similarity(lower(immutable_unaccent(alias)), n.q) >= p_threshold

  ORDER BY sim DESC
  LIMIT 10;
$$;

COMMENT ON FUNCTION find_partner_by_name IS
  'Trgm-аар fuzzy матчинг. Хуучин системийн _search_variants()-ийг орлоно.';
