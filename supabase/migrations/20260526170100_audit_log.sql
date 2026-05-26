-- =============================================================================
-- 002 — Audit log: бүх change-ийг хадгалах
-- =============================================================================
-- Санхүүгийн систем дэх журналын мөнгөн өөрчлөлт бүрийг хэн, хэзээ, юу
-- өөрчилснийг lock хийгээгүй (immutable) форматаар хадгална.
-- =============================================================================

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  table_name    text NOT NULL,
  record_id     uuid NOT NULL,
  company_id    uuid REFERENCES companies(id),
  action        text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data      jsonb,
  new_data      jsonb,
  changed_fields text[],
  changed_by    uuid REFERENCES auth.users(id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  ip_address    inet,
  user_agent    text,
  client_info   jsonb
);

CREATE INDEX ix_audit_log_table_record   ON audit_log (table_name, record_id);
CREATE INDEX ix_audit_log_company_time   ON audit_log (company_id, changed_at DESC);
CREATE INDEX ix_audit_log_user_time      ON audit_log (changed_by, changed_at DESC);
CREATE INDEX ix_audit_log_action         ON audit_log (action);

COMMENT ON TABLE audit_log IS
  'Бүх financial хүснэгтийн өөрчлөлтийн түүх. UPDATE/DELETE боломжгүй (append-only).';

-- ---------------------------------------------------------------------------
-- Generic audit trigger function — бусад хүснэгт дээр attach хийнэ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old           jsonb;
  v_new           jsonb;
  v_changed       text[];
  v_company_id    uuid;
  v_record_id     uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := (OLD).id;
    v_company_id := COALESCE((v_old->>'company_id')::uuid, NULL);
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
    v_company_id := COALESCE((v_new->>'company_id')::uuid, NULL);
  ELSE  -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
    v_company_id := COALESCE((v_new->>'company_id')::uuid, NULL);
    SELECT array_agg(key)
      INTO v_changed
      FROM jsonb_each(v_new)
     WHERE v_old->key IS DISTINCT FROM v_new->key
       AND key NOT IN ('updated_at');
  END IF;

  INSERT INTO audit_log (
    table_name, record_id, company_id, action,
    old_data, new_data, changed_fields, changed_by
  ) VALUES (
    TG_TABLE_NAME, v_record_id, v_company_id, TG_OP,
    v_old, v_new, v_changed, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION audit_row_change IS
  'Generic audit trigger. Хүснэгт бүрийн INSERT/UPDATE/DELETE-д хавсаргана.';

-- ---------------------------------------------------------------------------
-- audit_log өөрөө хувирах боломжгүй (append-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. Cannot % rows.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER tr_audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE TRIGGER tr_audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
