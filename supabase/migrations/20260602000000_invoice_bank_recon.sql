-- =============================================================================
-- fn_invoice_bank_recon — per-partner invoice ↔ bank reconciliation aggregate
-- =============================================================================
-- For each partner with either receivables or bank income transactions,
-- return one row containing the totals needed by /recon/invoices:
--
--   total_inv    — Σ receivables.total_amount  (per filter)
--   paid_inv     — Σ receivables.paid_amount   (per filter)
--   cnt_inv      — count(receivables)
--   total_bank   — Σ cash_transactions.amount  (direction=income)
--   cnt_bank     — count(cash_transactions where direction=income)
--   matched      — Σ invoice_payments.amount  (matched on this partner's invoices)
--
-- Optional `p_month` (1-12) narrows BOTH sides by month of the date column.
-- Port of legacy/app.py:invoice_bank_recon (3 SQLAlchemy queries collapsed
-- into one set-returning function so the page can do a single round-trip).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_invoice_bank_recon(
  p_company_id uuid,
  p_month      int DEFAULT NULL
)
RETURNS TABLE (
  partner_id    uuid,
  partner_name  text,
  partner_register text,
  total_inv     numeric,
  paid_inv      numeric,
  cnt_inv       int,
  total_bank    numeric,
  cnt_bank      int,
  matched       numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH inv AS (
    SELECT
      r.partner_id,
      COALESCE(SUM(r.total_amount), 0)::numeric AS total_inv,
      COALESCE(SUM(r.paid_amount), 0)::numeric  AS paid_inv,
      COUNT(*)::int                              AS cnt_inv
    FROM receivables r
    WHERE r.company_id = p_company_id
      AND r.deleted_at IS NULL
      AND (p_month IS NULL OR EXTRACT(MONTH FROM r.invoice_date)::int = p_month)
    GROUP BY r.partner_id
  ),
  bank AS (
    SELECT
      ct.partner_id,
      COALESCE(SUM(ct.amount), 0)::numeric  AS total_bank,
      COUNT(*)::int                          AS cnt_bank
    FROM cash_transactions ct
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND ct.direction  = 'income'
      AND ct.partner_id IS NOT NULL
      AND (p_month IS NULL OR EXTRACT(MONTH FROM ct.txn_date)::int = p_month)
    GROUP BY ct.partner_id
  ),
  matched AS (
    SELECT
      r.partner_id,
      COALESCE(SUM(ip.amount), 0)::numeric AS matched
    FROM receivables r
    JOIN invoice_payments ip ON ip.receivable_id = r.id
    WHERE r.company_id = p_company_id
      AND r.deleted_at IS NULL
    GROUP BY r.partner_id
  ),
  all_pids AS (
    SELECT partner_id FROM inv
    UNION
    SELECT partner_id FROM bank
  )
  SELECT
    p.id              AS partner_id,
    p.name            AS partner_name,
    p.register        AS partner_register,
    COALESCE(i.total_inv,  0) AS total_inv,
    COALESCE(i.paid_inv,   0) AS paid_inv,
    COALESCE(i.cnt_inv,    0) AS cnt_inv,
    COALESCE(b.total_bank, 0) AS total_bank,
    COALESCE(b.cnt_bank,   0) AS cnt_bank,
    COALESCE(m.matched,    0) AS matched
  FROM all_pids ap
  JOIN partners p     ON p.id = ap.partner_id
                    AND p.deleted_at IS NULL
  LEFT JOIN inv      i ON i.partner_id = ap.partner_id
  LEFT JOIN bank     b ON b.partner_id = ap.partner_id
  LEFT JOIN matched  m ON m.partner_id = ap.partner_id;
$$;

COMMENT ON FUNCTION fn_invoice_bank_recon IS
  'Харилцагч бүрд нэхэмжлэл vs банкны орлогын нийт дүн + тулгасан хэмжээг буцаана. /recon/invoices хуудсанд хэрэглэгдэнэ.';
