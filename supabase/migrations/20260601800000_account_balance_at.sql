-- =============================================================================
-- fn_account_balance_at — every account's TYPE-AWARE balance at a given date
-- =============================================================================
-- Returns one row per account in the company with a SIGNED balance where
-- "positive" always means "the account is in its natural direction":
--   - asset / expense:    Dr − Cr  (positive when balance is on the Dr side)
--   - liability / equity / income:  Cr − Dr  (positive when balance is on the Cr side)
--
-- Used by the Mongolian-format Balance Sheet (Сангийн Сайдын 2017 оны 361 дугаар
-- тушаалын маяг). Computing both reporting dates means two RPC calls — much
-- cheaper than running the full structured query twice in SQL.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_account_balance_at(
  p_company_id uuid,
  p_as_of date
)
RETURNS TABLE (
  account_id uuid,
  code text,
  name text,
  type account_type,
  is_postable boolean,
  balance numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id, a.code, a.name, a.type, a.is_postable,
    CASE
      WHEN a.type IN ('asset','expense')
        THEN COALESCE(SUM(jl.debit),  0) - COALESCE(SUM(jl.credit), 0)
      ELSE
        COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit),  0)
    END::numeric AS balance
  FROM accounts a
  LEFT JOIN journal_lines jl ON jl.account_id = a.id
  LEFT JOIN journals j ON j.id = jl.journal_id
    AND j.status = 'posted'
    AND j.deleted_at IS NULL
    AND j.date <= p_as_of
  WHERE a.company_id = p_company_id
    AND a.deleted_at IS NULL
  GROUP BY a.id;
$$;

COMMENT ON FUNCTION fn_account_balance_at IS
  'Тухайн огнооны бүх дансны type-aware signed balance (positive = natural side).';
