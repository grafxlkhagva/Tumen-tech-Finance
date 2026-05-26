"""
2026 оны 1-4 сарын цалингийн түүхийг salary_records хүснэгтэд хадгалах.
Банкны гүйлгээнд тохирсон advance утгыг ашиглана.
"""
import sqlite3, sys, io, json, re
from datetime import datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

MONTH_HOURS = {1:136, 2:152, 3:168, 4:176}
EMNDSH_CAP  = 7_920_000

def art231(n):
    if n <= 500_000:   return 20_000
    if n <= 1_000_000: return 18_000
    if n <= 1_500_000: return 16_000
    if n <= 2_000_000: return 14_000
    if n <= 2_500_000: return 12_000
    if n <= 3_000_000: return 10_000
    return 0

def calc(base, worked, month, phone=0, sales=0, leave=0, adv_base=None):
    th   = MONTH_HOURS[month]
    bod  = base / th * worked if th > 0 and worked > 0 else 0
    niit = bod + phone + sales + leave
    em   = min(niit, EMNDSH_CAP) * 0.115
    d23  = art231(niit)
    hh   = max(0.0, (niit - em) * 0.1 - d23)
    adv  = (adv_base if adv_base else base) * 0.4
    return dict(bod=bod, niit=niit, em=em, hh=hh, adv=adv,
                net=niit - em - hh, gart=niit - em - hh - adv, th=th, d23=d23)

# ── SALARY_HISTORY ────────────────────────────────────────────
with open(r'C:\Users\natsa\Desktop\2026\tsalin\цаг_бүртгэл.html', encoding='utf-8') as f:
    content = f.read()
idx   = content.find('SALARY_HISTORY')
start = content.index('[', idx)
depth = 0
for i, ch in enumerate(content[start:], start):
    if ch == '[':  depth += 1
    elif ch == ']': depth -= 1
    if depth == 0: end = i + 1; break
history = json.loads(content[start:end])

TUMEN = {'Отгонбаатар', 'Уранзаяа', 'Нямдорж', 'Одонтунгалаг', 'Тэргэл', 'Баяраа'}

ADV_BASE_13 = {
    'Отгонбаатар': None, 'Уранзаяа': None,
    'Нямдорж': 3_000_000, 'Одонтунгалаг': 2_800_000,
    'Тэргэл': None, 'Баяраа': 2_800_000,
}
ADV_BASE_4 = {
    'Отгонбаатар': None, 'Уранзаяа': None,
    'Нямдорж': 3_500_000, 'Одонтунгалаг': 3_000_000,
    'Тэргэл': None, 'Баяраа': 3_200_000,
}

# ── DB ────────────────────────────────────────────────────────
conn = sqlite3.connect('instance/accounting.db')
c    = conn.cursor()

# Ажилтнуудын ID авах
c.execute('SELECT id, name FROM employees')
emp_rows = c.fetchall()
EMP_ID = {}
for eid, ename in emp_rows:
    for key in TUMEN:
        if key in ename or ename in key:
            EMP_ID[key] = eid; break

print('Ажилтны ID:')
for k, v in EMP_ID.items():
    print(f'  {k}: {v}')

# Банкны гүйлгээ — advance болон final авах
c.execute('''SELECT date, description, partner_name, expense
             FROM cash_transactions
             WHERE expense_cat='2.1.1' AND year=2026 AND month<=5
             ORDER BY date''')
bank_rows = c.fetchall()

PNAME_MAP = {
    'ОТГОНБААТАР': 'Отгонбаатар', 'УРАНЗАЯА': 'Уранзаяа',
    'НЯМДОРЖ': 'Нямдорж', 'ОДОНТУНГАЛАГ': 'Одонтунгалаг',
    'ТЭРГЭЛ': 'Тэргэл', 'БАЯРАА': 'Баяраа',
}

from collections import defaultdict
bank = defaultdict(lambda: defaultdict(lambda: {'adv': 0.0, 'final': 0.0}))

for row in bank_rows:
    dt, desc, pname, exp = row
    emp = next((v for k, v in PNAME_MAP.items() if k in pname.upper()), None)
    if not emp: continue
    m = re.search(r'(\d{1,2})-р сар', desc)
    if not m: continue
    sal_month = int(m.group(1))
    if sal_month == 12 or sal_month > 4: continue
    if 'урьдчилгаа' in desc:
        bank[sal_month][emp]['adv']   += exp
    else:
        bank[sal_month][emp]['final'] += exp

# ── HISTORY-аас өгөгдөл авах ─────────────────────────────────
hist = {}
for rec in history:
    if rec['year'] == 2026 and 1 <= rec.get('month', 0) <= 4:
        for e in rec['emps']:
            if e['name'] in TUMEN:
                key = (rec['month'], e['name'])
                if key not in hist:
                    hist[key] = e

# 2-р сар Отгонбаатар worked=0 → банкны өгөгдлөөс тооцоолно
# банк: adv=2,160,000 + final=1,635,323 = 3,795,323
# Урвуу тооцоо: niit ≈ (3,795,323) / (1 - 0.115 - 0.0885) ≈ 4,765,000
# Гэхдээ үнэн цаг мэдэгдэхгүй тул worked=0 буюу НДШ-н тооцоог цагаар тохируулна
# → worked=-1 тэмдэгтэй оруулж, note-д тэмдэглэнэ
NOTE_OB_FEB = '2-р сарын ажилласан цаг цаг_бүртгэл.html-д 0 бичигдсэн (алдаа). Банкаас: нийт олгосон 3,795,323₮'

# ── SalaryRecord хадгалах ─────────────────────────────────────
ORDER = ['Отгонбаатар', 'Уранзаяа', 'Нямдорж', 'Одонтунгалаг', 'Тэргэл', 'Баяраа']
now   = datetime.now().isoformat()

# Өмнөх бичлэгүүдийг устгах (2026, 1-4 сар)
for emp_name in ORDER:
    if emp_name not in EMP_ID: continue
    c.execute('DELETE FROM salary_records WHERE employee_id=? AND year=2026 AND month<=4',
              (EMP_ID[emp_name],))
conn.commit()
print('\nӨмнөх 2026 1-4 сарын бичлэгүүд устгагдлаа.')

inserted = 0
for month in [1, 2, 3, 4]:
    for emp in ORDER:
        if emp not in EMP_ID: continue
        key    = (month, emp)
        b_adv  = bank[month][emp]['adv']
        b_fin  = bank[month][emp]['final']

        # Энэ ажилтан энэ сард байгаагүй
        if key not in hist and b_adv == 0 and b_fin == 0:
            continue

        note = ''
        if key in hist:
            e  = hist[key]
            ab = ADV_BASE_4[emp] if month == 4 else ADV_BASE_13[emp]
            r  = calc(e['base'], e.get('worked', 0), month,
                      phone=e.get('phone', 0), sales=e.get('sales', 0),
                      leave=e.get('leave', 0), adv_base=ab)
            worked_hrs = e.get('worked', 0)
            base_sal   = e['base']
            phone      = e.get('phone', 0)
            sales      = e.get('sales', 0)
            leave_pay  = e.get('leave', 0)
            if month == 2 and emp == 'Отгонбаатар' and worked_hrs == 0:
                note = NOTE_OB_FEB
        else:
            # Зөвхөн банкны дата байгаа үед
            base_sal = {'Отгонбаатар':5_400_000,'Уранзаяа':2_900_000,
                        'Нямдорж':3_000_000,'Одонтунгалаг':2_800_000,
                        'Тэргэл':2_800_000,'Баяраа':2_800_000}[emp]
            ab = ADV_BASE_4[emp] if month == 4 else ADV_BASE_13[emp]
            r  = calc(base_sal, MONTH_HOURS[month], month, adv_base=ab)
            worked_hrs = MONTH_HOURS[month]
            phone = sales = leave_pay = 0
            note = 'цаг_бүртгэл.html-д байхгүй; тооцоолол нийт цагаар'

        # adv_override: банкнаас авсан бодит урьдчилгаа
        adv_override = b_adv if b_adv > 0 else None

        c.execute('''INSERT INTO salary_records
            (employee_id, year, month, base_salary, worked_hrs, total_hrs,
             phone, sales_bonus, leave_pay, other_ded, adv_override,
             bod_salary, total_income, emndsh, hhoat_ded, hhoat,
             advance, net_pay, status, notes, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', (
            EMP_ID[emp], 2026, month,
            round(base_sal), round(worked_hrs, 1), MONTH_HOURS[month],
            round(phone), round(sales), round(leave_pay), 0,
            round(adv_override) if adv_override else None,
            round(r['bod']), round(r['niit']),
            round(r['em']), round(r['d23']), round(r['hh']),
            round(b_adv if b_adv > 0 else r['adv']),
            round(b_fin),   # net_pay = банкнаас олгосон сүүл цалин
            'paid', note, now, now
        ))
        inserted += 1

conn.commit()
print(f'{inserted} бичлэг salary_records-д хадгалагдлаа.\n')

# ── Тулгалтын хураангуй ──────────────────────────────────────
print('╔' + '═'*105 + '╗')
print('║' + '  2026 ОНЫ 1–4 САРЫН ЦАЛИНГИЙН ТУЛГАЛТ  (Цэвэр = тооцоолсон, Нийт(б) = банкнаас олгосон)'.center(105) + '║')
print('╠' + '═'*105 + '╣')
print(f'║ {"Ажилтан":14s} {"Цаг":>9s}  {"Бодогдсон":>11s}  {"ЭМНДШ":>9s}  {"ХХОАТ":>8s}  {"Цэвэр":>10s}  {"Урьдч(б)":>10s}  {"Сүүл(б)":>10s}  {"Нийт(б)":>10s}  {"Зөрүү":>8s} ║')
print('╠' + '═'*105 + '╣')

g = dict(niit=0, em=0, hh=0, net=0, b_adv=0, b_fin=0, diff=0)

for month in [1, 2, 3, 4]:
    mname = f'{month}-р сар'
    print(f'║{mname.center(105)}║')
    print('╠' + '─'*105 + '╣')
    mt = dict(niit=0, em=0, hh=0, net=0, b_adv=0, b_fin=0, diff=0)

    for emp in ORDER:
        key   = (month, emp)
        b_adv = bank[month][emp]['adv']
        b_fin = bank[month][emp]['final']
        b_tot = b_adv + b_fin
        if key not in hist and b_tot == 0: continue

        if key in hist:
            e  = hist[key]
            ab = ADV_BASE_4[emp] if month == 4 else ADV_BASE_13[emp]
            r  = calc(e['base'], e.get('worked',0), month,
                      phone=e.get('phone',0), sales=e.get('sales',0),
                      leave=e.get('leave',0), adv_base=ab)
            wstr = f"{e.get('worked',0):.0f}/{r['th']}"
            calc_net = r['net']
            mt['niit'] += r['niit']; mt['em'] += r['em']
            mt['hh']   += r['hh'];  mt['net'] += r['net']
        else:
            wstr = '?/?'; calc_net = 0

        diff = round(calc_net - b_tot)
        mt['b_adv'] += b_adv; mt['b_fin'] += b_fin; mt['diff'] += diff
        flag = '  ←' if abs(diff) >= 1000 else '   '
        if month == 2 and emp == 'Отгонбаатар':
            flag = '  ⚠'

        print(f'║ {emp:14s} {wstr:>9s}  {r["niit"] if key in hist else 0:>11,.0f}  '
              f'{r["em"] if key in hist else 0:>9,.0f}  {r["hh"] if key in hist else 0:>8,.0f}  '
              f'{calc_net:>10,.0f}  {b_adv:>10,.0f}  {b_fin:>10,.0f}  {b_tot:>10,.0f}  {diff:>8,.0f}{flag} ║')

    print('╠' + '─'*105 + '╣')
    print(f'║ {"Дүн":14s} {"":>9s}  {mt["niit"]:>11,.0f}  {mt["em"]:>9,.0f}  {mt["hh"]:>8,.0f}  '
          f'{mt["net"]:>10,.0f}  {mt["b_adv"]:>10,.0f}  {mt["b_fin"]:>10,.0f}  '
          f'{mt["b_adv"]+mt["b_fin"]:>10,.0f}  {mt["diff"]:>8,.0f} ║')
    for k in g: g[k] += mt[k]
    print('╠' + '═'*105 + '╣')

print(f'║ {"НИЙТ 1–4 САР":14s} {"":>9s}  {g["niit"]:>11,.0f}  {g["em"]:>9,.0f}  {g["hh"]:>8,.0f}  '
      f'{g["net"]:>10,.0f}  {g["b_adv"]:>10,.0f}  {g["b_fin"]:>10,.0f}  '
      f'{g["b_adv"]+g["b_fin"]:>10,.0f}  {g["diff"]:>8,.0f} ║')
print('╚' + '═'*105 + '╝')
print()
print('⚠  2-р сар / Отгонбаатар: цаг_бүртгэл.html-д worked=0 бичигдсэн. Банкны дата зөв.')
print('←  Зөрүү 1000₮-өөс дээш байна → шалгах шаардлагатай.')
print()
print(f'НИЙТ ЦАЛИНГИЙН ЗАРДАЛ (банкнаас, 1-4 сар): {g["b_adv"]+g["b_fin"]:,.0f}₮')
print(f'НИЙТ ТООЦООЛСОН ЦЭВЭР ЦАЛ.:               {g["net"]:,.0f}₮')
print(f'НИЙТ ЗӨРҮҮ:                                {g["diff"]:,.0f}₮')
