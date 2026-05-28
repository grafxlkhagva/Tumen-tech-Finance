-- =============================================================================
-- Phase 2 — Cash module: auto-link + batch journal RPCs
-- =============================================================================
-- Defines:
--   auto_link_cash_transactions(p_company_id)     — apply category→GL rules
--   cash_batch_journal(p_company_id, p_year, p_month) — month-end batch journal
-- =============================================================================

-- ---------------------------------------------------------------------------
-- auto_link_cash_transactions
-- For unreconciled cash transactions with a category but no contra_account_id,
-- look up cash_category_rules and set contra_account_id + partner_id (via fuzzy
-- match on description).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_link_cash_transactions(p_company_id uuid)
RETURNS TABLE (
  linked_count int,
  partner_matched_count int
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_linked int := 0;
  v_partnered int := 0;
  v_row cash_transactions%ROWTYPE;
  v_rule cash_category_rules%ROWTYPE;
  v_partner_match record;
BEGIN
  FOR v_row IN
    SELECT * FROM cash_transactions
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND contra_account_id IS NULL
      AND category IS NOT NULL
  LOOP
    -- Find matching rule (category + direction)
    SELECT * INTO v_rule
    FROM cash_category_rules
    WHERE company_id = p_company_id
      AND category = v_row.category
      AND direction = v_row.direction
      AND is_active = true
    ORDER BY priority
    LIMIT 1;

    IF FOUND THEN
      UPDATE cash_transactions
        SET contra_account_id = v_rule.contra_account_id
        WHERE id = v_row.id;
      v_linked := v_linked + 1;
    END IF;

    -- Try partner match if not already set
    IF v_row.partner_id IS NULL AND v_row.partner_name IS NOT NULL THEN
      SELECT * INTO v_partner_match
      FROM find_partner_by_name(p_company_id, v_row.partner_name, 0.5)
      LIMIT 1;

      IF FOUND THEN
        UPDATE cash_transactions
          SET partner_id = v_partner_match.partner_id
          WHERE id = v_row.id;
        v_partnered := v_partnered + 1;
      END IF;
    END IF;
  END LOOP;

  linked_count := v_linked;
  partner_matched_count := v_partnered;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION auto_link_cash_transactions IS
  'Cash txn-уудад category-аас GL data автоматаар тогтоо ба partner-ийг fuzzy match хий.';

-- ---------------------------------------------------------------------------
-- cash_batch_journal
-- For a given period (year, month), creates one summary journal:
--   - Aggregates all unreconciled cash txns by (bank_gl_account, contra_account)
--   - Sums into 2 lines per pair (Dr bank/Cr contra OR Dr contra/Cr bank)
--   - Links all source txns to this journal
--   - Posts it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cash_batch_journal(
  p_company_id uuid,
  p_year int,
  p_month int
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_id uuid;
  v_period_end date;
  v_journal_id uuid;
  v_number text;
  v_line_no int := 0;
  v_count int;
  v_pair record;
BEGIN
  -- Resolve period
  SELECT id, end_date INTO v_period_id, v_period_end
  FROM periods
  WHERE company_id = p_company_id AND year = p_year AND month = p_month
    AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open period not found for %-%', p_year, p_month;
  END IF;

  -- Check we have unreconciled cash with full GL info
  SELECT COUNT(*) INTO v_count
  FROM cash_transactions
  WHERE company_id = p_company_id
    AND deleted_at IS NULL
    AND journal_id IS NULL
    AND contra_account_id IS NOT NULL
    AND EXTRACT(YEAR FROM txn_date) = p_year
    AND EXTRACT(MONTH FROM txn_date) = p_month;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No cash transactions ready for batching in %-%', p_year, p_month;
  END IF;

  -- Create journal header
  v_number := 'BNK-' || p_year || '-' || lpad(p_month::text, 2, '0');
  INSERT INTO journals (
    company_id, period_id, number, date, description,
    status, source, total_debit, total_credit, created_by, updated_by
  ) VALUES (
    p_company_id, v_period_id, v_number, v_period_end,
    'Сарын кассын батч (' || p_year || '-' || lpad(p_month::text, 2, '0') || ')',
    'draft', 'cash_import',
    0, 0,
    auth.uid(), auth.uid()
  ) RETURNING id INTO v_journal_id;

  -- Aggregate income lines: Dr bank / Cr contra
  FOR v_pair IN
    SELECT ba.gl_account_id AS bank_acc,
           ct.contra_account_id AS contra_acc,
           SUM(ct.amount) AS total
    FROM cash_transactions ct
    JOIN bank_accounts ba ON ba.id = ct.bank_account_id
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND ct.journal_id IS NULL
      AND ct.contra_account_id IS NOT NULL
      AND ct.direction = 'income'
      AND EXTRACT(YEAR FROM ct.txn_date) = p_year
      AND EXTRACT(MONTH FROM ct.txn_date) = p_month
    GROUP BY ba.gl_account_id, ct.contra_account_id
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description)
    VALUES (v_journal_id, v_line_no, v_pair.bank_acc, v_pair.total, 0,
            'Кассын орлого ' || p_year || '-' || lpad(p_month::text, 2, '0'));
    v_line_no := v_line_no + 1;
    INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description)
    VALUES (v_journal_id, v_line_no, v_pair.contra_acc, 0, v_pair.total,
            'Кассын орлого ' || p_year || '-' || lpad(p_month::text, 2, '0'));
  END LOOP;

  -- Aggregate expense lines: Dr contra / Cr bank
  FOR v_pair IN
    SELECT ba.gl_account_id AS bank_acc,
           ct.contra_account_id AS contra_acc,
           SUM(ct.amount) AS total
    FROM cash_transactions ct
    JOIN bank_accounts ba ON ba.id = ct.bank_account_id
    WHERE ct.company_id = p_company_id
      AND ct.deleted_at IS NULL
      AND ct.journal_id IS NULL
      AND ct.contra_account_id IS NOT NULL
      AND ct.direction = 'expense'
      AND EXTRACT(YEAR FROM ct.txn_date) = p_year
      AND EXTRACT(MONTH FROM ct.txn_date) = p_month
    GROUP BY ba.gl_account_id, ct.contra_account_id
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description)
    VALUES (v_journal_id, v_line_no, v_pair.contra_acc, v_pair.total, 0,
            'Кассын зарлага ' || p_year || '-' || lpad(p_month::text, 2, '0'));
    v_line_no := v_line_no + 1;
    INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description)
    VALUES (v_journal_id, v_line_no, v_pair.bank_acc, 0, v_pair.total,
            'Кассын зарлага ' || p_year || '-' || lpad(p_month::text, 2, '0'));
  END LOOP;

  -- Link all source txns to this journal
  UPDATE cash_transactions
    SET journal_id = v_journal_id
    WHERE company_id = p_company_id
      AND deleted_at IS NULL
      AND journal_id IS NULL
      AND contra_account_id IS NOT NULL
      AND EXTRACT(YEAR FROM txn_date) = p_year
      AND EXTRACT(MONTH FROM txn_date) = p_month;

  -- Post (validates balance)
  PERFORM post_journal(v_journal_id);

  RETURN v_journal_id;
END;
$$;

COMMENT ON FUNCTION cash_batch_journal IS
  'Сарын reconciled cash txn-уудаас 1 BNK-YYYY-MM журнал үүсгэж post хий.';
