-- =============================================================================
-- Phase 5 — Payroll module RPCs
-- =============================================================================
-- calc_salary_row(...)         — single salary computation (TS twin: calcSalary)
-- calculate_payroll(...)        — batch: writes draft salary_records for company+month
-- post_salary_batch(...)        — for approved records → posted journals
-- =============================================================================

-- ---------------------------------------------------------------------------
-- art231 helper (Article 23.1 — sliding deduction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION art231(p_income numeric)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_income <=   500000 THEN 20000
    WHEN p_income <= 1000000 THEN 18000
    WHEN p_income <= 1500000 THEN 16000
    WHEN p_income <= 2000000 THEN 14000
    WHEN p_income <= 2500000 THEN 12000
    WHEN p_income <= 3000000 THEN 10000
    ELSE 0
  END::numeric;
$$;

-- Month hours lookup
CREATE OR REPLACE FUNCTION month_hours(p_month int)
RETURNS int
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE p_month
    WHEN  1 THEN 136 WHEN  2 THEN 152 WHEN  3 THEN 168
    WHEN  4 THEN 176 WHEN  5 THEN 160 WHEN  6 THEN 168
    WHEN  7 THEN 184 WHEN  8 THEN 168 WHEN  9 THEN 176
    WHEN 10 THEN 184 WHEN 11 THEN 160 WHEN 12 THEN 184
    ELSE 176 END;
$$;

-- ---------------------------------------------------------------------------
-- calc_salary_row — TypeScript calcSalary twin
-- Returns table form so it can be SELECT-ed multiple ways.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calc_salary_row(
  p_base numeric,
  p_worked_hours numeric,
  p_month int,
  p_phone numeric DEFAULT 0,
  p_sales numeric DEFAULT 0,
  p_leave numeric DEFAULT 0,
  p_bod_extra numeric DEFAULT 0,
  p_advance_override numeric DEFAULT NULL
)
RETURNS TABLE (
  bod numeric, total_hours int, niit numeric,
  emndsh numeric, emndsh_org numeric, ded23 numeric,
  hhoat numeric, adv numeric, gart numeric
)
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE
  v_total_hours int;
  v_bod numeric;
  v_niit numeric;
  v_capped numeric;
  v_emndsh numeric;
  v_emndsh_org numeric;
  v_ded23 numeric;
  v_hhoat numeric;
  v_adv numeric;
  v_gart numeric;
BEGIN
  v_total_hours := month_hours(p_month);
  v_bod := CASE WHEN v_total_hours > 0 THEN (p_base / v_total_hours) * p_worked_hours ELSE 0 END;
  v_niit := v_bod + COALESCE(p_phone, 0) + COALESCE(p_sales, 0) + COALESCE(p_leave, 0) + COALESCE(p_bod_extra, 0);
  v_capped := LEAST(v_niit, 7920000);
  v_emndsh := v_capped * 0.115;
  v_emndsh_org := v_capped * 0.125;
  v_ded23 := art231(v_niit);
  v_hhoat := GREATEST(0, (v_niit - v_emndsh) * 0.1 - v_ded23);
  v_adv := COALESCE(p_advance_override, p_base * 0.4);
  v_gart := v_niit - v_emndsh - v_hhoat - v_adv;

  bod := ROUND(v_bod);
  total_hours := v_total_hours;
  niit := ROUND(v_niit);
  emndsh := ROUND(v_emndsh);
  emndsh_org := ROUND(v_emndsh_org);
  ded23 := ROUND(v_ded23);
  hhoat := ROUND(v_hhoat);
  adv := ROUND(v_adv);
  gart := ROUND(v_gart);
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- calculate_payroll — bulk-upsert salary_records for a company+month
-- For each active employee, computes calc_salary_row with their base/phone
-- and worked_hours = month_hours (default). User can override via grid edit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_payroll(
  p_company_id uuid,
  p_year int,
  p_month int
)
RETURNS SETOF salary_records
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_id uuid;
  v_emp employees;
  v_calc record;
  v_existing salary_records;
  v_rec salary_records;
  v_total_hrs int;
BEGIN
  SELECT id INTO v_period_id FROM periods
   WHERE company_id = p_company_id AND year = p_year AND month = p_month;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'Period %-% not found', p_year, p_month;
  END IF;
  v_total_hrs := month_hours(p_month);

  FOR v_emp IN
    SELECT * FROM employees
    WHERE company_id = p_company_id AND is_active = true AND deleted_at IS NULL
  LOOP
    SELECT * INTO v_existing FROM salary_records
      WHERE employee_id = v_emp.id AND year = p_year AND month = p_month;

    -- Pull values from existing record if present (so user edits are preserved)
    SELECT * INTO v_calc FROM calc_salary_row(
      v_emp.base_salary,
      COALESCE(v_existing.worked_hours, v_total_hrs),
      p_month,
      COALESCE(v_existing.phone_allowance, v_emp.phone_allowance),
      COALESCE(v_existing.sales_bonus, 0),
      COALESCE(v_existing.leave_pay, 0),
      COALESCE(v_existing.bod_salary, 0),
      v_existing.advance::numeric  -- existing advance is override
    );

    IF v_existing.id IS NULL THEN
      INSERT INTO salary_records (
        company_id, employee_id, period_id, year, month,
        base_salary, worked_hours, total_hours,
        phone_allowance, sales_bonus, leave_pay, bod_salary,
        total_income, emndsh, hhoat_deduction, hhoat, advance, net_pay,
        status, created_by, updated_by
      ) VALUES (
        p_company_id, v_emp.id, v_period_id, p_year, p_month,
        v_emp.base_salary, v_total_hrs, v_total_hrs,
        v_emp.phone_allowance, 0, 0, 0,
        v_calc.niit, v_calc.emndsh, v_calc.ded23, v_calc.hhoat, v_calc.adv, v_calc.gart,
        'draft', auth.uid(), auth.uid()
      ) RETURNING * INTO v_rec;
    ELSE
      UPDATE salary_records SET
        total_income = v_calc.niit,
        emndsh = v_calc.emndsh,
        hhoat_deduction = v_calc.ded23,
        hhoat = v_calc.hhoat,
        net_pay = v_calc.gart,
        updated_at = now(),
        updated_by = auth.uid()
      WHERE id = v_existing.id
      RETURNING * INTO v_rec;
    END IF;

    RETURN NEXT v_rec;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION calculate_payroll IS
  'Сарын цалин бүх ажилтанд автоматаар тооцоолно. Хэрэглэгчийн засварыг хадгална.';

-- ---------------------------------------------------------------------------
-- post_salary_batch — for each approved salary_record, create + post journal
-- Dr salary expense / Cr salary payable + ЭМНДШ + ХХОАТ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION post_salary_batch(
  p_company_id uuid,
  p_year int,
  p_month int,
  p_salary_expense_acc uuid,
  p_salary_payable_acc uuid,
  p_emndsh_payable_acc uuid,
  p_hhoat_payable_acc uuid
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_id uuid;
  v_total_niit numeric := 0;
  v_total_emndsh numeric := 0;
  v_total_hhoat numeric := 0;
  v_total_net numeric := 0;
  v_journal_id uuid;
  v_count int := 0;
  v_number text;
  v_period_end date;
BEGIN
  SELECT id, end_date INTO v_period_id, v_period_end FROM periods
   WHERE company_id = p_company_id AND year = p_year AND month = p_month;
  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'Period not found';
  END IF;

  SELECT
    COALESCE(SUM(total_income), 0),
    COALESCE(SUM(emndsh), 0),
    COALESCE(SUM(hhoat), 0),
    COALESCE(SUM(net_pay), 0),
    COUNT(*)
  INTO v_total_niit, v_total_emndsh, v_total_hhoat, v_total_net, v_count
  FROM salary_records
  WHERE company_id = p_company_id AND year = p_year AND month = p_month
    AND status = 'approved';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No approved salary records for %-%', p_year, p_month;
  END IF;

  v_number := to_char(v_period_end, 'YYYYMM') || '-SAL';
  INSERT INTO journals (
    company_id, period_id, number, date, description,
    status, source, total_debit, total_credit, created_by, updated_by
  ) VALUES (
    p_company_id, v_period_id, v_number, v_period_end,
    'Сарын цалингийн бичилт ' || p_year || '-' || lpad(p_month::text, 2, '0'),
    'draft', 'payroll',
    v_total_niit, v_total_niit,
    auth.uid(), auth.uid()
  ) RETURNING id INTO v_journal_id;

  INSERT INTO journal_lines (journal_id, line_no, account_id, debit, credit, description) VALUES
    (v_journal_id, 1, p_salary_expense_acc, v_total_niit, 0, 'Цалингийн зардал'),
    (v_journal_id, 2, p_emndsh_payable_acc, 0, v_total_emndsh, 'ЭМНДШ-ын өглөг'),
    (v_journal_id, 3, p_hhoat_payable_acc, 0, v_total_hhoat, 'ХХОАТ-ын өглөг'),
    (v_journal_id, 4, p_salary_payable_acc, 0, v_total_net, 'Цалингийн өглөг');

  PERFORM post_journal(v_journal_id);

  UPDATE salary_records
    SET status = 'posted', journal_id = v_journal_id
    WHERE company_id = p_company_id AND year = p_year AND month = p_month
      AND status = 'approved';

  RETURN v_count;
END;
$$;
