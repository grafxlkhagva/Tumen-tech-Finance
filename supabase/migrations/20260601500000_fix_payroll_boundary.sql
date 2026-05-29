-- =============================================================================
-- Fix payroll boundary precision (Article 23.1 at 500K, 1M, 1.5M, ...)
-- =============================================================================
-- Bug: (p_base / v_total_hours) * p_worked_hours in NUMERIC truncates the
-- intermediate quotient (default scale ~6 digits), so 500000/184*184 yields
-- 499999.99... instead of 500000.00. art231() crosses to a lower bracket.
--
-- Fix: multiply first, divide last. (500000 * 184) / 184 = 500000 exactly.
-- =============================================================================

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
  -- Multiply-then-divide preserves exactness at integer boundaries
  v_bod := CASE
    WHEN v_total_hours > 0 THEN (p_base * p_worked_hours) / v_total_hours
    ELSE 0
  END;
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
