-- =============================================================================
-- 001 — Core foundation: extensions, companies, periods, user_companies, helpers
-- =============================================================================
-- Энэ migration нь production-grade санхүүгийн системийн суурь.
-- - Multi-tenancy: бүх business хүснэгт company_id-аар тусгаарлана.
-- - Period close: тухайн сарын posted journal-ыг хааж засварлахыг хориглоно.
-- - User-Company role mapping: RLS-д ашиглах.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";         -- case-insensitive text
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- fuzzy text search (харилцагч дедуплкаци)
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- кирилл/латин нормализаци

-- ---------------------------------------------------------------------------
-- Helper: enum types
-- ---------------------------------------------------------------------------
CREATE TYPE company_role AS ENUM (
  'admin',       -- бүх эрх
  'accountant',  -- журнал бичих/постлох, тайлан
  'auditor',     -- зөвхөн уншина + audit log харна
  'viewer'       -- зөвхөн тайлан үзэх
);

CREATE TYPE period_status AS ENUM (
  'open',     -- идэвхтэй, journal post хийх боломжтой
  'closed',   -- хаагдсан, шинэ journal оруулах боломжгүй
  'locked'    -- audit өнгөрсний дараа эцэслэн lock хийсэн
);

-- ---------------------------------------------------------------------------
-- Companies (tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  legal_name    text,
  register      text,                          -- УБДУС регистр
  tin           text,                          -- Татвар төлөгчийн дугаар
  address       text,
  phone         text,
  email         citext,
  base_currency text NOT NULL DEFAULT 'MNT',
  fiscal_year_start_month  smallint NOT NULL DEFAULT 1
                CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  is_active     boolean NOT NULL DEFAULT true,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  UNIQUE (register)
);

COMMENT ON TABLE companies IS 'Tenants. Бүх business хүснэгт энэ компанид хамаарна (RLS).';

-- ---------------------------------------------------------------------------
-- User <-> Company role mapping
-- (auth.users-ийг Supabase Auth өөрөө удирдана)
-- ---------------------------------------------------------------------------
CREATE TABLE user_companies (
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role          company_role NOT NULL DEFAULT 'viewer',
  is_default    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX ix_user_companies_company ON user_companies (company_id);

COMMENT ON TABLE user_companies IS 'Хэрэглэгчийн ямар компанид ямар эрхтэй болохыг хадгална. RLS-ийн үндэс.';

-- ---------------------------------------------------------------------------
-- Periods (fiscal months)
-- Сар бүрд нэг бичлэг. close_period() функцээр хаагдана.
-- ---------------------------------------------------------------------------
CREATE TABLE periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  year          int  NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month         int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  status        period_status NOT NULL DEFAULT 'open',
  closed_at     timestamptz,
  closed_by     uuid REFERENCES auth.users(id),
  locked_at     timestamptz,
  locked_by     uuid REFERENCES auth.users(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, year, month),
  CHECK (end_date >= start_date)
);

CREATE INDEX ix_periods_company_status ON periods (company_id, status);
CREATE INDEX ix_periods_company_year_month ON periods (company_id, year DESC, month DESC);

COMMENT ON TABLE periods IS 'Сарын хаалт. status=closed үед journal post/update боломжгүй.';

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Тухайн хэрэглэгчийн харъяалагдах компаниудыг буцаана (RLS-д ашиглана)
CREATE OR REPLACE FUNCTION auth_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM user_companies
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION auth_company_ids IS
  'Одоогийн нэвтэрсэн хэрэглэгчийн харъяалагдах company_id-уудыг буцаана. RLS policy-д ашиглана.';

-- Тухайн хэрэглэгч нь company-д ямар role-той болохыг буцаана
CREATE OR REPLACE FUNCTION auth_company_role(p_company_id uuid)
RETURNS company_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_companies
  WHERE user_id = auth.uid()
    AND company_id = p_company_id
  LIMIT 1;
$$;

-- Тухайн хэрэглэгч нь company-д role-ийн жагсаалтад орсон эсэхийг шалгана
CREATE OR REPLACE FUNCTION auth_has_role(p_company_id uuid, VARIADIC p_roles company_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_companies
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND role = ANY(p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Period helper: тухайн өдөр аль period-д хамаарахыг олох
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION period_for_date(p_company_id uuid, p_date date)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM periods
  WHERE company_id = p_company_id
    AND p_date BETWEEN start_date AND end_date
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- updated_at автомат шинэчлэх trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- companies, periods дээр updated_at trigger тавья
CREATE TRIGGER tr_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tr_periods_updated_at
  BEFORE UPDATE ON periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
