-- =============================================================================
-- Phase 7 — Reports: views + drilldown
-- =============================================================================

-- ---------------------------------------------------------------------------
-- account_drilldown — return all posted journal lines for an account
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION account_drilldown(
  p_account_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_limit int DEFAULT 500
)
RETURNS TABLE (
  line_id uuid,
  journal_id uuid,
  journal_number text,
  date date,
  description text,
  partner_name text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_type account_type;
BEGIN
  SELECT type INTO v_type FROM accounts WHERE id = p_account_id;

  RETURN QUERY
  WITH lines AS (
    SELECT jl.id AS lid, j.id AS jid, j.number, j.date::date AS jdate,
           jl.description AS ldesc, p.name AS pname,
           jl.debit AS dr, jl.credit AS cr
    FROM journal_lines jl
    JOIN journals j ON j.id = jl.journal_id
    LEFT JOIN partners p ON p.id = jl.partner_id
    WHERE jl.account_id = p_account_id
      AND j.status = 'posted'
      AND j.deleted_at IS NULL
      AND (p_from IS NULL OR j.date >= p_from)
      AND (p_to   IS NULL OR j.date <= p_to)
    ORDER BY j.date, j.number, jl.line_no
    LIMIT p_limit
  )
  SELECT
    lid, jid, number, jdate, ldesc, pname, dr, cr,
    SUM(CASE
      WHEN v_type IN ('asset','expense') THEN dr - cr
      ELSE cr - dr
    END) OVER (ORDER BY jdate, number ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
  FROM lines;
END;
$$;

-- ---------------------------------------------------------------------------
-- Balance Sheet (point-in-time) — using fn_account_balances_period
-- v_balance_sheet view already exists (no date filter). Add a function version.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_balance_sheet(
  p_company_id uuid,
  p_as_of date
)
RETURNS TABLE (
  account_id uuid,
  code text,
  name text,
  type account_type,
  parent_id uuid,
  level int,
  balance numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH bal AS (
    SELECT a.id, a.code, a.name, a.type, a.parent_id, a.level,
      CASE WHEN a.type IN ('asset','expense')
        THEN COALESCE(SUM(jl.debit),0)  - COALESCE(SUM(jl.credit),0)
        ELSE COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
      END AS balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journals j ON j.id = jl.journal_id
      AND j.status='posted' AND j.deleted_at IS NULL
      AND j.date <= p_as_of
    WHERE a.company_id = p_company_id AND a.deleted_at IS NULL
      AND a.is_postable = true
    GROUP BY a.id
  )
  SELECT *
  FROM bal
  WHERE type IN ('asset','liability','equity')
    AND balance <> 0
  ORDER BY code;
$$;

-- ---------------------------------------------------------------------------
-- Income Statement (period)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_income_statement(
  p_company_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  account_id uuid,
  code text,
  name text,
  type account_type,
  amount numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT a.id, a.code, a.name, a.type,
    CASE WHEN a.type IN ('income')
      THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
      ELSE COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
    END AS amount
  FROM accounts a
  LEFT JOIN journal_lines jl ON jl.account_id = a.id
  LEFT JOIN journals j ON j.id = jl.journal_id
    AND j.status='posted' AND j.deleted_at IS NULL
    AND j.date >= p_start AND j.date <= p_end
  WHERE a.company_id = p_company_id AND a.deleted_at IS NULL
    AND a.is_postable = true AND a.type IN ('income','expense')
  GROUP BY a.id
  HAVING (CASE WHEN a.type IN ('income')
      THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0)
      ELSE COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0)
    END) <> 0
  ORDER BY a.code;
$$;

-- ---------------------------------------------------------------------------
-- Cash Flow Statement (period, by direction + category)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cashflow(
  p_company_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  direction cash_direction,
  category text,
  txn_count int,
  amount numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT direction, COALESCE(category, 'Ангилаагүй')::text,
         COUNT(*)::int, SUM(amount)
  FROM cash_transactions
  WHERE company_id = p_company_id
    AND deleted_at IS NULL
    AND txn_date >= p_start AND txn_date <= p_end
  GROUP BY direction, COALESCE(category, 'Ангилаагүй')
  ORDER BY direction, SUM(amount) DESC;
$$;

-- ---------------------------------------------------------------------------
-- CIT helper (computed expense/income totals + 10%/25% bracket)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_cit_summary(
  p_company_id uuid,
  p_year int
)
RETURNS TABLE (
  total_income numeric,
  total_expense numeric,
  taxable_income numeric,
  cit_amount numeric,
  effective_rate numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_income numeric := 0;
  v_expense numeric := 0;
  v_taxable numeric := 0;
  v_cit numeric := 0;
  v_start date := make_date(p_year, 1, 1);
  v_end   date := make_date(p_year, 12, 31);
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_income
  FROM fn_income_statement(p_company_id, v_start, v_end)
  WHERE type = 'income';

  SELECT COALESCE(SUM(amount),0) INTO v_expense
  FROM fn_income_statement(p_company_id, v_start, v_end)
  WHERE type = 'expense';

  v_taxable := v_income - v_expense;

  IF v_taxable <= 0 THEN
    v_cit := 0;
  ELSIF v_taxable <= 3000000000 THEN
    v_cit := v_taxable * 0.10;
  ELSE
    v_cit := 3000000000 * 0.10 + (v_taxable - 3000000000) * 0.25;
  END IF;

  total_income := v_income;
  total_expense := v_expense;
  taxable_income := v_taxable;
  cit_amount := v_cit;
  effective_rate := CASE WHEN v_taxable > 0 THEN ROUND(v_cit / v_taxable * 100, 2) ELSE 0 END;
  RETURN NEXT;
END;
$$;
