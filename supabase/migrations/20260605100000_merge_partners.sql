-- =============================================================================
-- fn_merge_partners — merge duplicate partners into one canonical record
-- =============================================================================
-- Port of legacy /api/partners/merge. Reassigns every partner_id foreign key
-- from the duplicate partners onto the primary, then soft-deletes the
-- duplicates. All work runs in a single transaction (the function body), so a
-- failure rolls back cleanly — no half-merged state.
--
-- Tables carrying partner_id (verified against the schema):
--   cash_transactions, vat_records, journal_lines, receivables, payables,
--   reconciliations, employees
--
-- Safety:
--   * primary is stripped from the merge list if accidentally included
--   * every id (primary + merge) must belong to p_company_id and be live
--   * partner_id is already company-scoped, so child UPDATEs filter on
--     partner_id alone (journal_lines / reconciliations have no company_id)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_merge_partners(
  p_company_id uuid,
  p_primary_id uuid,
  p_merge_ids  uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_ids   uuid[];
  v_total int;
  v_bad   int;
  v_merged int := 0;
BEGIN
  -- Never merge the primary into itself
  v_ids := array_remove(p_merge_ids, p_primary_id);

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Нэгтгэх харилцагч сонгогдоогүй');
  END IF;

  -- All ids (primary + duplicates) must be live partners of this company
  SELECT COUNT(*) INTO v_total
  FROM partners
  WHERE id = ANY(v_ids || p_primary_id)
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF v_total <> array_length(v_ids, 1) + 1 THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Зарим харилцагч энэ компанид харьяалагдахгүй эсвэл устгагдсан');
  END IF;

  -- Reassign every partner_id reference to the primary
  UPDATE cash_transactions SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE vat_records       SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE journal_lines     SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE receivables       SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE payables          SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE reconciliations   SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);
  UPDATE employees         SET partner_id = p_primary_id WHERE partner_id = ANY(v_ids);

  -- Soft-delete the now-merged duplicates
  UPDATE partners
  SET deleted_at = now(), is_active = false, updated_at = now()
  WHERE id = ANY(v_ids) AND company_id = p_company_id;
  GET DIAGNOSTICS v_merged = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'merged', v_merged);
END;
$$;

COMMENT ON FUNCTION fn_merge_partners IS
  'Давхардсан харилцагчдыг үндсэн рекорд руу нэгтгэнэ — бүх partner_id FK-г шилжүүлж, давхардлуудыг soft-delete хийнэ.';
