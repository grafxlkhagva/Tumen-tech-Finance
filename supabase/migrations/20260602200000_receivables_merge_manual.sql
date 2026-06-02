-- =============================================================================
-- fn_receivables_by_partner — v2 — merge manual receivables + handle orphans
-- =============================================================================
-- Replaces 20260602100000_receivables_by_partner.sql to address two audit
-- findings:
--
--   1. Manual `receivables` rows (no eBarimt, no bank match) were invisible
--      because the function only joined vat_records + cash_transactions.
--      Legacy app.py:3060-3074 explicitly merges them; we now do the same.
--
--   2. Soft-deleted partners' AR still mattered for the audit trail. We now
--      drive the row list from a UNION of every partner_id with activity
--      and LEFT JOIN partners — so orphan AR (partner soft-deleted after
--      the invoice was raised) surfaces as "(Устгагдсан партнер)" instead
--      of vanishing.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_receivables_by_partner(
  p_company_id uuid,
  p_status     text DEFAULT NULL
)
RETURNS TABLE (
  partner_id       uuid,
  partner_code     text,
  partner_name     text,
  partner_register text,
  invoiced         numeric,
  collected        numeric,
  remaining        numeric,
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
      AND v.direction  = 'outbound'
      AND v.partner_id IS NOT NULL
      AND (v.parent_ddtd IS NULL OR v.parent_ddtd = '')
    GROUP BY v.partner_id
  ),
  inv_by_reg AS (
    -- Fallback: VAT rows missing partner_id but carrying a register tag
    SELECT v.partner_register, SUM(v.total_amount)::numeric AS amt
    FROM vat_records v
    WHERE v.company_id = p_company_id
      AND v.deleted_at IS NULL
      AND v.direction  = 'outbound'
      AND v.partner_id IS NULL
      AND v.partner_register IS NOT NULL
      AND (v.parent_ddtd IS NULL OR v.parent_ddtd = '')
    GROUP BY v.partner_register
  ),
  bank_by_pid AS (
    SELECT ct.partner_id, SUM(ct.amount)::numeric AS amt
    FROM cash_transactions ct
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND ct.direction  = 'income'
      AND ct.partner_id IS NOT NULL
    GROUP BY ct.partner_id
  ),
  manual_ar AS (
    -- CRITICAL FIX #1 — manual receivables (no eBarimt source) were silently
    -- dropped. Legacy app.py:3060-3074 merges them; we now do too.
    -- ar_ap_status enum values: draft|open|partial|paid|overdue|cancelled|
    -- written_off — exclude the non-collectable ones.
    SELECT
      r.partner_id,
      SUM(r.total_amount)::numeric AS amt,
      SUM(r.paid_amount)::numeric  AS paid
    FROM receivables r
    WHERE r.company_id = p_company_id
      AND r.deleted_at IS NULL
      AND r.status NOT IN ('draft'::ar_ap_status, 'cancelled'::ar_ap_status, 'written_off'::ar_ap_status)
    GROUP BY r.partner_id
  ),
  all_pids AS (
    SELECT partner_id FROM inv_by_pid  WHERE partner_id IS NOT NULL
    UNION
    SELECT partner_id FROM bank_by_pid WHERE partner_id IS NOT NULL
    UNION
    SELECT partner_id FROM manual_ar   WHERE partner_id IS NOT NULL
  ),
  joined AS (
    SELECT
      ap.partner_id,
      p.code            AS partner_code,
      -- Orphan handling — partner may have been soft-deleted after the
      -- VAT row was filed. Show a placeholder name so the AR doesn't vanish.
      COALESCE(p.name, '(Устгагдсан партнер)') AS partner_name,
      p.register        AS partner_register,
      -- invoiced = VAT(partner_id) + register fallback (if no partner_id
      -- match exists at all) + manual receivable totals.
      (COALESCE(i.amt, 0)
       + CASE WHEN i.amt IS NULL THEN COALESCE(ir.amt, 0) ELSE 0 END
       + COALESCE(m.amt, 0))::numeric AS invoiced,
      -- collected = bank income matched to partner + payments already
      -- recorded against manual receivables.
      (COALESCE(b.amt, 0) + COALESCE(m.paid, 0))::numeric AS collected
    FROM all_pids ap
    LEFT JOIN partners    p  ON p.id = ap.partner_id
    LEFT JOIN inv_by_pid  i  ON i.partner_id = ap.partner_id
    LEFT JOIN inv_by_reg  ir ON ir.partner_register = p.register
    LEFT JOIN bank_by_pid b  ON b.partner_id = ap.partner_id
    LEFT JOIN manual_ar   m  ON m.partner_id = ap.partner_id
  ),
  classified AS (
    SELECT
      partner_id, partner_code, partner_name, partner_register,
      invoiced, collected,
      GREATEST(0, invoiced - collected)::numeric AS remaining,
      CASE
        WHEN invoiced > 0 AND (invoiced - collected) < 1 THEN 'paid'
        WHEN collected > 0 AND (invoiced - collected) > 0 THEN 'partial'
        ELSE 'open'
      END AS status,
      CASE
        WHEN invoiced > 0 THEN LEAST(100, (collected / invoiced) * 100)::numeric
        ELSE 0::numeric
      END AS match_pct
    FROM joined
    WHERE invoiced > 0 OR collected > 0   -- drop zero-zero rows
  )
  SELECT
    partner_id, partner_code, partner_name, partner_register,
    invoiced, collected, remaining, status, match_pct
  FROM classified
  WHERE p_status IS NULL OR status = p_status
  ORDER BY remaining DESC, invoiced DESC
  LIMIT 2000;   -- HIGH FIX #10 — bounded result so a 5K-partner tenant
                -- doesn't OOM the page. Phase 4 will cursor-paginate.
$$;

COMMENT ON FUNCTION fn_receivables_by_partner IS
  'Per-partner AR exposure: eBarimt outbound + manual receivables + bank income, with orphan-partner handling and 2000-row cap.';
