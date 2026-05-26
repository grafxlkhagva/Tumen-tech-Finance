"""
type='out' байдлаар буруу ангилагдсан eBarimt-уудыг type='in' болгож засах.

Шалгуур:
  - Харилцагчийн нэр банкны зарлагатай таарч байна (нэрийн тохирол)
  - Банкны тайлбар нь ХУДАЛДАН АВАЛТ болохыг нотолж байна
  - Хэрэглэгч id=1205-ыг тодорхой баримтжуулсан (гишүүний хураамж)
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# Тодорхой нотлогдсон буруу ангиллын баримтууд:
# Харилцагч нэр + банкны тайлбараар баталгаажсан
confirmed_fixes = [
    # (id, partner_name, reason)
    (1205, 'Монголын маркетингийн холбоо',
     'Гишүүний хураамж — банкны зарлага ct_id=610 "гишүүний хураамж 2026 он"'),
    (1204, 'ХӨХЭНЭГЭ',
     'Систем хөгжүүлэлтийн үйлчилгээ — банкны зарлага "систем хөгжүүлэлт"'),
    (1206, 'ХӨХЭНЭГЭ',
     'Систем хөгжүүлэлтийн үйлчилгээ — банкны зарлага "систем хөгжүүлэлт"'),
    (1207, 'Коллпро',
     'Үйлчилгээний хураамж 50,000₮ — банкны зарлага Түмэн Тээх ХХК-с'),
    (1213, 'Коллпро',
     'Үйлчилгээний хураамж 50,000₮ — банкны зарлага Коллпро'),
    (1210, 'Монгол дахь австралийн худал',
     'Хурал/арга хэмжээний хураамж 240,000₮ — банкны зарлага тааруулагдсан'),
    (1211, 'АЛТАНГЭРЭЛ АСЕМБОЛ',
     'Компьютер худалдан авалт Dell3530 — банкны зарлага "компьютер худалдаа Dell353"'),
    (1212, 'Ви Ай Пи хөшиг',
     'Хөшиг/тавилга худалдан авалт 738,100₮'),
    (1215, 'Чандмань цагаан богч',
     'Бараа худалдан авалт 880,000₮'),
    (1216, 'Женералмедиа холдинг',
     'Зар сурталчилгааны үйлчилгээ 309,600₮'),
    (1217, 'Талын өнгөт дусал',
     'Нэрийн хавтас/хэвлэл 766,150₮ — банкны зарлага тааруулагдсан'),
]

print('╔' + '═'*90 + '╗')
print('║' + '  E-Баримт ангиллын засвар: type="out" → type="in"'.center(90) + '║')
print('╠' + '═'*90 + '╣')

# Одоогийн байдал
c.execute("SELECT type, COUNT(*) FROM vat_records GROUP BY type")
before = dict(c.fetchall())
print(f'║  Өмнө:  type=in: {before.get("in",0)}, type=out: {before.get("out",0)}'.ljust(90) + '║')

fixed = []
skipped = []

for vat_id, partner, reason in confirmed_fixes:
    c.execute("SELECT id, type, total_amount, partner_name, date FROM vat_records WHERE id=?", (vat_id,))
    row = c.fetchone()
    if row is None:
        skipped.append((vat_id, 'ID олдсонгүй'))
        continue
    if row[1] == 'in':
        skipped.append((vat_id, f'Аль хэдийн type=in байна ({partner})'))
        continue
    if row[1] != 'out':
        skipped.append((vat_id, f'Төрөл "{row[1]}" — засахгүй'))
        continue

    c.execute("UPDATE vat_records SET type='in' WHERE id=?", (vat_id,))
    fixed.append((vat_id, partner, row[4], row[2], reason))

conn.commit()

c.execute("SELECT type, COUNT(*) FROM vat_records GROUP BY type")
after = dict(c.fetchall())
print(f'║  Дараа:  type=in: {after.get("in",0)}, type=out: {after.get("out",0)}'.ljust(90) + '║')
print('╠' + '═'*90 + '╣')

print(f'║  Засагдсан: {len(fixed)} баримт, алгасагдсан: {len(skipped)} баримт'.ljust(90) + '║')
print('╚' + '═'*90 + '╝')

if fixed:
    print(f'\n✓ ЗАСАГДСАН ({len(fixed)} баримт):')
    print(f'  {"ID":>6}  {"Огноо":12}  {"Дүн":>12}  {"Харилцагч":30}  Шалтгаан')
    print('  ' + '-'*100)
    for vat_id, partner, date, amount, reason in fixed:
        print(f'  {vat_id:>6}  {str(date):12}  {amount:>12,.0f}  {partner[:28]:30}  {reason[:40]}')

if skipped:
    print(f'\n⚠ АЛГАСАГДСАН ({len(skipped)} баримт):')
    for vat_id, reason in skipped:
        print(f'  id={vat_id}: {reason}')

# Нэмэлт шалгалт: харилцагч нэрийн таарсан type='out' баримтуудыг нотлохгүй үлдэгдэл
print('\n─── Нэмэлт шалгалт шаардах type="out" баримтууд ───')
c.execute("""
    SELECT v.id, v.date, v.total_amount, v.partner_name,
           ct.expense, ct.description, ct.partner_name as ct_p
    FROM vat_records v
    JOIN cash_transactions ct
      ON ABS(v.total_amount - ct.expense) < 1
     AND ct.expense > 0
     AND ABS(julianday(v.date) - julianday(ct.date)) <= 7
    WHERE v.type = 'out'
      AND v.id NOT IN ({})
    ORDER BY v.date
""".format(','.join(str(x[0]) for x in confirmed_fixes)))
remaining = c.fetchall()
print(f'Банкны зарлагатай таарах type="out" баримт (нотлогдоогүй): {len(remaining)}')
print(f'  {"ID":>6}  {"Огноо":12}  {"Дүн":>14}  {"VAT харилцагч":28}  {"Банкны тайлбар":35}')
print('  ' + '-'*110)
seen = set()
for r in remaining:
    key = (r[0], str(r[4]))
    if key in seen:
        continue
    seen.add(key)
    print(f'  {r[0]:>6}  {str(r[1]):12}  {r[2]:>14,.0f}  {str(r[3] or "")[:26]:28}  {str(r[5] or "")[:33]}')

conn.close()
print('\nДуусав.')
