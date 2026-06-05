-- =============================================================================
-- fn_partner_cash_totals — per-partner bank income/expense for /partners list
-- =============================================================================
-- The partners list shows each partner's total bank income (Орлого) and
-- expense (Зарлага) so the accountant sees who's transacting at a glance.
-- Port of legacy/app.py:partners (cash_by_pid aggregate, 2728-2734).
--
-- Returns one row per partner_id that has cash activity. The page LEFT JOINs
-- this onto the partner list (partners with no cash show "—").
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_partner_cash_totals(
  p_company_id uuid
)
RETURNS TABLE (
  partner_id uuid,
  income     numeric,
  expense    numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ct.partner_id,
    COALESCE(SUM(ct.amount) FILTER (WHERE ct.direction = 'income'),  0)::numeric AS income,
    COALESCE(SUM(ct.amount) FILTER (WHERE ct.direction = 'expense'), 0)::numeric AS expense
  FROM cash_transactions ct
  WHERE ct.company_id = p_company_id
    AND ct.deleted_at IS NULL
    AND ct.partner_id IS NOT NULL
  GROUP BY ct.partner_id;
$$;

COMMENT ON FUNCTION fn_partner_cash_totals IS
  'Харилцагч тус бүрийн банкны нийт орлого/зарлага. /partners жагсаалтад хэрэглэгдэнэ.';
