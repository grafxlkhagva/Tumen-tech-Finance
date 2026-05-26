"""
ҮХ карт ↔ Журнал зөрүүг тулгаж, тохируулгын журнал бичилт үүсгэх

Зөрүүний шалтгаан:
  [1] Тавилга 200501: Хуучин нэгтгэл 13,694,400₮ → Дэлгэрэнгүй 6,764,390₮
      → Журналд хэт их → Credit 200501 by 6,930,010₮
  [2] Тавилга элэгдэл 201501: 937,240₮ → 1,345,933₮
      → Credit 201501 by 408,693₮ (нэмэлт элэгдэл)
  [3] Компьютер 200601: А-035 Dell 2,100,000₮ журналд ороогүй
      → Debit 200601 by 2,100,000₮
  [4] Компьютер элэгдэл 201601: 2,200,000₮ → 6,841,667₮
      → Credit 201601 by 4,641,667₮
  [5] Програм элэгдэл 201701: 46,999₮ → 397,100₮
      → Credit 201701 by 350,101₮

  Нийт нэг тохируулгын журнал үүсгэж 5200 (Хуримтлагдсан ашиг) данстай балансчилна.
"""
import io, sys, sqlite3
from datetime import datetime, date
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# ── 1. Одоогийн дансны үлдэгдэл шалгах ──────────────────────────────────
def get_balance(acc_code):
    c.execute('SELECT id FROM accounts WHERE code=?', (acc_code,))
    r = c.fetchone()
    if not r: return None, 0, 0
    acc_id = r[0]
    c.execute("""
        SELECT COALESCE(SUM(CASE WHEN jl.debit_account_id=? THEN jl.amount ELSE 0 END),0),
               COALESCE(SUM(CASE WHEN jl.credit_account_id=? THEN jl.amount ELSE 0 END),0)
        FROM journal_lines jl JOIN journals j ON jl.journal_id=j.id WHERE j.status='posted'
          AND (jl.debit_account_id=? OR jl.credit_account_id=?)
    """, (acc_id, acc_id, acc_id, acc_id))
    d, cr = c.fetchone()
    return acc_id, d or 0, cr or 0

# ── 2. ҮХ картын нийт дүн ────────────────────────────────────────────────
c.execute("""
    SELECT
        SUM(CASE WHEN category IN ('Конторын тавилга','Эд хогшил') THEN purchase_amount ELSE 0 END),
        SUM(CASE WHEN category IN ('Конторын тавилга','Эд хогшил') THEN accumulated_depreciation ELSE 0 END),
        SUM(CASE WHEN category = 'Тоног төхөөрөмж' THEN purchase_amount ELSE 0 END),
        SUM(CASE WHEN category = 'Тоног төхөөрөмж' THEN accumulated_depreciation ELSE 0 END),
        SUM(CASE WHEN category = 'Програм хангамж' THEN purchase_amount ELSE 0 END),
        SUM(CASE WHEN category = 'Програм хангамж' THEN accumulated_depreciation ELSE 0 END)
    FROM fixed_assets WHERE status='active'
""")
fa = c.fetchone()
fa_200501, fa_201501 = fa[0], fa[1]
fa_200601, fa_201601 = fa[2], fa[3]
fa_201001, fa_201701 = fa[4], fa[5]

# ── 3. Журналын одоогийн үлдэгдэл ────────────────────────────────────────
id_200501, d_200501, cr_200501 = get_balance('200501')
id_201501, d_201501, cr_201501 = get_balance('201501')
id_200601, d_200601, cr_200601 = get_balance('200601')
id_201601, d_201601, cr_201601 = get_balance('201601')
id_201001, d_201001, cr_201001 = get_balance('201001')
id_201701, d_201701, cr_201701 = get_balance('201701')

jl_200501 = d_200501 - cr_200501
jl_201501 = cr_201501 - d_201501   # contra asset
jl_200601 = d_200601 - cr_200601
jl_201601 = cr_201601 - d_201601
jl_201001 = d_201001 - cr_201001
jl_201701 = cr_201701 - d_201701

# ── 4. Тулгалт ────────────────────────────────────────────────────────────
print('╔' + '═'*80 + '╗')
print('║' + '  ҮХ КАРТ ↔ ЖУРНАЛ ТУЛГАЛТ'.center(80) + '║')
print('╠' + '═'*80 + '╣')
print(f'║  {"Данс":10} {"Нэр":28} {"ҮХ карт":>12} {"Журнал":>12} {"Зөрүү":>12}  ║')
print('╠' + '─'*80 + '╣')

lines = [
    ('200501', 'Тавилга, эд хогшил',         fa_200501, jl_200501,  'asset'),
    ('201501', 'Тавилга — элэгдэл',          fa_201501, jl_201501,  'contra'),
    ('200601', 'Компьютер, ТТ',              fa_200601, jl_200601,  'asset'),
    ('201601', 'Компьютер — элэгдэл',        fa_201601, jl_201601,  'contra'),
    ('201001', 'Бусад эргэлтийн бус хөрөнгө', fa_201001, jl_201001, 'asset'),
    ('201701', 'Бусад ҮХ — элэгдэл',         fa_201701, jl_201701,  'contra'),
]
total_fa_net = total_jl_net = 0
for code, name, fa_val, jl_val, typ in lines:
    diff = fa_val - jl_val
    ok = '✓' if abs(diff) < 1 else f'{diff:+,.0f}'
    sign = '-' if typ == 'contra' else '+'
    print(f'║  {code:10} {name:28} {fa_val:>12,.0f} {jl_val:>12,.0f} {ok:>12}  ║')
    if typ == 'asset':
        total_fa_net += fa_val; total_jl_net += jl_val
    else:
        total_fa_net -= fa_val; total_jl_net -= jl_val
print('╠' + '─'*80 + '╣')
print(f'║  {"Дансны үнэ (нийт)":39} {total_fa_net:>12,.0f} {total_jl_net:>12,.0f} {total_fa_net-total_jl_net:>+12,.0f}  ║')
print('╚' + '═'*80 + '╝')

# ── 5. Тохируулгын журнал үүсгэх ─────────────────────────────────────────
print('\nТохируулгын журнал бичилт үүсгэх үү? (y/n): ', end='')
ans = input().strip().lower()
if ans != 'y':
    print('Цуцлагдлаа.')
    conn.close()
    exit()

# Журнал Lines:
# Активын данс дебетлэх/кредитлэх → зөрүүгийн эсрэг
# Элэгдлийн данс кредитлэх → зөрүүг зөвшөөрөх
# Балансчилах данс: 5200 (Хуримтлагдсан ашиг) эсвэл тусгай тохируулга данс

# Тохируулгын дансыг шалгах
c.execute("SELECT id FROM accounts WHERE code='5200'")
r5200 = c.fetchone()
if not r5200:
    print('5200 данс олдсонгүй! Зогслоо.')
    conn.close()
    exit()
id_5200 = r5200[0]

jdate = date(2026, 5, 23)
now_str = datetime.now().isoformat()

# Журнал үүсгэх
c.execute("""
    INSERT INTO journals (number, date, description, status, created_at)
    VALUES (?, ?, ?, 'posted', ?)
""", ('ADJ-FA-2026-05', jdate.isoformat(),
      'ҮХ карт дэлгэрэнгүй дата — журналтай тохируулга (2026-05-23)', now_str))
jid = c.lastrowid

def add_line(debit_id, credit_id, amount, desc):
    if abs(amount) < 1:
        return
    amt = abs(amount)
    if amount < 0:
        debit_id, credit_id = credit_id, debit_id
    c.execute("""
        INSERT INTO journal_lines (journal_id, debit_account_id, credit_account_id, amount, description)
        VALUES (?, ?, ?, ?, ?)
    """, (jid, debit_id, credit_id, round(amt, 2), desc))

adj_lines = []

# 200501 Тавилга: журналд илүү → credit 200501
diff_200501 = fa_200501 - jl_200501  # negative → journal хэт их
if abs(diff_200501) > 0.5:
    # diff_200501 < 0: credit 200501, debit 5200 (reduce asset & equity)
    adj_lines.append((id_5200, id_200501, -diff_200501, '200501 тавилга тохируулга'))

# 201501 Тавилга элэгдэл: нэмэх → credit 201501
diff_201501 = fa_201501 - jl_201501  # positive → need more depreciation
if abs(diff_201501) > 0.5:
    adj_lines.append((id_5200, id_201501, diff_201501, '201501 тавилга элэгдлийн тохируулга'))

# 200601 Компьютер: нэмэх → debit 200601
diff_200601 = fa_200601 - jl_200601  # positive → need to add
if abs(diff_200601) > 0.5:
    adj_lines.append((id_200601, id_5200, diff_200601, '200601 компьютер А-035 Dell нэмэлт'))

# 201601 Компьютер элэгдэл: нэмэх → credit 201601
diff_201601 = fa_201601 - jl_201601  # positive
if abs(diff_201601) > 0.5:
    adj_lines.append((id_5200, id_201601, diff_201601, '201601 компьютер элэгдлийн тохируулга'))

# 201001 Програм: тааруулна
diff_201001 = fa_201001 - jl_201001
if abs(diff_201001) > 0.5:
    adj_lines.append((id_201001, id_5200, diff_201001, '201001 програм тохируулга'))

# 201701 Програм элэгдэл: нэмэх → credit 201701
diff_201701 = fa_201701 - jl_201701
if abs(diff_201701) > 0.5:
    adj_lines.append((id_5200, id_201701, diff_201701, '201701 програм элэгдлийн тохируулга'))

for debit_id, credit_id, amount, desc in adj_lines:
    add_line(debit_id, credit_id, amount, desc)

conn.commit()

print(f'\n✓ Тохируулгын журнал #{jid} (ADJ-FA-2026-05) үүсэглээ')
print(f'  {len(adj_lines)} мөр бичилт:')
print()
print(f'  {"Дебет данс":12} {"Кредит данс":12} {"Дүн":>14}  Тайлбар')
print('  ' + '-'*70)

c.execute("""
    SELECT da.code, ca.code, jl.amount, jl.description
    FROM journal_lines jl
    JOIN accounts da ON jl.debit_account_id=da.id
    JOIN accounts ca ON jl.credit_account_id=ca.id
    WHERE jl.journal_id=?
""", (jid,))
total = 0
for r in c.fetchall():
    print(f'  {r[0]:12} {r[1]:12} {r[2]:>14,.0f}  {r[3]}')
    total += r[2]
print('  ' + '-'*70)
print(f'  {"Нийт":>26} {total:>14,.0f}')

# Шалгалт: 5200-д нийт нөлөөлөл
c.execute("SELECT id FROM accounts WHERE code='5200'")
id5200 = c.fetchone()[0]
c.execute("""
    SELECT COALESCE(SUM(CASE WHEN debit_account_id=? THEN amount ELSE 0 END),0),
           COALESCE(SUM(CASE WHEN credit_account_id=? THEN amount ELSE 0 END),0)
    FROM journal_lines WHERE journal_id=?
""", (id5200, id5200, jid))
d5200, cr5200 = c.fetchone()
print(f'\n  5200 дансны нөлөөлөл: Дебет {d5200:,.0f} / Кредит {cr5200:,.0f} → Цэвэр {cr5200-d5200:+,.0f}₮')

conn.close()
print('\nДуусав.')
