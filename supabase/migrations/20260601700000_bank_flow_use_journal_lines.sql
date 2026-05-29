-- =============================================================================
-- Switch fn_bank_monthly_flow to journal_lines + expose gl_account_id
-- =============================================================================
-- Original revision aggregated `cash_transactions` per month. That misses any
-- adjusting/manual journal that posts to the bank's GL account but never
-- flowed through the bank statement (e.g. a bank-fee correction or a
-- year-end reclassification). Switching to journal_lines on the bank GL
-- account makes the bank-summary report the same source of truth as
-- Trial Balance and Balance Sheet.
--
-- Side note: cash batch journals already write back to journal_lines via
-- post_journal(), so all migrated cash data is still included.
-- Side effect: balances now appear ON the journal date, not on the
-- bank-statement date. For batched months that's month-end (acceptable).
--
-- Also exposes gl_account_id so the UI can drill down to /reports/ledger
-- without re-querying.
-- =============================================================================

DROP FUNCTION IF EXISTS fn_bank_monthly_flow(uuid, int);

CREATE OR REPLACE FUNCTION fn_bank_monthly_flow(
  p_company_id uuid,
  p_year int
)
RETURNS TABLE (
  bank_id uuid,
  bank_name text,
  gl_account_id uuid,
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
    -- Cumulative balance on each bank's GL account at year-start - 1 day,
    -- from posted journals only
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
    -- Sum debit (= money into bank GL) and credit (= out) per month
    SELECT
      b.id AS bank_id,
      EXTRACT(MONTH FROM j.date)::int AS m,
      SUM(jl.debit)  AS inc,
      SUM(jl.credit) AS exp
    FROM banks b
    JOIN journal_lines jl ON jl.account_id = b.gl_account_id
    JOIN journals j ON j.id = jl.journal_id
      AND j.status = 'posted' AND j.deleted_at IS NULL
      AND EXTRACT(YEAR FROM j.date) = p_year
    GROUP BY b.id, EXTRACT(MONTH FROM j.date)
  ),
  months AS (SELECT generate_series(1, 12) AS m)
  SELECT
    b.id, b.name, b.gl_account_id, b.gl_code, b.gl_name,
    COALESCE(o.bal, 0)::numeric,
    m.m,
    COALESCE(mo.inc, 0)::numeric,
    COALESCE(mo.exp, 0)::numeric
  FROM banks b
  LEFT JOIN opening o ON o.bank_id = b.id
  CROSS JOIN months m
  LEFT JOIN monthly mo ON mo.bank_id = b.id AND mo.m = m.m
  ORDER BY b.gl_code NULLS LAST, b.name, m.m;
$$;

COMMENT ON FUNCTION fn_bank_monthly_flow IS
  'Сар бүрийн банкны хөрөнгийн хөдөлгөөн posted journal_lines-ээс. Manual journal-уудыг ч хамруулна.';
