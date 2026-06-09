-- Банк → хуулга задлах формат холбоос.
-- /cash/import хуудас banks-ийг metadata.import_format-оор шүүж парсер сонгоно.
-- ('tdb' = ХХБ/ТДБ .XLS, 'golomt' = Голомт .xlsx, 'mbank' = М банк .XLS)

UPDATE bank_accounts
   SET metadata = metadata || '{"import_format":"tdb"}'::jsonb
 WHERE id = '3535daf2-09a4-459b-bffb-1497d700d071';

UPDATE bank_accounts
   SET metadata = metadata || '{"import_format":"golomt"}'::jsonb
 WHERE id = '7228e18a-c1e1-4b0f-9940-63c1b9d20526';

UPDATE bank_accounts
   SET metadata = metadata || '{"import_format":"mbank"}'::jsonb
 WHERE id = 'c93426d6-ca42-43cf-bd52-82c056348d94';
