-- =============================================================================
-- fn_receivables_by_partner — per-partner AR exposure dashboard
-- =============================================================================
-- Aggregates eBarimt outbound VAT records + bank income transactions per
-- partner so the /receivables page can show "who owes us how much?" at a
-- glance.
--
-- Per legacy app.py:receivables (3000-3082):
--   invoiced  = Σ vat_records.total_amount  WHERE direction='outbound' AND parent_ddtd IS NULL
--                (matched by partner_id OR — if missing — by partner_register)
--   collected = Σ cash_transactions.amount  WHERE direction='income' AND partner_id IS NOT NULL
--   remaining = max(0, invoiced - collected)
--   status    = paid     if invoiced > 0 AND remaining < 1
--             = partial  if collected > 0 AND remaining > 0
--             = open     otherwise
--
-- Returns one row per partner that has either invoiced amount or collected
-- amount (skips zero-zero partners). Optional `p_status` narrows the set.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_receivables_by_partner(
  p_company_id uuid,
  p_status     text DEFAULT NULL  -- NULL | 'open' | 'partial' | 'paid'
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
    -- Fallback: VAT rows that didn't match a partner_id but have a register
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
  joined AS (
    SELECT
      p.id              AS partner_id,
      p.code            AS partner_code,
      p.name            AS partner_name,
      p.register        AS partner_register,
      -- Прefer match by partner_id; fall back to register lookup
      COALESCE(i.amt, ir.amt, 0)::numeric AS invoiced,
      COALESCE(b.amt, 0)::numeric         AS collected
    FROM partners p
    LEFT JOIN inv_by_pid i  ON i.partner_id       = p.id
    LEFT JOIN inv_by_reg ir ON ir.partner_register = p.register AND i.amt IS NULL
    LEFT JOIN bank_by_pid b ON b.partner_id        = p.id
    WHERE p.company_id = p_company_id
      AND p.deleted_at IS NULL
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
    WHERE invoiced > 0 OR collected > 0   -- drop zero-zero partners
  )
  SELECT
    partner_id, partner_code, partner_name, partner_register,
    invoiced, collected, remaining, status, match_pct
  FROM classified
  WHERE p_status IS NULL OR status = p_status
  ORDER BY remaining DESC, invoiced DESC;
$$;

COMMENT ON FUNCTION fn_receivables_by_partner IS
  'Харилцагч бүрд eBarimt нэхэмжлэл + банкны орлогыг нэгтгэн авлагын экспозурыг буцаана. /receivables хуудсанд хэрэглэгдэнэ.';
