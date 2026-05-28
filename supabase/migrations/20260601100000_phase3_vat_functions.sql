-- =============================================================================
-- Phase 3 — VAT module RPCs
-- =============================================================================
-- vat_make_invoice — single VAT (outbound) → Receivable + posted Journal
-- vat_bulk_make_invoices — batch version
-- =============================================================================

-- ---------------------------------------------------------------------------
-- vat_make_invoice
-- Given an outbound VAT record + (partner, AR account, income account, VAT account),
-- creates: 1 receivable + 1 journal (Dr AR / Cr income, Cr VAT) and links them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vat_make_invoice(
  p_vat_id        uuid,
  p_partner_id    uuid,
  p_ar_account    uuid,
  p_income_account uuid,
  p_vat_account   uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_vat       vat_records;
  v_period_id uuid;
  v_journal_id uuid;
  v_recv_id   uuid;
  v_number    text;
BEGIN
  SELECT * INTO v_vat FROM vat_records WHERE id = p_vat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VAT record %', p_vat_id; END IF;
  IF v_vat.direction <> 'outbound' THEN
    RAISE EXCEPTION 'Only outbound VAT can become invoice';
  END IF;
  IF v_vat.receivable_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already linked to receivable';
  END IF;

  -- Resolve period for the VAT date
  v_period_id := period_for_date(v_vat.company_id, v_vat.date);
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open period for %', v_vat.date;
  END IF;

  -- Create receivable
  INSERT INTO receivables (
    company_id, partner_id, invoice_no, invoice_date,
    amount, vat_amount, total_amount, status,
    vat_record_id, ar_account_id, income_account_id,
    description, created_by, updated_by
  ) VALUES (
    v_vat.company_id, p_partner_id,
    COALESCE(v_vat.invoice_no, v_vat.ddtd, 'VAT-' || substring(p_vat_id::text, 1, 8)),
    v_vat.date,
    v_vat.amount, v_vat.vat_amount, v_vat.total_amount, 'open',
    p_vat_id, p_ar_account, p_income_account,
    'eBarimt: ' || COALESCE(v_vat.ddtd, ''),
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_recv_id;

  -- Create journal: Dr AR / Cr Income, Cr VAT
  v_number := to_char(v_vat.date, 'YYYYMM') || '-VAT-' || substring(p_vat_id::text, 1, 6);
  INSERT INTO journals (
    company_id, period_id, number, date, reference, description,
    status, source, source_ref, created_by, updated_by
  ) VALUES (
    v_vat.company_id, v_period_id, v_number, v_vat.date,
    v_vat.ddtd, 'НӨАТ нэхэмжлэх: ' || COALESCE(v_vat.partner_name, ''),
    'draft', 'vat', p_vat_id::text,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_journal_id;

  -- Lines
  INSERT INTO journal_lines (journal_id, line_no, account_id, partner_id, debit, credit, description)
  VALUES
    (v_journal_id, 1, p_ar_account, p_partner_id, v_vat.total_amount, 0, 'НӨАТ авлага'),
    (v_journal_id, 2, p_income_account, p_partner_id, 0, v_vat.amount, 'Борлуулалт');

  IF v_vat.vat_amount > 0 THEN
    INSERT INTO journal_lines (journal_id, line_no, account_id, partner_id, debit, credit, description)
    VALUES (v_journal_id, 3, p_vat_account, p_partner_id, 0, v_vat.vat_amount, 'НӨАТ');
  END IF;

  -- Post
  PERFORM post_journal(v_journal_id);

  -- Link
  UPDATE vat_records
    SET receivable_id = v_recv_id, journal_id = v_journal_id,
        partner_id = p_partner_id, status = 'matched'
    WHERE id = p_vat_id;
  UPDATE receivables
    SET journal_id = v_journal_id
    WHERE id = v_recv_id;

  RETURN v_recv_id;
END;
$$;

COMMENT ON FUNCTION vat_make_invoice IS
  'Outbound VAT-аас Receivable + posted journal үүсгэж холбоно.';

-- ---------------------------------------------------------------------------
-- vat_bulk_make_invoices
-- Apply vat_make_invoice to a list of VAT ids with default partner/account map.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vat_bulk_make_invoices(
  p_vat_ids uuid[],
  p_partner_id uuid,
  p_ar_account uuid,
  p_income_account uuid,
  p_vat_account uuid
)
RETURNS TABLE (
  vat_id uuid,
  receivable_id uuid,
  status text,
  error text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_vat_id uuid;
  v_recv uuid;
BEGIN
  FOREACH v_vat_id IN ARRAY p_vat_ids LOOP
    BEGIN
      v_recv := vat_make_invoice(v_vat_id, p_partner_id, p_ar_account, p_income_account, p_vat_account);
      vat_id := v_vat_id;
      receivable_id := v_recv;
      status := 'ok';
      error := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      vat_id := v_vat_id;
      receivable_id := NULL;
      status := 'failed';
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;
