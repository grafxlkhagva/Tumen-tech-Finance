-- =============================================================================
-- 013 — Тайлангийн VIEW-ууд (Trial Balance, Balance Sheet, IS, CF, GL)
-- =============================================================================
-- Зөвхөн status='posted' journal-уудаас тооцоологдоно.
-- ВАЖНО: account_type-ийн дагуу balance тооцоолох логик:
--   asset, expense    → Dr нэмж, Cr хасна (debit-side normal)
--   liability, equity, income → Cr нэмж, Dr хасна (credit-side normal)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- v_account_balances — данс тус бүрийн нэгдсэн balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
  a.id              AS account_id,
  a.company_id,
  a.code,
  a.name,
  a.type,
  a.parent_id,
  a.level,
  a.is_postable,
  COALESCE(SUM(jl.debit), 0)  AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE
    WHEN a.type IN ('asset','expense')
      THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance,
  COUNT(jl.id) AS line_count
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
LEFT JOIN journals j ON j.id = jl.journal_id
  AND j.status = 'posted' AND j.deleted_at IS NULL
WHERE a.deleted_at IS NULL
GROUP BY a.id;

COMMENT ON VIEW v_account_balances IS
  'Данс тус бүрийн нэгдсэн debit/credit нийлбэр + signed balance.';

-- ---------------------------------------------------------------------------
-- v_account_balances_period — period filter-тэй
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_account_balances_period(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date   date DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  code text,
  name text,
  type account_type,
  parent_id uuid,
  level int,
  is_postable boolean,
  opening_balance numeric,
  period_debit numeric,
  period_credit numeric,
  closing_balance numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH opening AS (
    SELECT
      a.id,
      CASE
        WHEN a.type IN ('asset','expense')
          THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
        ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
      END AS bal
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journals j ON j.id = jl.journal_id AND j.status='posted'
      AND (p_start_date IS NULL OR j.date < p_start_date)
    WHERE a.company_id = p_company_id AND a.deleted_at IS NULL
    GROUP BY a.id
  ),
  period AS (
    SELECT
      a.id,
      COALESCE(SUM(jl.debit), 0)  AS pd,
      COALESCE(SUM(jl.credit), 0) AS pc
    FROM accounts a
    LEFT JOIN journal_lines jl ON jl.account_id = a.id
    LEFT JOIN journals j ON j.id = jl.journal_id AND j.status='posted'
      AND (p_start_date IS NULL OR j.date >= p_start_date)
      AND (p_end_date   IS NULL OR j.date <= p_end_date)
    WHERE a.company_id = p_company_id AND a.deleted_at IS NULL
    GROUP BY a.id
  )
  SELECT
    a.id, a.code, a.name, a.type, a.parent_id, a.level, a.is_postable,
    o.bal AS opening_balance,
    p.pd  AS period_debit,
    p.pc  AS period_credit,
    o.bal + CASE
      WHEN a.type IN ('asset','expense') THEN p.pd - p.pc
      ELSE p.pc - p.pd
    END AS closing_balance
  FROM accounts a
  LEFT JOIN opening o ON o.id = a.id
  LEFT JOIN period  p ON p.id = a.id
  WHERE a.company_id = p_company_id AND a.deleted_at IS NULL
  ORDER BY a.code;
$$;

COMMENT ON FUNCTION fn_account_balances_period IS
  'Тухайн period дотор бүх дансны нээлтийн, period debit/credit, хаалтын дүн.';

-- ---------------------------------------------------------------------------
-- v_trial_balance — Шалгах баланс
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  account_id, company_id, code, name, type, parent_id, level,
  total_debit, total_credit,
  CASE WHEN balance >= 0 THEN balance ELSE 0 END AS debit_balance,
  CASE WHEN balance <  0 THEN -balance ELSE 0 END AS credit_balance,
  balance AS signed_balance
FROM v_account_balances
WHERE is_postable = true;

COMMENT ON VIEW v_trial_balance IS
  'Шалгах баланс. Зөвхөн postable дансууд. Хагшин: SUM(debit_balance) = SUM(credit_balance).';

-- ---------------------------------------------------------------------------
-- v_balance_sheet — Баланс (asset = liability + equity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_balance_sheet AS
SELECT
  account_id, company_id, code, name, type, parent_id, level,
  balance AS amount
FROM v_account_balances
WHERE type IN ('asset', 'liability', 'equity');

-- ---------------------------------------------------------------------------
-- v_income_statement — Орлогын тайлан
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_income_statement AS
SELECT
  account_id, company_id, code, name, type, parent_id, level,
  CASE WHEN type = 'income'  THEN balance ELSE 0 END AS income,
  CASE WHEN type = 'expense' THEN balance ELSE 0 END AS expense,
  CASE
    WHEN type = 'income'  THEN balance
    WHEN type = 'expense' THEN -balance
    ELSE 0
  END AS contribution_to_profit
FROM v_account_balances
WHERE type IN ('income', 'expense');

-- ---------------------------------------------------------------------------
-- v_general_ledger — Дансны дэвтэр (бүх journal_line хагшаан)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_general_ledger AS
SELECT
  jl.id           AS line_id,
  j.company_id,
  j.period_id,
  j.id            AS journal_id,
  j.number        AS journal_number,
  j.date,
  j.source,
  j.status,
  jl.line_no,
  jl.account_id,
  a.code          AS account_code,
  a.name          AS account_name,
  a.type          AS account_type,
  jl.partner_id,
  p.name          AS partner_name,
  jl.debit,
  jl.credit,
  jl.description,
  jl.currency,
  j.reference     AS journal_reference,
  j.description   AS journal_description
FROM journal_lines jl
JOIN journals j ON j.id = jl.journal_id
JOIN accounts a ON a.id = jl.account_id
LEFT JOIN partners p ON p.id = jl.partner_id
WHERE j.status = 'posted' AND j.deleted_at IS NULL;

COMMENT ON VIEW v_general_ledger IS
  'Ерөнхий дэвтэр — posted journal-ийн бүх мөрийг flat view-р буцаана.';

-- ---------------------------------------------------------------------------
-- v_partner_balance — Харилцагч тус бүрийн өглөг/авлага
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_partner_balance AS
SELECT
  p.id                AS partner_id,
  p.company_id,
  p.name              AS partner_name,
  p.register,
  p.type              AS partner_type,
  COALESCE(SUM(CASE WHEN r.status NOT IN ('paid','cancelled','written_off')
                    THEN r.remaining ELSE 0 END), 0) AS open_receivables,
  COALESCE(SUM(CASE WHEN py.status NOT IN ('paid','cancelled','written_off')
                    THEN py.remaining ELSE 0 END), 0) AS open_payables,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status NOT IN ('paid','cancelled','written_off'))
                       AS open_receivable_count,
  COUNT(DISTINCT py.id) FILTER (WHERE py.status NOT IN ('paid','cancelled','written_off'))
                        AS open_payable_count
FROM partners p
LEFT JOIN receivables r ON r.partner_id = p.id AND r.deleted_at IS NULL
LEFT JOIN payables    py ON py.partner_id = p.id AND py.deleted_at IS NULL
WHERE p.deleted_at IS NULL
GROUP BY p.id;

-- ---------------------------------------------------------------------------
-- v_aging_receivables — Авлагын насжилт (30/60/90+)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_aging_receivables AS
SELECT
  r.id, r.company_id, r.partner_id,
  pa.name AS partner_name,
  r.invoice_no, r.invoice_date, r.due_date,
  r.total_amount, r.paid_amount, r.remaining, r.status,
  CURRENT_DATE - COALESCE(r.due_date, r.invoice_date) AS days_overdue,
  CASE
    WHEN COALESCE(r.due_date, r.invoice_date) >= CURRENT_DATE THEN 'current'
    WHEN CURRENT_DATE - COALESCE(r.due_date, r.invoice_date) <= 30  THEN '1-30'
    WHEN CURRENT_DATE - COALESCE(r.due_date, r.invoice_date) <= 60  THEN '31-60'
    WHEN CURRENT_DATE - COALESCE(r.due_date, r.invoice_date) <= 90  THEN '61-90'
    ELSE '90+'
  END AS aging_bucket
FROM receivables r
JOIN partners pa ON pa.id = r.partner_id
WHERE r.deleted_at IS NULL
  AND r.status NOT IN ('paid','cancelled','written_off');

-- ---------------------------------------------------------------------------
-- v_vat_summary — НӨАТ-ын товч тайлан (period-аар)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_vat_summary AS
SELECT
  v.company_id,
  v.direction,
  v.tax_type,
  date_trunc('month', v.date)::date AS month_start,
  COUNT(*)                          AS record_count,
  SUM(v.amount)                     AS total_amount,
  SUM(v.vat_amount)                 AS total_vat,
  SUM(v.total_amount)               AS grand_total,
  SUM(v.paid_amount)                AS paid_total,
  SUM(v.remaining)                  AS remaining_total
FROM vat_records v
WHERE v.deleted_at IS NULL
GROUP BY v.company_id, v.direction, v.tax_type, date_trunc('month', v.date);

-- ---------------------------------------------------------------------------
-- v_fixed_asset_register — Үндсэн хөрөнгийн бүртгэл
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_fixed_asset_register AS
SELECT
  fa.id, fa.company_id, fa.code, fa.name, fa.category,
  fa.purchase_date, fa.purchase_amount,
  fa.useful_life_months, fa.salvage_value,
  fa.accumulated_depreciation, fa.net_book_value, fa.monthly_depreciation,
  fa.status, fa.location, fa.responsible_person,
  EXTRACT(YEAR FROM age(CURRENT_DATE, fa.purchase_date))::int * 12 +
    EXTRACT(MONTH FROM age(CURRENT_DATE, fa.purchase_date))::int AS months_in_use,
  CASE
    WHEN fa.useful_life_months > 0
      THEN ROUND(100.0 * fa.accumulated_depreciation / NULLIF(fa.purchase_amount - fa.salvage_value, 0), 2)
    ELSE 0
  END AS depreciation_pct
FROM fixed_assets fa
WHERE fa.deleted_at IS NULL;
