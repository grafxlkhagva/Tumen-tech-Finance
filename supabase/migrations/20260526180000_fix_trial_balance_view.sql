-- =============================================================================
-- 016 — Fix v_trial_balance: present balance on correct side by account type
-- =============================================================================
-- Хуучин логик нь signed balance-ийг тэмдэгээр debit/credit-д хуваадаг байсан,
-- гэхдээ trial balance стандартаар нь:
--   asset, expense       → balance Dr талд (хэрэв ердийн чиглэлд)
--   liability, equity,
--   income               → balance Cr талд
-- =============================================================================

DROP VIEW IF EXISTS v_trial_balance CASCADE;

CREATE OR REPLACE VIEW v_trial_balance AS
SELECT
  account_id, company_id, code, name, type, parent_id, level,
  total_debit, total_credit,
  CASE
    -- Asset/expense нэгдмэл balance нь хэрэв ердийн (Dr > Cr) бол Dr талд
    WHEN type IN ('asset','expense') AND balance >= 0 THEN balance
    -- Liability/equity/income нь сөрөг balance-тай (Dr > Cr) үед Dr талд
    WHEN type IN ('liability','equity','income') AND balance < 0 THEN -balance
    ELSE 0
  END AS debit_balance,
  CASE
    -- Liability/equity/income хэрэв ердийн (Cr > Dr) бол Cr талд
    WHEN type IN ('liability','equity','income') AND balance >= 0 THEN balance
    -- Asset/expense нь сөрөг balance-тай үед Cr талд
    WHEN type IN ('asset','expense') AND balance < 0 THEN -balance
    ELSE 0
  END AS credit_balance,
  balance AS signed_balance
FROM v_account_balances
WHERE is_postable = true;

COMMENT ON VIEW v_trial_balance IS
  'Шалгах баланс. Account type-аар нь debit/credit талд зөв байрлуулна. '
  'Зөв schema-д SUM(debit_balance) = SUM(credit_balance).';
