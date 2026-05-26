-- =============================================================================
-- 012 — Business logic функцууд
-- =============================================================================
-- post_journal, reverse_journal, close_period, calculate_depreciation,
-- calculate_payroll, reconcile_vat_cash, reconcile_invoice_payment г.м.
-- Бүгд atomic transaction дотор ажиллах ёстой (RAISE EXCEPTION → rollback).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- POST JOURNAL — draft → posted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_journal(p_journal_id uuid)
RETURNS journals
LANGUAGE plpgsql
AS $$
DECLARE
  v_journal     journals;
  v_debit_sum   numeric(18,2);
  v_credit_sum  numeric(18,2);
  v_line_count  int;
BEGIN
  -- Lock journal
  SELECT * INTO v_journal FROM journals WHERE id = p_journal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal % not found', p_journal_id;
  END IF;

  IF v_journal.status <> 'draft' THEN
    RAISE EXCEPTION 'Journal % is not draft (status: %)', v_journal.number, v_journal.status;
  END IF;

  -- Period нь open байх ёстой
  PERFORM 1 FROM periods WHERE id = v_journal.period_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period of journal % is not open', v_journal.number;
  END IF;

  -- Lines нийлэх ёстой
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COUNT(*)
  INTO v_debit_sum, v_credit_sum, v_line_count
  FROM journal_lines
  WHERE journal_id = p_journal_id;

  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Journal % must have at least 2 lines (has %)', v_journal.number, v_line_count;
  END IF;

  IF v_debit_sum <> v_credit_sum THEN
    RAISE EXCEPTION 'Unbalanced journal %: debit=%, credit=%, diff=%',
      v_journal.number, v_debit_sum, v_credit_sum, (v_debit_sum - v_credit_sum);
  END IF;

  IF v_debit_sum = 0 THEN
    RAISE EXCEPTION 'Journal % has zero amount', v_journal.number;
  END IF;

  -- Update header
  UPDATE journals
    SET status = 'posted',
        posted_at = now(),
        posted_by = auth.uid(),
        total_debit = v_debit_sum,
        total_credit = v_credit_sum,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = p_journal_id
    RETURNING * INTO v_journal;

  RETURN v_journal;
END;
$$;

COMMENT ON FUNCTION post_journal IS
  'Draft journal-ийг posted болгоно. Balance шалгана, period open эсэхийг шалгана, atomic.';

-- ---------------------------------------------------------------------------
-- REVERSE JOURNAL — posted journal-д сөрөг бичилт үүсгэх
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reverse_journal(
  p_journal_id  uuid,
  p_reason      text,
  p_date        date DEFAULT NULL
)
RETURNS journals
LANGUAGE plpgsql
AS $$
DECLARE
  v_original    journals;
  v_reversal    journals;
  v_period_id   uuid;
  v_new_number  text;
BEGIN
  -- Lock and validate
  SELECT * INTO v_original FROM journals WHERE id = p_journal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal % not found', p_journal_id;
  END IF;

  IF v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journals can be reversed (status: %)', v_original.status;
  END IF;

  IF v_original.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Journal % already reversed', v_original.number;
  END IF;

  -- Reversal date
  p_date := COALESCE(p_date, CURRENT_DATE);
  v_period_id := period_for_date(v_original.company_id, p_date);
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open period for reversal date %', p_date;
  END IF;

  -- Шинэ дугаар
  v_new_number := v_original.number || '-R';

  -- Reversal header
  INSERT INTO journals (
    company_id, period_id, number, date, reference, description,
    status, source, source_ref,
    total_debit, total_credit, currency, exchange_rate,
    notes, created_by, updated_by
  ) VALUES (
    v_original.company_id, v_period_id, v_new_number, p_date,
    v_original.reference,
    'REVERSE: ' || COALESCE(v_original.description, ''),
    'draft',
    'reversal',
    v_original.id::text,
    v_original.total_credit,  -- swap
    v_original.total_debit,
    v_original.currency,
    v_original.exchange_rate,
    p_reason,
    auth.uid(), auth.uid()
  )
  RETURNING * INTO v_reversal;

  -- Lines-ийг хөрвүүлж копидох (Dr ↔ Cr swap)
  INSERT INTO journal_lines (
    journal_id, line_no, account_id, partner_id,
    debit, credit, description, currency, fx_debit, fx_credit
  )
  SELECT
    v_reversal.id, line_no, account_id, partner_id,
    credit AS debit,    -- SWAP
    debit  AS credit,   -- SWAP
    'REVERSE: ' || COALESCE(description, ''),
    currency, fx_credit, fx_debit
  FROM journal_lines
  WHERE journal_id = p_journal_id;

  -- Reversal-ийг post хийх
  v_reversal := post_journal(v_reversal.id);

  -- Original-д mark хийх
  UPDATE journals
    SET reversed_at = now(),
        reversed_by_journal_id = v_reversal.id,
        reversal_reason = p_reason
    WHERE id = p_journal_id;

  RETURN v_reversal;
END;
$$;

COMMENT ON FUNCTION reverse_journal IS
  'Posted journal-ийг буцаах. Swap (Dr↔Cr) бүхий шинэ journal үүсгэж posted болгоно.';

-- ---------------------------------------------------------------------------
-- CLOSE PERIOD
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION close_period(p_period_id uuid)
RETURNS periods
LANGUAGE plpgsql
AS $$
DECLARE
  v_period      periods;
  v_draft_count int;
BEGIN
  SELECT * INTO v_period FROM periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period % not found', p_period_id;
  END IF;

  IF v_period.status <> 'open' THEN
    RAISE EXCEPTION 'Period is already %', v_period.status;
  END IF;

  -- Draft journal-ууд үлдсэн эсэхийг шалгах
  SELECT COUNT(*) INTO v_draft_count
    FROM journals
    WHERE period_id = p_period_id AND status = 'draft' AND deleted_at IS NULL;

  IF v_draft_count > 0 THEN
    RAISE EXCEPTION 'Cannot close period: % draft journals still exist', v_draft_count;
  END IF;

  UPDATE periods
    SET status = 'closed',
        closed_at = now(),
        closed_by = auth.uid()
    WHERE id = p_period_id
    RETURNING * INTO v_period;

  RETURN v_period;
END;
$$;

COMMENT ON FUNCTION close_period IS
  'Period-ийг хаах. Draft journal үлдсэн бол алдаа гаргана.';

-- ---------------------------------------------------------------------------
-- REOPEN PERIOD (admin only — RLS-аар хязгаарлана)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reopen_period(p_period_id uuid, p_reason text)
RETURNS periods
LANGUAGE plpgsql
AS $$
DECLARE
  v_period periods;
BEGIN
  SELECT * INTO v_period FROM periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period not found';
  END IF;

  IF v_period.status = 'locked' THEN
    RAISE EXCEPTION 'Period is locked (audited) — cannot reopen';
  END IF;

  UPDATE periods
    SET status = 'open',
        closed_at = NULL,
        closed_by = NULL,
        notes = COALESCE(notes, '') || E'\nReopened: ' || p_reason
    WHERE id = p_period_id
    RETURNING * INTO v_period;

  RETURN v_period;
END;
$$;

-- ---------------------------------------------------------------------------
-- CALCULATE DEPRECIATION — сар бүрийн элэгдэл
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_depreciation(p_period_id uuid)
RETURNS TABLE (
  asset_id uuid,
  asset_code text,
  depreciation_amount numeric,
  journal_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_period      periods;
  v_asset       fixed_assets;
  v_dep_amount  numeric(18,2);
  v_journal_id  uuid;
  v_number      text;
  v_existing    uuid;
BEGIN
  SELECT * INTO v_period FROM periods WHERE id = p_period_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Period not found';
  END IF;
  IF v_period.status <> 'open' THEN
    RAISE EXCEPTION 'Period is not open';
  END IF;

  FOR v_asset IN
    SELECT * FROM fixed_assets
    WHERE company_id = v_period.company_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND purchase_date <= v_period.end_date
      AND accumulated_depreciation < (purchase_amount - salvage_value)
  LOOP
    -- Тухайн сард аль хэдийн тооцоологдсон эсэхийг шалгах
    SELECT id INTO v_existing FROM depreciation_schedule
      WHERE asset_id = v_asset.id
        AND year = v_period.year AND month = v_period.month;
    CONTINUE WHEN v_existing IS NOT NULL;

    -- Тооцоо
    v_dep_amount := LEAST(
      v_asset.monthly_depreciation,
      v_asset.purchase_amount - v_asset.salvage_value - v_asset.accumulated_depreciation
    );

    IF v_dep_amount <= 0 THEN CONTINUE; END IF;

    -- Журнал үүсгэх
    v_number := to_char(v_period.year, 'FM0000') || lpad(v_period.month::text, 2, '0')
                || '-DEP-' || COALESCE(v_asset.code, v_asset.id::text);

    INSERT INTO journals (
      company_id, period_id, number, date, description, status, source, source_ref,
      created_by, updated_by
    ) VALUES (
      v_period.company_id, p_period_id, v_number, v_period.end_date,
      'Depreciation: ' || v_asset.name,
      'draft', 'depreciation', v_asset.id::text,
      auth.uid(), auth.uid()
    )
    RETURNING id INTO v_journal_id;

    -- Lines: Dr Зардал / Cr Хуримтлагдсан элэгдэл
    INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description)
    VALUES
      (v_journal_id, 1, v_asset.expense_account_id, v_dep_amount, 0,
       'Depreciation expense: ' || v_asset.name),
      (v_journal_id, 2, v_asset.depreciation_account_id, 0, v_dep_amount,
       'Accumulated depreciation: ' || v_asset.name);

    -- Auto-post
    PERFORM post_journal(v_journal_id);

    -- Asset-ийн accumulated шинэчлэх
    UPDATE fixed_assets
      SET accumulated_depreciation = accumulated_depreciation + v_dep_amount
      WHERE id = v_asset.id;

    -- Schedule entry
    INSERT INTO depreciation_schedule (
      company_id, asset_id, period_id, year, month,
      depreciation_amount, accumulated_before, accumulated_after, net_book_value_after,
      journal_id, posted_at, posted_by
    ) VALUES (
      v_period.company_id, v_asset.id, p_period_id, v_period.year, v_period.month,
      v_dep_amount, v_asset.accumulated_depreciation,
      v_asset.accumulated_depreciation + v_dep_amount,
      v_asset.purchase_amount - (v_asset.accumulated_depreciation + v_dep_amount),
      v_journal_id, now(), auth.uid()
    );

    -- Буцаах
    asset_id := v_asset.id;
    asset_code := v_asset.code;
    depreciation_amount := v_dep_amount;
    journal_id := v_journal_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION calculate_depreciation IS
  'Period-ийн бүх active asset-д шугаман депресцийн журнал автоматаар үүсгэнэ.';

-- ---------------------------------------------------------------------------
-- CREATE JOURNAL FROM CASH TRANSACTION
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_journal_from_cash(p_cash_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_cash        cash_transactions;
  v_bank_acc    bank_accounts;
  v_period_id   uuid;
  v_journal_id  uuid;
  v_number      text;
  v_debit_acc   uuid;
  v_credit_acc  uuid;
BEGIN
  SELECT * INTO v_cash FROM cash_transactions WHERE id = p_cash_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cash transaction not found'; END IF;
  IF v_cash.journal_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cash transaction % already has journal', p_cash_id;
  END IF;
  IF v_cash.contra_account_id IS NULL THEN
    RAISE EXCEPTION 'Contra account not set for cash transaction %', p_cash_id;
  END IF;

  SELECT * INTO v_bank_acc FROM bank_accounts WHERE id = v_cash.bank_account_id;

  -- Period
  v_period_id := period_for_date(v_cash.company_id, v_cash.txn_date);
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No period for date %', v_cash.txn_date;
  END IF;

  -- Account direction
  IF v_cash.direction = 'income' THEN
    v_debit_acc  := v_bank_acc.gl_account_id;     -- Dr Bank
    v_credit_acc := v_cash.contra_account_id;     -- Cr Income/Liability
  ELSE
    v_debit_acc  := v_cash.contra_account_id;     -- Dr Expense/Asset
    v_credit_acc := v_bank_acc.gl_account_id;     -- Cr Bank
  END IF;

  v_number := to_char(v_cash.txn_date, 'YYYYMM') || '-CASH-' || substr(p_cash_id::text, 1, 8);

  INSERT INTO journals (
    company_id, period_id, number, date, reference, description,
    status, source, source_ref, currency, exchange_rate,
    created_by, updated_by
  ) VALUES (
    v_cash.company_id, v_period_id, v_number, v_cash.txn_date,
    v_cash.reference, COALESCE(v_cash.description, 'Bank transaction'),
    'draft', 'cash_import', p_cash_id::text,
    v_cash.currency, v_cash.exchange_rate,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_journal_id;

  INSERT INTO journal_lines (journal_id, line_no, account_id, partner_id, debit, credit, description)
  VALUES
    (v_journal_id, 1, v_debit_acc, v_cash.partner_id, v_cash.amount, 0, v_cash.description),
    (v_journal_id, 2, v_credit_acc, v_cash.partner_id, 0, v_cash.amount, v_cash.description);

  PERFORM post_journal(v_journal_id);

  UPDATE cash_transactions SET journal_id = v_journal_id WHERE id = p_cash_id;

  RETURN v_journal_id;
END;
$$;

COMMENT ON FUNCTION create_journal_from_cash IS
  'Cash transaction-аас journal үүсгэж post хийнэ. contra_account_id заавал тогтоогдсон байх ёстой.';

-- ---------------------------------------------------------------------------
-- RECONCILE INVOICE PAYMENT — нэхэмжлэх ↔ cash холбох
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reconcile_invoice_payment(
  p_receivable_id uuid,
  p_cash_txn_id   uuid,
  p_amount        numeric
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_recv        receivables;
  v_cash        cash_transactions;
  v_payment_id  uuid;
  v_new_paid    numeric(18,2);
  v_new_status  ar_ap_status;
BEGIN
  SELECT * INTO v_recv FROM receivables WHERE id = p_receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receivable not found'; END IF;

  SELECT * INTO v_cash FROM cash_transactions WHERE id = p_cash_txn_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cash transaction not found'; END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be > 0';
  END IF;

  v_new_paid := v_recv.paid_amount + p_amount;
  IF v_new_paid > v_recv.total_amount THEN
    RAISE EXCEPTION 'Overpayment: receivable total %, already paid %, attempt %',
      v_recv.total_amount, v_recv.paid_amount, p_amount;
  END IF;

  -- Payment бичлэг
  INSERT INTO invoice_payments (
    company_id, receivable_id, cash_txn_id, amount, payment_date, created_by
  ) VALUES (
    v_recv.company_id, p_receivable_id, p_cash_txn_id, p_amount, v_cash.txn_date, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  -- Receivable шинэчлэх
  v_new_status := CASE
    WHEN v_new_paid >= v_recv.total_amount THEN 'paid'::ar_ap_status
    ELSE 'partial'::ar_ap_status
  END;

  UPDATE receivables
    SET paid_amount = v_new_paid,
        status = v_new_status
    WHERE id = p_receivable_id;

  -- Cash transaction-ийг reconciled тэмдэглэх
  UPDATE cash_transactions SET is_reconciled = true WHERE id = p_cash_txn_id;

  RETURN v_payment_id;
END;
$$;

COMMENT ON FUNCTION reconcile_invoice_payment IS
  'Receivable-д cash transaction-ийн нэг хэсгийг payment-аар бүртгэнэ.';
