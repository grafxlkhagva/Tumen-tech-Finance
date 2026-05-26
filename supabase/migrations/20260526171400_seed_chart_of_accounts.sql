-- =============================================================================
-- 015 — Жишээ компани + үндсэн Chart of Accounts seed
-- =============================================================================
-- Дансны төлөвлөгөө: Монголын стандарт классификатор (товчилсон)
-- Бүлэг код:
--   1xxx → Хөрөнгө     (Asset)
--   2xxx → Өр төлбөр   (Liability)
--   3xxx → Эзний өмч   (Equity)
--   4xxx → Орлого      (Income)
--   5xxx → Зардал      (Expense)
-- Энэ нь зөвхөн жишээ — data migration-ы үед хуучин SQLite-аас бодит код таны
-- системийн дагуу copy хийгдэнэ.
-- =============================================================================

-- Default company үүсгэх (data migration-д реф хийгдэнэ)
INSERT INTO companies (id, name, legal_name, base_currency, is_active, metadata)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Тумэн',
  'Тумэн ХХК',
  'MNT',
  true,
  jsonb_build_object('migrated_from', 'sqlite_legacy', 'note', 'Default tenant for data migration')
)
ON CONFLICT (id) DO NOTHING;

-- 2026 оны 12 period үүсгэх
INSERT INTO periods (company_id, year, month, start_date, end_date, status)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  2026,
  m,
  make_date(2026, m, 1),
  (make_date(2026, m, 1) + interval '1 month - 1 day')::date,
  'open'
FROM generate_series(1, 12) AS m
ON CONFLICT (company_id, year, month) DO NOTHING;

-- 2025 оны 12 period (өмнөх жилийн compatibility)
INSERT INTO periods (company_id, year, month, start_date, end_date, status)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  2025,
  m,
  make_date(2025, m, 1),
  (make_date(2025, m, 1) + interval '1 month - 1 day')::date,
  'open'
FROM generate_series(1, 12) AS m
ON CONFLICT (company_id, year, month) DO NOTHING;
