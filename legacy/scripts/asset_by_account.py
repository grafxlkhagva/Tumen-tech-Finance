"""
Үндсэн хөрөнгийг дансаар ангилаад дансны үлдэгдэлтэй тулгах
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# 1. Үндсэн хөрөнгийн ангиллуудыг шалгах
print('=== 1. Үндсэн хөрөнгийн ангиллаар нэгтгэл ===')
c.execute("""
    SELECT category,
           COUNT(*) as cnt,
           SUM(purchase_amount) as ankhny,
           SUM(accumulated_depreciation) as elegdel,
           SUM(purchase_amount - accumulated_depreciation) as dans
    FROM fixed_assets
    WHERE status = 'active'
    GROUP BY category
    ORDER BY category
""")
rows = c.fetchall()
total_ankhny = total_elegdel = total_dans = 0
print(f'{"Ангилал":30} {"Тоо":>4} {"Анхны үнэ":>14} {"Элэгдэл":>12} {"Дансны үнэ":>12}')
print('-'*75)
for r in rows:
    print(f'{str(r[0]):30} {r[1]:>4} {r[2]:>14,.0f} {r[3]:>12,.0f} {r[4]:>12,.0f}')
    total_ankhny += r[2]
    total_elegdel += r[3]
    total_dans += r[4]
print('-'*75)
print(f'{"НИЙТ":30} {sum(r[1] for r in rows):>4} {total_ankhny:>14,.0f} {total_elegdel:>12,.0f} {total_dans:>12,.0f}')

# 2. Дансны план шалгах (үндсэн хөрөнгийн дансууд)
print('\n=== 2. Данс хуулга — үндсэн хөрөнгийн дансууд ===')
c.execute("""
    SELECT code, name, account_type
    FROM accounts
    WHERE code LIKE '15%' OR code LIKE '18%' OR code LIKE '16%'
    ORDER BY code
""")
accs = c.fetchall()
for a in accs:
    print(f'  {a[0]}  {a[1]}  [{a[2]}]')

# 3. Журналаас дансны үлдэгдэл тооцоолох
print('\n=== 3. Журналын дансны үлдэгдэл ===')
c.execute("""
    SELECT je.account_code, a.name,
           SUM(je.debit) as debit_sum,
           SUM(je.credit) as credit_sum,
           SUM(je.debit - je.credit) as balance
    FROM journal_entries je
    JOIN journals j ON je.journal_id = j.id
    JOIN accounts a ON je.account_code = a.code
    WHERE j.status = 'posted'
      AND (je.account_code LIKE '15%' OR je.account_code LIKE '18%' OR je.account_code LIKE '16%')
    GROUP BY je.account_code, a.name
    ORDER BY je.account_code
""")
jrows = c.fetchall()
if jrows:
    print(f'{"Данс":10} {"Нэр":35} {"Дебет":>14} {"Кредит":>14} {"Үлдэгдэл":>14}')
    print('-'*90)
    for r in jrows:
        print(f'{r[0]:10} {str(r[1])[:33]:35} {r[2]:>14,.0f} {r[3]:>14,.0f} {r[4]:>14,.0f}')
else:
    print('  Журналын бичилт байхгүй байна (эсвэл 15х/18х данс ашиглаагүй)')

# 4. Ангилал → данс хамаарал
print('\n=== 4. Ангилал → Данс хамаарал (санал болгосон) ===')
mapping = [
    ('Конторын тавилга',         '15110', 'Тавилга эд хогшил'),
    ('Тоног төхөөрөмж',          '15120', 'Компьютер, бусад хэрэгсэл'),
    ('Эд хогшил',                '15110', 'Тавилга эд хогшил'),
    ('Програм хангамж',          '18110', 'Биет бус хөрөнгө — програм'),
]
print(f'{"Ангилал":28} → {"Данс":8} {"Данс нэр":30}')
print('-'*70)
for cat, code, dname in mapping:
    print(f'  {cat:26} → {code:8} {dname}')

# 5. Дансны картаар нэгтгэл
print('\n=== 5. Данс дээр нэгтгэсэн хөрөнгийн тоо ===')
cat_to_acc = {
    'Конторын тавилга': '15110',
    'Тоног төхөөрөмж':  '15120',
    'Эд хогшил':        '15110',
    'Програм хангамж':  '18110',
}
acc_summary = {}
for r in rows:
    cat = r[0]
    acc = cat_to_acc.get(cat, 'ТОДОРХОЙГҮЙ')
    if acc not in acc_summary:
        acc_summary[acc] = {'cnt': 0, 'ankhny': 0, 'elegdel': 0, 'dans': 0, 'cats': []}
    acc_summary[acc]['cnt']     += r[1]
    acc_summary[acc]['ankhny']  += r[2]
    acc_summary[acc]['elegdel'] += r[3]
    acc_summary[acc]['dans']    += r[4]
    acc_summary[acc]['cats'].append(cat)

print(f'{"Данс":8} {"Тоо":>4} {"Анхны үнэ":>14} {"Элэгдэл":>12} {"Дансны үнэ":>12}  Ангилалууд')
print('-'*100)
for acc, v in sorted(acc_summary.items()):
    print(f'{acc:8} {v["cnt"]:>4} {v["ankhny"]:>14,.0f} {v["elegdel"]:>12,.0f} {v["dans"]:>12,.0f}  {", ".join(v["cats"])}')

conn.close()
print('\nДуусав.')
