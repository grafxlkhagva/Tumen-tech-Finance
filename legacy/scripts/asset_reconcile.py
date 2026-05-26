"""
Үндсэн хөрөнгийг дансаар бүлэглэж, журналын үлдэгдэлтэй тулгах
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# ── 1. Ангилал → Данс хамаарал ────────────────────────────────────────────
# Дансны кодыг accounts хүснэгтээс шалгасны үндсэн дээр:
#   200501 = Тавилга, эд хогшил (ҮХ)
#   200601 = Компьютер, бусад хэрэгсэл (ҮХ)
#   201001 = Бусад эргэлтийн бус хөрөнгө  (Програм хангамж)
#   201501 = Тавилга, эд хогшил — хуримтлагдсан элэгдэл
#   201601 = Компьютер, хэрэгсэл — хуримтлагдсан элэгдэл
#   201701 = Бусад ҮХ — хуримтлагдсан элэгдэл (Програм)

GROUPS = [
    {
        'name': 'Тавилга, эд хогшил',
        'acc_asset': ['200501'],
        'acc_depr':  ['201501'],
        'categories': ['Конторын тавилга', 'Эд хогшил'],
    },
    {
        'name': 'Компьютер, тоног төхөөрөмж',
        'acc_asset': ['200601'],
        'acc_depr':  ['201601'],
        'categories': ['Тоног төхөөрөмж'],
    },
    {
        'name': 'Програм хангамж (Биет бус)',
        'acc_asset': ['201001'],
        'acc_depr':  ['201701'],
        'categories': ['Програм хангамж'],
    },
]

# ── 2. fixed_assets-аас нэгтгэл ───────────────────────────────────────────
c.execute("""
    SELECT category,
           COUNT(*) as cnt,
           SUM(purchase_amount) as ankhny,
           SUM(accumulated_depreciation) as elegdel,
           SUM(purchase_amount - accumulated_depreciation) as dans
    FROM fixed_assets WHERE status='active'
    GROUP BY category
""")
fa_by_cat = {r[0]: {'cnt': r[1], 'ankhny': r[2], 'elegdel': r[3], 'dans': r[4]}
             for r in c.fetchall()}

# ── 3. journal_lines-аас дансны үлдэгдэл ──────────────────────────────────
all_acc_codes = set()
for g in GROUPS:
    all_acc_codes.update(g['acc_asset'])
    all_acc_codes.update(g['acc_depr'])

acc_balance = {}
for acc in all_acc_codes:
    c.execute("""
        SELECT COALESCE(SUM(jl.debit),0), COALESCE(SUM(jl.credit),0)
        FROM journal_lines jl
        JOIN journals j ON jl.journal_id = j.id
        WHERE j.status = 'posted'
          AND jl.account_code = ?
    """, (acc,))
    d, cr = c.fetchone()
    acc_balance[acc] = {'debit': d, 'credit': cr, 'balance': d - cr}

# ── 4. Нэгтгэлийн хүснэгт хэвлэх ─────────────────────────────────────────
print('╔' + '═'*110 + '╗')
print('║' + '  ҮНДСЭН ХӨРӨНГИЙН ДАНСНЫ ТУЛГАЛТ — 2026-05-23 байдлаар'.center(110) + '║')
print('╠' + '═'*110 + '╣')
print(f'║  {"Бүлэг / Ангилал":<35} {"Тоо":>4}  {"Анхны үнэ":>14}  {"Элэгдэл":>12}  {"Дансны үнэ":>12}  {"Тайлбар":<12} ║')
print('╠' + '─'*110 + '╣')

grand_asset = grand_depr = grand_book = 0
grand_jl_asset = grand_jl_depr = 0

for g in GROUPS:
    # fixed_assets-аас нэгтгэл
    g_cnt = g_ankhny = g_elegdel = g_dans = 0
    details = []
    for cat in g['categories']:
        if cat in fa_by_cat:
            d = fa_by_cat[cat]
            g_cnt     += d['cnt']
            g_ankhny  += d['ankhny']
            g_elegdel += d['elegdel']
            g_dans    += d['dans']
            details.append((cat, d))

    # journal_lines-аас
    jl_asset = sum(acc_balance.get(a, {}).get('balance', 0) for a in g['acc_asset'])
    jl_depr  = sum(abs(acc_balance.get(a, {}).get('balance', 0)) for a in g['acc_depr'])
    jl_book  = jl_asset - jl_depr

    # Бүлгийн мөр
    print(f'║  {"► " + g["name"]:<35} {g_cnt:>4}  {g_ankhny:>14,.0f}  {g_elegdel:>12,.0f}  {g_dans:>12,.0f}  {"ҮХ карт":12} ║')

    # Ангиллаар дэлгэрэнгүй
    for cat, d in details:
        print(f'║    {"  " + cat:<33} {d["cnt"]:>4}  {d["ankhny"]:>14,.0f}  {d["elegdel"]:>12,.0f}  {d["dans"]:>12,.0f}  {"":12} ║')

    # Данс ашигласан байгаа эсэх
    asset_codes_str = ', '.join(g['acc_asset'])
    depr_codes_str  = ', '.join(g['acc_depr'])

    if jl_asset or jl_depr:
        diff_asset = g_ankhny - jl_asset
        diff_depr  = g_elegdel - jl_depr
        diff_book  = g_dans - jl_book
        asset_ok = '✓' if abs(diff_asset) < 1 else f'Зөрүү {diff_asset:,.0f}'
        depr_ok  = '✓' if abs(diff_depr) < 1 else f'Зөрүү {diff_depr:,.0f}'
        print(f'║    {"  [Журнал " + asset_codes_str + "]":<35} {"":>4}  {jl_asset:>14,.0f}  {jl_depr:>12,.0f}  {jl_book:>12,.0f}  {asset_ok[:12]:12} ║')
    else:
        print(f'║    {"  [Журнал " + asset_codes_str + " — бичилт байхгүй]":<35} {"":>4}  {"0":>14}  {"0":>12}  {"0":>12}  {"⚠ бичилтгүй":12} ║')

    grand_asset   += g_ankhny
    grand_depr    += g_elegdel
    grand_book    += g_dans
    grand_jl_asset += jl_asset
    grand_jl_depr  += jl_depr
    print('╠' + '─'*110 + '╣')

# Нийт
print(f'║  {"НИЙТ (ҮХ карт)":<35} {"":>4}  {grand_asset:>14,.0f}  {grand_depr:>12,.0f}  {grand_book:>12,.0f}  {"":12} ║')
grand_jl_book = grand_jl_asset - grand_jl_depr
if grand_jl_asset:
    diff = grand_book - grand_jl_book
    print(f'║  {"НИЙТ (Журнал)":<35} {"":>4}  {grand_jl_asset:>14,.0f}  {grand_jl_depr:>12,.0f}  {grand_jl_book:>12,.0f}  {"":12} ║')
    print(f'║  {"  → Зөрүү":<35} {"":>4}  {grand_asset-grand_jl_asset:>14,.0f}  {grand_depr-grand_jl_depr:>12,.0f}  {diff:>12,.0f}  {"":12} ║')
print('╚' + '═'*110 + '╝')

# ── 5. Хувь хүн хөрөнгүүдийн жагсаалт (бүлгээр) ─────────────────────────
print('\n=== Дэлгэрэнгүй жагсаалт бүлгээр ===')
for g in GROUPS:
    print(f'\n▌ {g["name"]}  (Данс: {", ".join(g["acc_asset"])} / Элэгдэл: {", ".join(g["acc_depr"])})')
    print(f'  {"Код":8} {"Нэр":38} {"Огноо":12} {"Анхны үнэ":>12} {"Элэгдэл%":>9} {"Дансны үнэ":>12}')
    print('  ' + '-'*96)

    placeholders = ','.join(['?'] * len(g['categories']))
    c.execute(f"""
        SELECT code, name, purchase_date, purchase_amount,
               accumulated_depreciation,
               purchase_amount - accumulated_depreciation as book,
               useful_life
        FROM fixed_assets
        WHERE status='active' AND category IN ({placeholders})
        ORDER BY code
    """, g['categories'])
    items = c.fetchall()
    sub_a = sub_d = sub_b = 0
    for r in items:
        pct = (r[4] / r[3] * 100) if r[3] else 0
        print(f'  {r[0]:8} {r[1]:38} {str(r[2]):12} {r[3]:>12,.0f} {pct:>8.1f}% {r[5]:>12,.0f}')
        sub_a += r[3]; sub_d += r[4]; sub_b += r[5]
    print('  ' + '-'*96)
    print(f'  {"Нийт":>48} {sub_a:>12,.0f} {"":>9} {sub_b:>12,.0f}')
    print(f'  {"Хуримтлагдсан элэгдэл:":>48} {sub_d:>12,.0f}')

conn.close()
print('\nДуусав.')
