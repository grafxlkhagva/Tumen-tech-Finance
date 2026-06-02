-- =============================================================================
-- fn_cash_summary — full-dataset totals for the /cash page
-- =============================================================================
-- The /cash page paginates 100 rows at a time, so summing the visible rows
-- gave wildly wrong KPI numbers (238M instead of 3.4B). This function applies
-- the SAME filters as the page query but aggregates the ENTIRE matching set:
--
--   total_income   = Σ amount WHERE direction='income'
--   total_expense  = Σ amount WHERE direction='expense'
--   net_flow       = income - expense
--   unlinked_count = rows with no contra_account_id assigned
--   txn_count      = total matching rows
--
-- All filter params are optional (NULL = no filter), mirroring the legacy
-- /cash route (app.py:2382-2442).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_cash_summary(
  p_company_id uuid,
  p_bank       uuid    DEFAULT NULL,
  p_direction  text    DEFAULT NULL,
  p_date_from  date    DEFAULT NULL,
  p_date_to    date    DEFAULT NULL,
  p_partner    text    DEFAULT NULL,
  p_unlinked   boolean DEFAULT false
)
RETURNS TABLE (
  total_income   numeric,
  total_expense  numeric,
  net_flow       numeric,
  unlinked_count int,
  txn_count      int
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT ct.direction, ct.amount, ct.contra_account_id
    FROM cash_transactions ct
    LEFT JOIN partners p ON p.id = ct.partner_id
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND (p_bank      IS NULL OR ct.bank_account_id = p_bank)
      AND (p_direction IS NULL OR ct.direction = p_direction::cash_direction)
      AND (p_date_from IS NULL OR ct.txn_date >= p_date_from)
      AND (p_date_to   IS NULL OR ct.txn_date <= p_date_to)
      AND (p_partner   IS NULL OR p_partner = '' OR
           ct.partner_name ILIKE '%' || p_partner || '%' OR
           p.name          ILIKE '%' || p_partner || '%')
      AND (NOT p_unlinked OR ct.contra_account_id IS NULL)
  )
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'income'),  0)::numeric AS total_income,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'expense'), 0)::numeric AS total_expense,
    (COALESCE(SUM(amount) FILTER (WHERE direction = 'income'),  0)
     - COALESCE(SUM(amount) FILTER (WHERE direction = 'expense'), 0))::numeric AS net_flow,
    COUNT(*) FILTER (WHERE contra_account_id IS NULL)::int AS unlinked_count,
    COUNT(*)::int AS txn_count
  FROM filtered;
$$;

COMMENT ON FUNCTION fn_cash_summary IS
  '/cash хуудасны KPI — бүх шүүгдсэн гүйлгээний орлого/зарлага/цэвэр урсгал/холбогдоогүй тоо (paginated биш, бүхэлд нь).';
