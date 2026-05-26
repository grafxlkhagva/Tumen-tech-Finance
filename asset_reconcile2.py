"""
Үндсэн хөрөнгийг дансаар бүлэглэж, журналын үлдэгдэлтэй тулгах
journal_lines: debit_account_id / credit_account_id / amount
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# ── Дансны ID харилцааны хүснэгт ─────────────────────────────────────────
c.execute('SELECT id, code, name FROM accounts')
acc_map = {r[0]: (r[1], r[2]) for r in c.fetchall()}
code_to_id = {r[1]: r[0] for r in acc_map.items() for r in [r]}
# rebuild properly
c.execute('SELECT id, code, name FROM accounts')
rows = c.fetchall()
acc_by_id   = {r[0]: (r[1], r[2]) for r in rows}
acc_by_code = {r[1]: r[0]         for r in rows}

def get_balance(acc_code):
    """Дансны үлдэгдэл = Дебет нийт - Кредит нийт (posted журналаар)"""
    acc_id = acc_by_code.get(acc_code)
    if acc_id is None:
        return 0, 0
    c.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN jl.debit_account_id=? THEN jl.amount ELSE 0 END),0),
            COALESCE(SUM(CASE WHEN jl.credit_account_id=? THEN jl.amount ELSE 0 END),0)
        FROM journal_lines jl
        JOIN journals j ON jl.journal_id=j.id
        WHERE j.status='posted'
          AND (jl.debit_account_id=? OR jl.credit_account_id=?)
    """, (acc_id, acc_id, acc_id, acc_id))
    d, cr = c.fetchone()
    return d or 0, cr or 0

# ── Бүлгийн тодорхойлолт ─────────────────────────────────────────────────
GROUPS = [
    {
        'name':       'Тавилга, эд хогшил',
        'acc_asset':  '200501',
        'acc_depr':   '201501',
        'categories': ['Конторын тавилга', 'Эд хогшил'],
    },
    {
        'name':       'Компьютер, тоног төхөөрөмж',
        'acc_asset':  '200601',
        'acc_depr':   '201601',
        'categories': ['Тоног төхөөрөмж'],
    },
    {
        'name':       'Програм хангамж (Биет бус)',
        'acc_asset':  '201001',
        'acc_depr':   '201701',
        'categories': ['Програм хангамж'],
    },
]

# ── fixed_assets категориар нэгтгэл ──────────────────────────────────────
c.execute("""
    SELECT category, COUNT(*), SUM(purchase_amount),
           SUM(accumulated_depreciation),
           SUM(purchase_amount - accumulated_depreciation)
    FROM fixed_assets WHERE status='active'
    GROUP BY category
""")
fa_by_cat = {r[0]: {'cnt': r[1], 'ankhny': r[2], 'elegdel': r[3], 'dans': r[4]}
             for r in c.fetchall()}

# ── Хэвлэх ───────────────────────────────────────────────────────────────
W = 115
print('╔' + '═'*W + '╗')
print('║' + '  ҮНДСЭН ХӨРӨНГИЙН ДАНСНЫ ТУЛГАЛТ — 2026-05-23 байдлаар'.center(W) + '║')
print('╠' + '═'*W + '╣')
print('║  {:<34} {:>5}  {:>14}  {:>12}  {:>12}  {:>12}  {:>12} ║'.format(
    'Бүлэг / Ангилал', 'Тоо', 'Анхны үнэ', 'Элэгдэл', 'Дансны үнэ',
    'Ж/л дансны үнэ', 'Зөрүү'
))
print('╠' + '─'*W + '╣')

grand_a = grand_d = grand_b = grand_jl_b = 0

for g in GROUPS:
    # ҮХ картаас
    g_cnt = g_a = g_d = g_b = 0
    cat_lines = []
    for cat in g['categories']:
        if cat in fa_by_cat:
            d = fa_by_cat[cat]
            g_cnt += d['cnt']; g_a += d['ankhny']; g_d += d['elegdel']; g_b += d['dans']
            cat_lines.append((cat, d))

    # Журналаас
    deb_a, crd_a = get_balance(g['acc_asset'])
    deb_d, crd_d = get_balance(g['acc_depr'])
    jl_asset = deb_a - crd_a          # активын данс: дебет - кредит
    jl_depr  = crd_d - deb_d          # элэгдлийн данс: кредит - дебет (contra asset)
    jl_book  = jl_asset - jl_depr
    diff = g_b - jl_book

    # Бүлгийн мөр (ҮХ карт)
    print('║  {:<34} {:>5}  {:>14,.0f}  {:>12,.0f}  {:>12,.0f}  {:>12}  {:>12} ║'.format(
        '▶ ' + g['name'], g_cnt, g_a, g_d, g_b,
        f'{jl_book:,.0f}' if jl_book else '—',
        ('✓' if abs(diff) < 1 else f'{diff:,.0f}') if jl_book else '⚠ бичилтгүй'
    ))
    # Ангиллаар
    for cat, d in cat_lines:
        print('║    {:<32} {:>5}  {:>14,.0f}  {:>12,.0f}  {:>12,.0f}  {:>12}  {:>12} ║'.format(
            cat, d['cnt'], d['ankhny'], d['elegdel'], d['dans'], '', ''
        ))
    # Данс мэдээлэл
    print('║    {:<32} {:>5}  {:>14,.0f}  {:>12,.0f}  {:>12,.0f}  {:>12}  {:>12} ║'.format(
        f'[{g["acc_asset"]} / {g["acc_depr"]}]',
        '', jl_asset, jl_depr, jl_book, '', ''
    ))

    grand_a    += g_a
    grand_d    += g_d
    grand_b    += g_b
    grand_jl_b += jl_book
    print('╠' + '─'*W + '╣')

grand_diff = grand_b - grand_jl_b
print('║  {:<34} {:>5}  {:>14,.0f}  {:>12,.0f}  {:>12,.0f}  {:>12,.0f}  {:>12} ║'.format(
    'НИЙТ (ҮХ карт)', '',  grand_a, grand_d, grand_b, grand_jl_b,
    '✓' if abs(grand_diff) < 1 else f'{grand_diff:,.0f}'
))
print('╚' + '═'*W + '╝')

# ── Дэлгэрэнгүй жагсаалт ─────────────────────────────────────────────────
print()
for g in GROUPS:
    # Журналаас
    deb_a, crd_a = get_balance(g['acc_asset'])
    deb_d, crd_d = get_balance(g['acc_depr'])
    jl_asset = deb_a - crd_a
    jl_depr  = crd_d - deb_d
    jl_book  = jl_asset - jl_depr

    print(f'\n▌ {g["name"]}')
    print(f'  Данс: {g["acc_asset"]} (анхны үнэ)  /  {g["acc_depr"]} (хуримтлагдсан элэгдэл)')
    print(f'  Журналын үлдэгдэл: анхны {jl_asset:,.0f}₮  элэгдэл {jl_depr:,.0f}₮  дансны үнэ {jl_book:,.0f}₮')
    print()
    print(f'  {"Код":8} {"Нэр":38} {"Огноо":12} {"Анхны үнэ":>12} {"Элэгдэл":>12} {"Дансны үнэ":>12} {"Элэгдэл%":>8}')
    print('  ' + '─'*108)

    placeholders = ','.join(['?'] * len(g['categories']))
    c.execute(f"""
        SELECT code, name, purchase_date, purchase_amount,
               accumulated_depreciation,
               purchase_amount - accumulated_depreciation as book
        FROM fixed_assets
        WHERE status='active' AND category IN ({placeholders})
        ORDER BY code
    """, g['categories'])
    items = c.fetchall()
    sub_a = sub_d = sub_b = 0
    for r in items:
        pct = (r[4] / r[3] * 100) if r[3] else 0
        print(f'  {r[0]:8} {r[1]:38} {str(r[2]):12} {r[3]:>12,.0f} {r[4]:>12,.0f} {r[5]:>12,.0f} {pct:>7.1f}%')
        sub_a += r[3]; sub_d += r[4]; sub_b += r[5]
    print('  ' + '─'*108)
    print(f'  {"Дүн":>60} {sub_a:>12,.0f} {sub_d:>12,.0f} {sub_b:>12,.0f}')
    if jl_book:
        diff_b = sub_b - jl_book
        diff_a = sub_a - jl_asset
        diff_d = sub_d - jl_depr
        print(f'  {"Журнал дансны үнэ:":>60} {jl_asset:>12,.0f} {jl_depr:>12,.0f} {jl_book:>12,.0f}')
        print(f'  {"Зөрүү:":>60} {diff_a:>12,.0f} {diff_d:>12,.0f} {diff_b:>12,.0f}')

conn.close()
print('\nДуусав.')
