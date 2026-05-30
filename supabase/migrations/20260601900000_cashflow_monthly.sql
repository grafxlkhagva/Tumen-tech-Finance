-- =============================================================================
-- fn_cashflow_monthly — internal cashflow report (legacy parity)
-- =============================================================================
-- Returns one row per (direction, category, month) for a given fiscal year.
-- Used by /reports/cashflow (Internal Tab) to pivot into a 12-month columnar
-- table matching legacy `cashflow_report.html` (mode=internal).
--
-- Categories are free-form text stored on cash_transactions.category, but the
-- accountant uses a hierarchical numbering scheme:
--   1.1.1—1.1.4  Operating cash inflow
--   1.2.1—1.2.3  Contractor payments
--   2.1.1—2.1.15 Other operating outflow
--   2.2.1—2.2.4  Tax + social insurance
--   3.2.1—3.2.4  Investing outflow
--   5.1.2/5.1.3  Related-party / employee loan inflow
--   5.2.1/5.2.2/5.2.3 Related-party / employee loan outflow
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_cashflow_monthly(
  p_company_id uuid,
  p_year       int
)
RETURNS TABLE (
  direction cash_direction,
  category  text,
  month     int,
  txn_count int,
  amount    numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    direction,
    COALESCE(NULLIF(category, ''), 'Ангилаагүй')::text AS category,
    EXTRACT(MONTH FROM txn_date)::int                  AS month,
    COUNT(*)::int                                      AS txn_count,
    COALESCE(SUM(amount), 0)::numeric                  AS amount
  FROM cash_transactions
  WHERE company_id = p_company_id
    AND deleted_at IS NULL
    AND EXTRACT(YEAR FROM txn_date) = p_year
  GROUP BY direction, COALESCE(NULLIF(category, ''), 'Ангилаагүй'), EXTRACT(MONTH FROM txn_date)
  ORDER BY direction, category, month;
$$;

COMMENT ON FUNCTION fn_cashflow_monthly IS
  'Тухайн жилийн cash flow-г (orlog/zaргlaga × категори × сар) огноогоор тоолж буцаана. /reports/cashflow Дотоод табд хэрэглэгдэнэ.';

-- ---------------------------------------------------------------------------
-- fn_cashflow_opening_cash — opening cash balance for the year
-- ---------------------------------------------------------------------------
-- Sum of (opening_balance + net flow before p_year) across all bank accounts.
-- Used as the seed for the running closing balance column in the internal view.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_cashflow_opening_cash(
  p_company_id uuid,
  p_year       int
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH bank_ob AS (
    SELECT COALESCE(SUM(opening_balance), 0) AS ob
    FROM bank_accounts
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND is_active   = true
  ),
  prior_flow AS (
    SELECT COALESCE(SUM(
      CASE WHEN direction = 'income'  THEN amount
           WHEN direction = 'expense' THEN -amount
      END
    ), 0) AS flow
    FROM cash_transactions
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND txn_date < make_date(p_year, 1, 1)
  )
  SELECT (SELECT ob FROM bank_ob) + (SELECT flow FROM prior_flow);
$$;

COMMENT ON FUNCTION fn_cashflow_opening_cash IS
  'Тухайн жилийн 01.01-ний байдлаар бүх банкны мөнгөн дүн (opening_balance + өмнөх жилүүдийн net flow).';
