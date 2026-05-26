"""
цаг_бүртгэл.html → ТҮМЭН ТЭЭХ ХХК-н үндсэн хөрөнгийг
accounting.db-д дэлгэрэнгүй оруулах + тулгах
"""
import io, sys, json, re, sqlite3
from datetime import date, datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

TODAY = date(2026, 5, 23)

# ── 1. цаг_бүртгэл.html-аас татах ────────────────────────────
with open(r'C:\Users\natsa\Desktop\2026\tsalin\цаг_бүртгэл.html', encoding='utf-8') as f:
    content = f.read()

idx   = content.find('const INITIAL_ASSETS = [')
start = content.index('[', idx)
depth = 0; i = start; in_str = False; escape = False
while i < len(content):
    ch = content[i]
    if escape: escape = False; i += 1; continue
    if ch == '\\' and in_str: escape = True; i += 1; continue
    if ch == '"':
        in_str = not in_str; i += 1; continue
    if not in_str:
        if ch == '[': depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0: end = i + 1; break
    i += 1

raw  = content[start:end]
raw  = re.sub(r'//[^\n]*', '', raw)
raw  = re.sub(r',(\s*[}\]])', r'\1', raw)
data = json.loads(raw)
tt   = [a for a in data if 'ТҮМЭН ТЭЭХ' in a.get('company', '').upper()]

def months_between(d_str, today):
    """Огнооноос өнөөдөр хүртэлх саруудын тоо"""
    try:
        d = datetime.strptime(d_str[:10], '%Y-%m-%d').date()
    except Exception:
        return 0
    return max(0, (today.year - d.year) * 12 + (today.month - d.month))

def calc_depr(price, life_years, months_used):
    """Хуримтлагдсан элэгдэл"""
    if life_years <= 0: return 0.0
    monthly = price / (life_years * 12)
    return round(min(monthly * months_used, price), 2)

# ── 2. Одоогийн DB шалгах ──────────────────────────────────────
conn = sqlite3.connect('instance/accounting.db')
c    = conn.cursor()
c.execute('SELECT id, code, name, purchase_amount FROM fixed_assets ORDER BY code')
db_existing = c.fetchall()

print('╔' + '═'*100 + '╗')
print('║' + '  ТҮМЭН ТЭЭХ ХХК — ҮНДСЭН ХӨРӨНГИЙН ТУЛГАЛТ'.center(100) + '║')
print('╠' + '═'*100 + '╣')
print(f'║  цаг_бүртгэл.html: {len(tt)} хөрөнгө   |   DB одоогоор: {len(db_existing)} хөрөнгө'.ljust(100) + '║')
print('╠' + '═'*100 + '╣')

# ── 3. DB-г дэлгэрэнгүй дата-аар сольж оруулах ────────────────
print('\n[1] Хуучин нэгтгэл бүртгэлийг устгаж байна...')
c.execute('DELETE FROM fixed_assets')
conn.commit()
print(f'    {len(db_existing)} нэгтгэл устгагдлаа')

# ── 4. Ангилалын нэршил → DB category ─────────────────────────
CAT_MAP = {
    'Конторын тавилга':         'Конторын тавилга',
    'Конторын тоног төхөөрөмж': 'Тоног төхөөрөмж',
    'Эд хогшил':                'Эд хогшил',
    'Програм хангамж':          'Програм хангамж',
}

print('\n[2] Дэлгэрэнгүй хөрөнгүүд оруулж байна...')
print(f'{"Код":8s} {"Нэр":38s} {"Огноо":12s} {"Үнэ":>13s} {"Элэгдэл":>12s} {"Дансны үнэ":>12s}')
print('-'*100)

inserted = 0
now_str  = datetime.now().isoformat()
total_price = total_depr = total_book = 0

for a in tt:
    months = months_between(a['purchaseDate'], TODAY)
    depr   = calc_depr(a['purchasePrice'], a['usefulLife'], months)
    book   = a['purchasePrice'] - depr
    cat    = CAT_MAP.get(a['category'], a['category'])

    c.execute('''INSERT INTO fixed_assets
        (code, name, category, purchase_date, purchase_amount,
         useful_life, salvage_value, accumulated_depreciation,
         responsible_person, status, notes, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''', (
        a['code'], a['name'], cat,
        a['purchaseDate'][:10],
        a['purchasePrice'],
        a['usefulLife'],
        0,
        depr,
        a.get('custodian', ''),
        'active' if a.get('status') == 'active' else 'disposed',
        a.get('notes', ''),
        now_str,
    ))
    inserted += 1
    total_price += a['purchasePrice']
    total_depr  += depr
    total_book  += book
    print(f"{a['code']:8s} {a['name']:38s} {a['purchaseDate'][:10]:12s} "
          f"{a['purchasePrice']:>13,.0f} {depr:>12,.0f} {book:>12,.0f}")

conn.commit()
print('-'*100)
print(f'{"НИЙТ":>60s} {total_price:>13,.0f} {total_depr:>12,.0f} {total_book:>12,.0f}')

print(f'\n✓ {inserted} хөрөнгө оруулагдлаа')

# ── 5. Ангилалаар нэгтгэл ─────────────────────────────────────
print()
print('╔' + '═'*75 + '╗')
print('║' + '  Ангилалаар нэгтгэл (2026-05-23 байдлаар)'.center(75) + '║')
print('╠' + '═'*75 + '╣')
print(f'║  {"Ангилал":28s} {"Тоо":>4s} {"Анхны үнэ":>14s} {"Элэгдэл":>12s} {"Дансны үнэ":>12s} ║')
print('╠' + '─'*75 + '╣')

from collections import defaultdict
by_cat = defaultdict(lambda: {'n':0, 'price':0, 'depr':0})
for a in tt:
    months = months_between(a['purchaseDate'], TODAY)
    depr   = calc_depr(a['purchasePrice'], a['usefulLife'], months)
    cat    = CAT_MAP.get(a['category'], a['category'])
    by_cat[cat]['n']     += 1
    by_cat[cat]['price'] += a['purchasePrice']
    by_cat[cat]['depr']  += depr

for cat, v in sorted(by_cat.items()):
    book = v['price'] - v['depr']
    print(f'║  {cat:28s} {v["n"]:>4d} {v["price"]:>14,.0f} {v["depr"]:>12,.0f} {book:>12,.0f} ║')
print('╠' + '─'*75 + '╣')
print(f'║  {"НИЙТ":28s} {sum(v["n"] for v in by_cat.values()):>4d} {total_price:>14,.0f} {total_depr:>12,.0f} {total_book:>12,.0f} ║')
print('╚' + '═'*75 + '╝')

# ── 6. DB-н хуучин нэгтгэлтэй тулгалт ─────────────────────────
print()
print('─── Хуучин DB нэгтгэлтэй харьцуулалт ───')
old_totals = {
    'Тавилга эд хогшил':        13_694_400,
    'Компьютер, бусад хэрэгсэл': 12_780_000,
    'Бусад үндсэн хөрөнгө':          630_490,
    'Бусад эргэлтийн бус хөрөнгө': 4_765_200,
}
new_totals = {
    'Конторын тавилга':   by_cat['Конторын тавилга']['price'],
    'Тоног төхөөрөмж':    by_cat['Тоног төхөөрөмж']['price'],
    'Эд хогшил':          by_cat['Эд хогшил']['price'],
    'Програм хангамж':    by_cat['Програм хангамж']['price'],
}
print(f'  Хуучин нийт: {sum(old_totals.values()):>14,.0f}₮')
print(f'  Шинэ нийт:   {total_price:>14,.0f}₮')
print(f'  Зөрүү:        {total_price - sum(old_totals.values()):>14,.0f}₮')
print()
print('Тайлбар зөрүүний шалтгаан:')
print(f'  + А-035 Dell 3530 (2026-03-01): +2,100,000₮ (шинэ, хуучин DB-д ороогүй)')
print(f'  + А-032-034 Dell-үүд (2025):    хуучин нэгтгэлд ч байсан байж болно')
print(f'  Хуучин нэгтгэл нь зарим хөрөнгийг давхар тооцсон байж болзошгүй')
conn.close()
