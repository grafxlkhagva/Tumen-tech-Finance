-- =============================================================================
-- 014 — Row-Level Security policies (multi-tenancy + role-based)
-- =============================================================================
-- Зарчим:
--   1. Хэрэглэгч зөвхөн өөрийн харъяалагдах company-ын мөрүүдийг харна.
--   2. WRITE эрх нь company role-аас хамаарна (admin/accountant write, бусад read-only).
--   3. service_role нь бүх RLS-ийг bypass хийнэ (admin tooling, edge functions-д).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- COMPANIES — өөрийн харъяалагдах компанийг л харна
-- ---------------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select ON companies FOR SELECT
  USING (id IN (SELECT auth_company_ids()));

CREATE POLICY companies_update ON companies FOR UPDATE
  USING (auth_has_role(id, 'admin'))
  WITH CHECK (auth_has_role(id, 'admin'));

-- Insert/Delete — зөвхөн service_role-р хийнэ

-- ---------------------------------------------------------------------------
-- USER_COMPANIES — өөрийнхөө бичлэгийг л харна, admin л өөрчилнө
-- ---------------------------------------------------------------------------
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_companies_select ON user_companies FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth_has_role(company_id, 'admin')
  );

CREATE POLICY user_companies_admin_write ON user_companies FOR ALL
  USING (auth_has_role(company_id, 'admin'))
  WITH CHECK (auth_has_role(company_id, 'admin'));

-- ---------------------------------------------------------------------------
-- PERIODS — бүх role read, зөвхөн admin/accountant write
-- ---------------------------------------------------------------------------
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY periods_select ON periods FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY periods_write ON periods FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- ACCOUNTS — read for all, write for admin/accountant
-- ---------------------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_select ON accounts FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY accounts_write ON accounts FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- PARTNERS
-- ---------------------------------------------------------------------------
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY partners_select ON partners FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY partners_write ON partners FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- JOURNALS + JOURNAL_LINES
-- ---------------------------------------------------------------------------
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY journals_select ON journals FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY journals_insert ON journals FOR INSERT
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

CREATE POLICY journals_update ON journals FOR UPDATE
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- DELETE: зөвхөн admin, мөн status='draft' үед
CREATE POLICY journals_delete ON journals FOR DELETE
  USING (
    status = 'draft'
    AND auth_has_role(company_id, 'admin')
  );

ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY journal_lines_select ON journal_lines FOR SELECT
  USING (
    journal_id IN (
      SELECT id FROM journals WHERE company_id IN (SELECT auth_company_ids())
    )
  );

CREATE POLICY journal_lines_write ON journal_lines FOR ALL
  USING (
    journal_id IN (
      SELECT id FROM journals
      WHERE auth_has_role(company_id, 'admin', 'accountant')
    )
  )
  WITH CHECK (
    journal_id IN (
      SELECT id FROM journals
      WHERE auth_has_role(company_id, 'admin', 'accountant')
    )
  );

-- ---------------------------------------------------------------------------
-- BANK_ACCOUNTS + CASH_TRANSACTIONS
-- ---------------------------------------------------------------------------
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_accounts_select ON bank_accounts FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY bank_accounts_write ON bank_accounts FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_select ON cash_transactions FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY cash_write ON cash_transactions FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE cash_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_rules_select ON cash_category_rules FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY cash_rules_write ON cash_category_rules FOR ALL
  USING (auth_has_role(company_id, 'admin'))
  WITH CHECK (auth_has_role(company_id, 'admin'));

-- ---------------------------------------------------------------------------
-- VAT_RECORDS
-- ---------------------------------------------------------------------------
ALTER TABLE vat_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY vat_select ON vat_records FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY vat_write ON vat_records FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- RECEIVABLES + PAYABLES + INVOICE_PAYMENTS
-- ---------------------------------------------------------------------------
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY receivables_select ON receivables FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY receivables_write ON receivables FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY payables_select ON payables FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY payables_write ON payables FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payments_select ON invoice_payments FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY invoice_payments_write ON invoice_payments FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- EMPLOYEES + SALARY_RECORDS — нэмэлт хязгаарлалт (PII)
-- ---------------------------------------------------------------------------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select ON employees FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY employees_write ON employees FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

-- Цалин: бусдын цалин зөвхөн admin/accountant харна, өөрийн цалинг бүгд харна
CREATE POLICY salary_select_self_or_admin ON salary_records FOR SELECT
  USING (
    auth_has_role(company_id, 'admin', 'accountant', 'auditor')
    OR employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY salary_write ON salary_records FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- FIXED_ASSETS + DEPRECIATION_SCHEDULE
-- ---------------------------------------------------------------------------
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select ON fixed_assets FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY assets_write ON fixed_assets FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY depschedule_select ON depreciation_schedule FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY depschedule_write ON depreciation_schedule FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

-- ---------------------------------------------------------------------------
-- RECONCILIATIONS + MATCH_RULES
-- ---------------------------------------------------------------------------
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY recon_select ON reconciliations FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY recon_write ON reconciliations FOR ALL
  USING (auth_has_role(company_id, 'admin', 'accountant'))
  WITH CHECK (auth_has_role(company_id, 'admin', 'accountant'));

ALTER TABLE match_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY match_rules_select ON match_rules FOR SELECT
  USING (company_id IN (SELECT auth_company_ids()));

CREATE POLICY match_rules_write ON match_rules FOR ALL
  USING (auth_has_role(company_id, 'admin'))
  WITH CHECK (auth_has_role(company_id, 'admin'));

-- ---------------------------------------------------------------------------
-- AUDIT_LOG — read-only for admin/auditor, no write (триггерээр л бичигдэнэ)
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON audit_log FOR SELECT
  USING (
    company_id IS NULL  -- system-wide actions
    OR auth_has_role(company_id, 'admin', 'auditor')
  );

-- Audit log өөр policy байхгүй (триггер SECURITY DEFINER-аар бичнэ)
