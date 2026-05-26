"""
Master Data TT (1).xlsx → Partners DB sync
Mapping sheet:
  A  = Код        (C10033-01)
  B  = тоо
  C  = Мастер нэр (canonical name)
  D..J = variant 1..7
  K  = Регистр
  L  = Гэрээний дугаар
  M  = Хаяг
  N  = Утас
  O  = Цахим шуудан
"""
import sys, io, json, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import openpyxl
from app import app, db, Partner

EXCEL = r"C:\Users\natsa\Downloads\Master Data TT (1).xlsx"

def clean(v):
    if v is None: return ''
    s = str(v).strip().rstrip('.')
    # Remove trailing dots, underscores and junk suffixes like _Ts
    s = re.sub(r'[_\.]+$', '', s).strip()
    return s

def clean_reg(v):
    if not v: return ''
    s = str(v).strip()
    # регистр нь тоо байвал бүхэл тоо болгоно
    try:
        return str(int(float(s)))
    except:
        return s

def clean_phone(v):
    if not v: return ''
    try:
        return str(int(float(str(v))))
    except:
        return str(v).strip()

wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
ws = wb['Mapping']
rows = list(ws.iter_rows(values_only=True))

# Row 0 = header, data from row 1
master_rows = []
for r in rows[1:]:
    if not r[0] or not str(r[0]).startswith('C'):
        continue
    code    = str(r[0]).strip()
    master  = clean(r[2])
    variants = list({clean(v) for v in r[3:10] if v and clean(v)})
    register = clean_reg(r[10])
    contract = clean(r[11])
    address  = clean(r[12])
    phone    = clean_phone(r[13])
    email    = clean(r[14])
    if not master:
        continue
    master_rows.append({
        'code': code, 'master': master, 'variants': variants,
        'register': register, 'contract': contract,
        'address': address, 'phone': phone, 'email': email,
    })

print(f'Excel-с уншсан: {len(master_rows)} харилцагч')

with app.app_context():
    stats = {'updated': 0, 'created': 0, 'skipped': 0}

    for m in master_rows:
        # 1. Кодоор хайх
        partner = Partner.query.filter_by(code=m['code']).first()

        # 2. Регистрээр хайх (кодгүй бол)
        if not partner and m['register']:
            partner = Partner.query.filter_by(register=m['register']).first()

        # 3. Мастер нэрээр хайх
        if not partner:
            partner = Partner.query.filter(
                db.func.lower(Partner.name) == m['master'].lower()
            ).first()

        # 4. Хувилбар нэрээр хайх
        if not partner:
            for v in m['variants']:
                if not v: continue
                partner = Partner.query.filter(
                    db.func.lower(Partner.name) == v.lower()
                ).first()
                if partner:
                    break

        if partner:
            # Шинэчлэх
            old_name = partner.name
            partner.code    = m['code']
            partner.name    = m['master']
            partner.register = m['register'] or partner.register
            if m['address']:  partner.address = m['address']
            if m['phone']:    partner.phone   = m['phone']
            if m['email']:    partner.email   = m['email']

            # aliases: мастер нэрийг оруулахгүй, зөвхөн хувилбарууд
            alias_set = set(v for v in m['variants'] if v and v.lower() != m['master'].lower())
            if old_name and old_name.lower() != m['master'].lower():
                alias_set.add(old_name)
            # Одоо байгаа aliases-ийг нэмнэ
            try:
                existing = json.loads(partner.aliases or '[]')
                alias_set.update(a for a in existing if a)
            except:
                pass
            partner.aliases = json.dumps(list(alias_set), ensure_ascii=False)

            stats['updated'] += 1
            if old_name != m['master']:
                print(f'  ✏ {m["code"]} | {old_name!r} → {m["master"]!r}')
            else:
                print(f'  ✓ {m["code"]} | {m["master"]} | aliases={len(alias_set)}')
        else:
            # Шинэ харилцагч үүсгэх
            alias_set = set(m['variants'])
            new_p = Partner(
                code     = m['code'],
                name     = m['master'],
                register = m['register'],
                address  = m['address'],
                phone    = m['phone'],
                email    = m['email'],
                type     = 'customer',
                is_active= True,
                aliases  = json.dumps(list(alias_set), ensure_ascii=False),
            )
            db.session.add(new_p)
            stats['created'] += 1
            print(f'  ➕ {m["code"]} | {m["master"]} (шинэ)')

    db.session.commit()
    print()
    print('='*55)
    print(f'Шинэчлэгдсэн : {stats["updated"]}')
    print(f'Шинээр нэмсэн: {stats["created"]}')
    print(f'Нийт         : {stats["updated"] + stats["created"]}')
    print()

    # Verification
    total = Partner.query.count()
    with_code = Partner.query.filter(Partner.code != None, Partner.code != '').count()
    with_alias = Partner.query.filter(Partner.aliases != None, Partner.aliases != '', Partner.aliases != '[]').count()
    print(f'DB нийт харилцагч : {total}')
    print(f'Кодтой            : {with_code}')
    print(f'Aliases бүртгэлтэй: {with_alias}')
