import sqlite3, sys, io, json, re
from collections import defaultdict
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
    bod  = base / th * worked if th > 0 else 0
    niit = bod + phone + sales + leave
    em   = min(niit, EMNDSH_CAP) * 0.115
    d23  = art231(niit)
    hh   = max(0.0, (niit - em) * 0.1 - d23)
    adv  = (adv_base if adv_base else base) * 0.4
    return dict(bod=bod, niit=niit, em=em, hh=hh, adv=adv,
                net=niit - em - hh, gart=niit - em - hh - adv, th=th)

# ── SALARY_HISTORY унших ──────────────────────────────────────
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

# adv_base: 1-3 сар / 4-р сараас өөрчлөгдсөн
ADV_BASE_13 = {
    'Отгонбаатар': None,          # base*0.4 = 2,160,000
    'Уранзаяа':    None,          # base*0.4 = 1,160,000
    'Нямдорж':     3_000_000,     # →1,200,000
    'Одонтунгалаг':2_800_000,     # →1,120,000
    'Тэргэл':      None,          # base*0.4 = 1,120,000
    'Баяраа':      2_800_000,     # →1,120,000
}
ADV_BASE_4 = {
    'Отгонбаатар': None,
    'Уранзаяа':    None,
    'Нямдорж':     3_500_000,     # →1,400,000
    'Одонтунгалаг':3_000_000,     # →1,200,000
    'Тэргэл':      None,          # →1,120,000
    'Баяраа':      3_200_000,     # →1,280,000
}

# ── Банкны гүйлгээ ────────────────────────────────────────────
conn = sqlite3.connect('instance/accounting.db')
c    = conn.cursor()
c.execute('''SELECT date, description, partner_name, expense
             FROM cash_transactions
             WHERE expense_cat='2.1.1' AND year=2026 AND month <= 5
             ORDER BY date''')
bank_rows = c.fetchall()

PNAME_MAP = {
    'ОТГОНБААТАР': 'Отгонбаатар',
    'УРАНЗАЯА':    'Уранзаяа',
    'НЯМДОРЖ':     'Нямдорж',
    'ОДОНТУНГАЛАГ':'Одонтунгалаг',
    'ТЭРГЭЛ':      'Тэргэл',
    'БАЯРАА':      'Баяраа',
}

def get_emp(pname):
    pu = pname.upper()
    for k, v in PNAME_MAP.items():
        if k in pu: return v
    return None

def get_sal_month(desc):
    m = re.search(r'(\d{1,2})-р сар', desc)
    return int(m.group(1)) if m else None

# bank[сар][ажилтан] = {adv, final}
bank = defaultdict(lambda: defaultdict(lambda: {'adv': 0.0, 'final': 0.0}))
for row in bank_rows:
    dt, desc, pname, exp = row
    emp = get_emp(pname)
    if not emp: continue
    sal_month = get_sal_month(desc)
    if sal_month is None: continue
    if sal_month == 12: continue   # 12-р сарын сүүл → өмнөх жил, 1-4-р сарын тулгалтад оруулахгүй
    if sal_month > 4:   continue
    is_adv = 'урьдчилгаа' in desc
    if is_adv:
        bank[sal_month][emp]['adv']   += exp
    else:
        bank[sal_month][emp]['final'] += exp

# ── HISTORY-аас Түмэн Тээхийн ажилтнуудын өгөгдөл ────────────
hist = {}
for rec in history:
    if rec['year'] == 2026 and 1 <= rec.get('month', 0) <= 4:
        m = rec['month']
        for e in rec['emps']:
            if e['name'] in TUMEN:
                key = (m, e['name'])
                if key not in hist:          # давхардлаас зайлсхийх
                    hist[key] = e

# ── Тулгалтын гаралт ─────────────────────────────────────────
ORDER = ['Отгонбаатар', 'Уранзаяа', 'Нямдорж', 'Одонтунгалаг', 'Тэргэл', 'Баяраа']
W = 116

print()
print('╔' + '═'*W + '╗')
print('║' + '  2026 ОНЫ 1–4 САРЫН ЦАЛИНГИЙН ТУЛГАЛТ'.center(W) + '║')
print('╠' + '═'*W + '╣')
hdr = (f"{'Ажилтан':14s} {'Цаг':>9s}  {'Бодогдсон':>11s}  {'ЭМНДШ':>9s}  "
       f"{'ХХОАТ':>8s}  {'Цэвэр':>11s}  {'Урьдч(б)':>10s}  "
       f"{'Сүүл(б)':>10s}  {'Нийт(б)':>10s}  {'Зөрүү':>9s}")
print(f'║ {hdr} ║')
print('╠' + '═'*W + '╣')

month_totals = {}

for month in [1, 2, 3, 4]:
    mname = f'{month}-р сар'
    print(f'║{mname.center(W)}║')
    print('╠' + '─'*W + '╣')

    mt = dict(niit=0, em=0, hh=0, net=0, b_adv=0, b_final=0, diff=0)

    for emp in ORDER:
        key = (month, emp)
        b_adv   = bank[month][emp]['adv']
        b_final = bank[month][emp]['final']
        b_total = b_adv + b_final

        # Хоёулаа 0 бол энэ ажилтан энэ сард байхгүй
        if key not in hist and b_total == 0:
            continue

        if key in hist:
            e  = hist[key]
            ab = ADV_BASE_4[emp] if month == 4 else ADV_BASE_13[emp]
            r  = calc(e['base'], e.get('worked', 0), month,
                      phone=e.get('phone', 0), sales=e.get('sales', 0),
                      leave=e.get('leave', 0), adv_base=ab)
            worked_str = f"{e.get('worked', 0):.0f}/{r['th']}"
            niit_s = f"{r['niit']:>11,.0f}"
            em_s   = f"{r['em']:>9,.0f}"
            hh_s   = f"{r['hh']:>8,.0f}"
            net_s  = f"{r['net']:>11,.0f}"
            calc_net = r['net']
            mt['niit'] += r['niit']
            mt['em']   += r['em']
            mt['hh']   += r['hh']
            mt['net']  += r['net']
        else:
            worked_str = '?/?'
            niit_s = em_s = hh_s = net_s = f"{'?':>11s}"
            calc_net = None

        diff = round(calc_net - b_total) if calc_net is not None else 0
        flag = '  ←' if abs(diff) >= 1000 else '   '

        mt['b_adv']   += b_adv
        mt['b_final'] += b_final
        mt['diff']    += diff

        row = (f"{emp:14s} {worked_str:>9s}  {niit_s}  {em_s}  {hh_s}  "
               f"{net_s}  {b_adv:>10,.0f}  {b_final:>10,.0f}  "
               f"{b_total:>10,.0f}  {diff:>9,.0f}{flag}")
        print(f'║ {row} ║')

    print('╠' + '─'*W + '╣')
    dun = (f"{'Дүн':14s} {'':>9s}  {mt['niit']:>11,.0f}  {mt['em']:>9,.0f}  {mt['hh']:>8,.0f}  "
           f"{mt['net']:>11,.0f}  {mt['b_adv']:>10,.0f}  {mt['b_final']:>10,.0f}  "
           f"{mt['b_adv']+mt['b_final']:>10,.0f}  {mt['diff']:>9,.0f}")
    print(f'║ {dun} ║')
    month_totals[month] = mt
    print('╠' + '═'*W + '╣')

# ── Нийт дүн ─────────────────────────────────────────────────
g = dict(niit=0, em=0, hh=0, net=0, b_adv=0, b_final=0, diff=0)
for m in [1, 2, 3, 4]:
    for k in g: g[k] += month_totals[m][k]

grand = (f"{'НИЙТ 1-4 САР':14s} {'':>9s}  {g['niit']:>11,.0f}  {g['em']:>9,.0f}  {g['hh']:>8,.0f}  "
         f"{g['net']:>11,.0f}  {g['b_adv']:>10,.0f}  {g['b_final']:>10,.0f}  "
         f"{g['b_adv']+g['b_final']:>10,.0f}  {g['diff']:>9,.0f}")
print(f'║ {grand} ║')
print('╚' + '═'*W + '╝')

print()
print('Тайлбар:')
print('  Цаг        = Ажилласан цаг / Тухайн сарын нийт цаг')
print('  Бодогдсон  = Бодогдсон цалин (бод + утас + борлуулалт + чөлөөт)')
print('  Цэвэр      = Бодогдсон − ЭМНДШ − ХХОАТ  (банкаас олгох ёстой нийт)')
print('  Урьдч(б)   = Банкнаас олгосон урьдчилгаа')
print('  Сүүл(б)    = Банкнаас олгосон сүүл цалин')
print('  Нийт(б)    = Урьдч(б) + Сүүл(б)')
print('  Зөрүү      = Цэвэр − Нийт(б)  (+ = илүү тооцоолсон, − = илүү төлсөн)')
print()

# ── Зөрүү байгаа мөрүүд тайлбарлах ──────────────────────────
print('Анхаарал татсан зөрүүнүүд:')
for month in [1, 2, 3, 4]:
    for emp in ORDER:
        key = (month, emp)
        if key not in hist: continue
        e  = hist[key]
        ab = ADV_BASE_4[emp] if month == 4 else ADV_BASE_13[emp]
        r  = calc(e['base'], e.get('worked',0), month,
                  phone=e.get('phone',0), sales=e.get('sales',0),
                  leave=e.get('leave',0), adv_base=ab)
        b_total = bank[month][emp]['adv'] + bank[month][emp]['final']
        diff = round(r['net'] - b_total)
        if abs(diff) >= 1000:
            print(f'  {month}-р сар  {emp:14s}  тооцоолол={r["net"]:>10,.0f}  банк={b_total:>10,.0f}  зөрүү={diff:>+10,.0f}')
