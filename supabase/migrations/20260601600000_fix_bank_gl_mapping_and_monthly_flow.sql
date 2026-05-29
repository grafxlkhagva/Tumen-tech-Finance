-- =============================================================================
-- Fix bank_account → GL account mapping + add monthly-flow RPC
-- =============================================================================
-- During the SQLite migration the helper picked the first "1xx" prefix account
-- (1110 Касс) for every bank_account, so all banks ended up pointing at the
-- cash-on-hand GL account. This corrects the mapping by matching on bank name
-- substring, idempotent (only updates when current mapping is the bogus default).
--
-- Also adds fn_bank_monthly_flow(company, year) used by the new
-- /cash/bank-summary report — pivots cash_transactions per bank per month and
-- computes the opening balance from posted journal_lines on the GL account.
-- =============================================================================

DO $$
DECLARE
  v_company uuid := '00000000-0000-0000-0000-000000000001';
  v_a1101 uuid; v_a1102 uuid; v_a1103 uuid; v_a1110 uuid;
BEGIN
  SELECT id INTO v_a1101 FROM accounts WHERE company_id = v_company AND code = '1101';
  SELECT id INTO v_a1102 FROM accounts WHERE company_id = v_company AND code = '1102';
  SELECT id INTO v_a1103 FROM accounts WHERE company_id = v_company AND code = '1103';
  SELECT id INTO v_a1110 FROM accounts WHERE company_id = v_company AND code = '1110';

  -- Голомт → 1101
  UPDATE bank_accounts
     SET gl_account_id = v_a1101
   WHERE company_id = v_company
     AND (name ILIKE '%Голомт%' OR name ILIKE '%1175156757%')
     AND v_a1101 IS NOT NULL;

  -- ХХБ / ТДБ → 1102
  UPDATE bank_accounts
     SET gl_account_id = v_a1102
   WHERE company_id = v_company
     AND (name ILIKE '%ХХБ%' OR name ILIKE '%ТДБ%' OR name ILIKE '%411096635%')
     AND v_a1102 IS NOT NULL;

  -- М банк → 1103
  UPDATE bank_accounts
     SET gl_account_id = v_a1103
   WHERE company_id = v_company
     AND (name ILIKE '%М банк%' OR name ILIKE '%9006906192%')
     AND v_a1103 IS NOT NULL;

  -- Дансны бичилт → 1110 (cash-on-hand)
  UPDATE bank_accounts
     SET gl_account_id = v_a1110
   WHERE company_id = v_company
     AND name ILIKE '%Дансны бичилт%'
     AND v_a1110 IS NOT NULL;
END $$;

-- ---------------------------------------------------------------------------
-- fn_bank_monthly_flow — one row per (bank, month 1..12)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bank_monthly_flow(
  p_company_id uuid,
  p_year int
)
RETURNS TABLE (
  bank_id uuid,
  bank_name text,
  gl_code text,
  gl_name text,
  opening_balance numeric,
  month int,
  income numeric,
  expense numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH banks AS (
    SELECT ba.id, ba.name, ba.gl_account_id,
           a.code AS gl_code, a.name AS gl_name
    FROM bank_accounts ba
    LEFT JOIN accounts a ON a.id = ba.gl_account_id
    WHERE ba.company_id = p_company_id
      AND ba.deleted_at IS NULL
      AND ba.is_active = true
  ),
  opening AS (
    SELECT b.id AS bank_id,
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) AS bal
    FROM banks b
    LEFT JOIN journal_lines jl ON jl.account_id = b.gl_account_id
    LEFT JOIN journals j ON j.id = jl.journal_id
      AND j.status = 'posted' AND j.deleted_at IS NULL
      AND j.date < make_date(p_year, 1, 1)
    GROUP BY b.id
  ),
  monthly AS (
    SELECT
      ct.bank_account_id,
      EXTRACT(MONTH FROM ct.txn_date)::int AS m,
      SUM(CASE WHEN ct.direction = 'income'  THEN ct.amount ELSE 0 END) AS inc,
      SUM(CASE WHEN ct.direction = 'expense' THEN ct.amount ELSE 0 END) AS exp
    FROM cash_transactions ct
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND EXTRACT(YEAR FROM ct.txn_date) = p_year
    GROUP BY ct.bank_account_id, EXTRACT(MONTH FROM ct.txn_date)
  ),
  months AS (SELECT generate_series(1, 12) AS m)
  SELECT
    b.id, b.name, b.gl_code, b.gl_name,
    COALESCE(o.bal, 0)::numeric,
    m.m,
    COALESCE(mo.inc, 0)::numeric,
    COALESCE(mo.exp, 0)::numeric
  FROM banks b
  LEFT JOIN opening o ON o.bank_id = b.id
  CROSS JOIN months m
  LEFT JOIN monthly mo ON mo.bank_account_id = b.id AND mo.m = m.m
  ORDER BY b.gl_code NULLS LAST, b.name, m.m;
$$;

COMMENT ON FUNCTION fn_bank_monthly_flow IS
  'Сар бүрийн орлого/зарлага банк тус бүрд + opening balance journal_lines-аас.';
