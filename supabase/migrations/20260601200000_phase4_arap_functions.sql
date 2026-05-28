-- =============================================================================
-- Phase 4 — AR/AP module RPCs
-- =============================================================================
-- partner_reconcile_auto_match — pair unmatched receivables with unmatched cash
--                                  by amount + date proximity
-- =============================================================================

CREATE OR REPLACE FUNCTION partner_reconcile_auto_match(
  p_partner_id uuid,
  p_amount_tolerance numeric DEFAULT 0.01,
  p_date_window_days int DEFAULT 7
)
RETURNS TABLE (
  receivable_id uuid,
  cash_txn_id uuid,
  matched_amount numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_recv record;
  v_cash record;
BEGIN
  -- For each open receivable, find first unmatched cash txn matching amount
  FOR v_recv IN
    SELECT id, total_amount, paid_amount, remaining, invoice_date, company_id
    FROM receivables
    WHERE partner_id = p_partner_id
      AND deleted_at IS NULL
      AND status IN ('open', 'partial')
      AND remaining > 0
    ORDER BY invoice_date
  LOOP
    -- Look for a cash transaction:
    --   - same partner
    --   - direction = income
    --   - not yet fully linked to invoice
    --   - amount matches receivable.remaining (within tolerance)
    --   - within date window
    SELECT id, amount, txn_date INTO v_cash
    FROM cash_transactions ct
    WHERE ct.partner_id = p_partner_id
      AND ct.direction = 'income'
      AND ct.is_reconciled = false
      AND ct.deleted_at IS NULL
      AND ABS(ct.amount - v_recv.remaining) <= p_amount_tolerance
      AND ct.txn_date BETWEEN v_recv.invoice_date - (p_date_window_days || ' days')::interval
                          AND v_recv.invoice_date + (p_date_window_days || ' days')::interval + INTERVAL '180 days'
      AND NOT EXISTS (
        SELECT 1 FROM invoice_payments ip WHERE ip.cash_txn_id = ct.id
      )
    ORDER BY ABS(ct.txn_date - v_recv.invoice_date)
    LIMIT 1;

    IF FOUND THEN
      PERFORM reconcile_invoice_payment(v_recv.id, v_cash.id, v_recv.remaining);
      receivable_id := v_recv.id;
      cash_txn_id := v_cash.id;
      matched_amount := v_recv.remaining;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION partner_reconcile_auto_match IS
  'Партнерийн нээлттэй авлагуудыг банкны орлоготой автоматаар тулгана.';

-- ---------------------------------------------------------------------------
-- create_journal_for_payable — Dr expense / Cr AP for posting payables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_journal_for_payable(
  p_payable_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_payable payables;
  v_period_id uuid;
  v_journal_id uuid;
  v_number text;
BEGIN
  SELECT * INTO v_payable FROM payables WHERE id = p_payable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payable not found'; END IF;
  IF v_payable.journal_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already has journal';
  END IF;
  IF v_payable.expense_account_id IS NULL THEN
    RAISE EXCEPTION 'Expense account not set';
  END IF;

  v_period_id := period_for_date(v_payable.company_id, v_payable.invoice_date);
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open period for %', v_payable.invoice_date;
  END IF;

  v_number := to_char(v_payable.invoice_date, 'YYYYMM') || '-AP-' || substring(p_payable_id::text, 1, 6);

  INSERT INTO journals (
    company_id, period_id, number, date, reference, description,
    status, source, source_ref, created_by, updated_by
  ) VALUES (
    v_payable.company_id, v_period_id, v_number, v_payable.invoice_date,
    v_payable.invoice_no, 'Өглөг: ' || COALESCE(v_payable.description, ''),
    'draft', 'manual', p_payable_id::text,
    auth.uid(), auth.uid()
  ) RETURNING id INTO v_journal_id;

  INSERT INTO journal_lines (journal_id, line_no, account_id, partner_id, debit, credit, description)
  VALUES
    (v_journal_id, 1, v_payable.expense_account_id, v_payable.partner_id, v_payable.amount, 0, 'Зардал'),
    (v_journal_id, 2, v_payable.ap_account_id, v_payable.partner_id, 0, v_payable.amount, 'Өглөг');

  PERFORM post_journal(v_journal_id);

  UPDATE payables SET journal_id = v_journal_id, status = 'open' WHERE id = p_payable_id;

  RETURN v_journal_id;
END;
$$;
