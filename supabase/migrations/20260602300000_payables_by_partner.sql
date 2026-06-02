-- =============================================================================
-- fn_payables_by_partner — per-supplier AP exposure dashboard
-- =============================================================================
-- AP twin of fn_receivables_by_partner. Aggregates inbound VAT records
-- (eBarimt purchase invoices) + bank expense transactions + manual `payables`
-- per supplier so /payables can show "whom do we owe how much?" at a glance.
--
-- Port of legacy/app.py:payables (3169-3253):
--   invoiced  = Σ vat_records.total_amount  WHERE direction='inbound'
--                (matched by partner_id OR — if missing — by partner_register)
--   paid      = Σ cash_transactions.amount  WHERE direction='expense', partner_id NOT NULL
--   manual    = Σ payables.total_amount / paid_amount  (entered by accountant)
--   remaining = max(0, invoiced - paid)
--   diff      = invoiced - paid    (negative = overpaid)
--   status    = paid     if invoiced > 0 AND remaining < 1
--             = partial  if paid > 0 AND remaining > 0
--             = open     otherwise
--
-- LIMIT 2000 caps the payload so a tenant with thousands of suppliers
-- doesn't OOM the page.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_payables_by_partner(
  p_company_id uuid,
  p_status     text DEFAULT NULL,
  p_search     text DEFAULT NULL  -- ILIKE filter on partner_name (optional)
)
RETURNS TABLE (
  partner_id       uuid,
  partner_code     text,
  partner_name     text,
  partner_register text,
  invoiced         numeric,
  paid             numeric,
  remaining        numeric,
  diff             numeric,
  status           text,
  match_pct        numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH inv_by_pid AS (
    SELECT v.partner_id, SUM(v.total_amount)::numeric AS amt
    FROM vat_records v
    WHERE v.company_id = p_company_id
      AND v.deleted_at IS NULL
      AND v.direction  = 'inbound'
      AND v.partner_id IS NOT NULL
    GROUP BY v.partner_id
  ),
  inv_by_reg AS (
    -- Fallback: inbound VAT rows missing partner_id but carrying a register
    SELECT v.partner_register, SUM(v.total_amount)::numeric AS amt
    FROM vat_records v
    WHERE v.company_id = p_company_id
      AND v.deleted_at IS NULL
      AND v.direction  = 'inbound'
      AND v.partner_id IS NULL
      AND v.partner_register IS NOT NULL
    GROUP BY v.partner_register
  ),
  bank_by_pid AS (
    -- Bank expense paid to each supplier
    SELECT ct.partner_id, SUM(ct.amount)::numeric AS amt
    FROM cash_transactions ct
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND ct.direction  = 'expense'
      AND ct.partner_id IS NOT NULL
    GROUP BY ct.partner_id
  ),
  manual_ap AS (
    -- Manual payables entered via /payables/new (no eBarimt source).
    -- Exclude draft/cancelled/written_off — they're not real liabilities.
    SELECT
      p.partner_id,
      SUM(p.total_amount)::numeric AS amt,
      SUM(p.paid_amount)::numeric  AS paid
    FROM payables p
    WHERE p.company_id = p_company_id
      AND p.deleted_at IS NULL
      AND p.status NOT IN ('draft'::ar_ap_status, 'cancelled'::ar_ap_status, 'written_off'::ar_ap_status)
    GROUP BY p.partner_id
  ),
  all_pids AS (
    SELECT partner_id FROM inv_by_pid  WHERE partner_id IS NOT NULL
    UNION
    SELECT partner_id FROM bank_by_pid WHERE partner_id IS NOT NULL
    UNION
    SELECT partner_id FROM manual_ap   WHERE partner_id IS NOT NULL
  ),
  joined AS (
    SELECT
      ap.partner_id,
      p.code                                     AS partner_code,
      COALESCE(p.name, '(Устгагдсан партнер)')   AS partner_name,
      p.register                                 AS partner_register,
      -- invoiced = VAT(partner_id) + register fallback (only when no
      -- partner_id match) + manual payable totals
      (COALESCE(i.amt, 0)
       + CASE WHEN i.amt IS NULL THEN COALESCE(ir.amt, 0) ELSE 0 END
       + COALESCE(m.amt, 0))::numeric AS invoiced,
      -- paid = bank expense + payments already recorded against manual
      (COALESCE(b.amt, 0) + COALESCE(m.paid, 0))::numeric AS paid
    FROM all_pids ap
    LEFT JOIN partners    p  ON p.id = ap.partner_id
    LEFT JOIN inv_by_pid  i  ON i.partner_id = ap.partner_id
    LEFT JOIN inv_by_reg  ir ON ir.partner_register = p.register
    LEFT JOIN bank_by_pid b  ON b.partner_id = ap.partner_id
    LEFT JOIN manual_ap   m  ON m.partner_id = ap.partner_id
  ),
  classified AS (
    SELECT
      partner_id, partner_code, partner_name, partner_register,
      invoiced, paid,
      GREATEST(0, invoiced - paid)::numeric AS remaining,
      (invoiced - paid)::numeric            AS diff,
      CASE
        WHEN invoiced > 0 AND (invoiced - paid) < 1 THEN 'paid'
        WHEN paid > 0 AND (invoiced - paid) > 0 THEN 'partial'
        ELSE 'open'
      END AS status,
      CASE
        WHEN invoiced > 0 THEN LEAST(100, (paid / invoiced) * 100)::numeric
        ELSE 0::numeric
      END AS match_pct
    FROM joined
    WHERE invoiced > 0 OR paid > 0   -- drop zero-zero rows
  )
  SELECT
    partner_id, partner_code, partner_name, partner_register,
    invoiced, paid, remaining, diff, status, match_pct
  FROM classified
  WHERE (p_status IS NULL OR status = p_status)
    AND (p_search IS NULL OR p_search = '' OR partner_name ILIKE '%' || p_search || '%')
  ORDER BY remaining DESC, invoiced DESC
  LIMIT 2000;
$$;

COMMENT ON FUNCTION fn_payables_by_partner IS
  'Per-supplier AP exposure: eBarimt inbound + manual payables + bank expense, with orphan-partner handling, search ILIKE, and 2000-row cap.';
