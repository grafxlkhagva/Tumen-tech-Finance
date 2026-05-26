"""eBarimt 4 файлаас VatRecord цэвэр импорт"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import openpyxl
from datetime import datetime, date
from app import app, db, VatRecord, Partner

DOWN = r"C:\Users\natsa\Downloads"
FILES = [
    (fr"{DOWN}\Нэхэмжлэх (undefined)  [1,2,3,4,5сарууд]_export_1779775206595.xlsx",        'out', True),
    (fr"{DOWN}\Нэхэмжлэх (Байгууллагын борлуулалт)  [1,2,3,4,5сарууд]_export_1779775087402.xlsx", 'out', True),
    (fr"{DOWN}\Байгууллага хоорондын гүйлгээ (худалдан авалт) [1,2,3,4,5-р сарууд]_export_1779774997811.xlsx", 'in', False),
    (fr"{DOWN}\Байгууллага хоорондын гүйлгээ (борлуулалт) [1,2,3,4,5-р сарууд]_export_1779774981963.xlsx", 'out', False),
]

def norm_ddtd(v):
    if not v: return ''
    return str(v).strip().lstrip('0') or '0'

def to_float(v):
    if v is None: return 0.0
    try: return float(v)
    except: return 0.0

def to_date(v):
    if not v: return None
    if isinstance(v, (date, datetime)):
        return v.date() if isinstance(v, datetime) else v
    try: return datetime.strptime(str(v).strip(), '%Y-%m-%d').date()
    except: return None

def to_reg(v):
    if not v: return ''
    try: return str(int(float(str(v))))
    except: return str(v).strip()

def read_file(path, vtype, has_parent):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    records = []
    for r in rows[1:]:
        if not r or (not r[0] and not r[1]): continue
        if has_parent:
            parent=norm_ddtd(r[0]); ddtd=norm_ddtd(r[1]); dt=to_date(r[2])
            pname=str(r[3]).strip() if r[3] else ''; preg=to_reg(r[4])
            remain=to_float(r[5]); paid=to_float(r[6]); vat=to_float(r[7])
            total=to_float(r[8]); tax_tp=str(r[9]).strip() if r[9] else ''
            source=str(r[10]).strip() if r[10] else ''; status=''
        else:
            parent=''; ddtd=norm_ddtd(r[0]); dt=to_date(r[1])
            pname=str(r[2]).strip() if r[2] else ''; preg=to_reg(r[3])
            vat=to_float(r[4]); total=to_float(r[5])
            tax_tp=str(r[6]).strip() if r[6] else ''
            source=str(r[7]).strip() if r[7] else ''
            status=str(r[8]).strip() if r[8] else ''
            paid=0.0; remain=0.0
        if not ddtd or not dt: continue
        records.append({
            'ddtd': ddtd, 'parent_ddtd': parent or None, 'date': dt,
            'type': vtype, 'partner_name': pname, 'partner_reg': preg,
            'amount': round(max(0, total-vat), 4), 'vat_amount': round(vat, 4),
            'total_amount': round(total, 4), 'paid_amount': round(paid, 4),
            'remaining': round(remain, 4), 'tax_type': tax_tp,
            'source': source, 'status': status, 'month': dt.month,
        })
    return records

with app.app_context():
    deleted = VatRecord.query.delete()
    db.session.commit()
    print(f'Устгасан: {deleted} VatRecord')

    reg_map = {p.register: p.id for p in Partner.query.filter(Partner.register != None, Partner.register != '').all()}
    print(f'Partner map: {len(reg_map)}')

    all_recs = []; seen_ddtd = set()
    for path, vtype, has_parent in FILES:
        fname = path.split('\\')[-1][:60]
        recs = read_file(path, vtype, has_parent)
        new_c = dup_c = 0
        for rec in recs:
            if rec['ddtd'] in seen_ddtd: dup_c += 1; continue
            seen_ddtd.add(rec['ddtd']); all_recs.append(rec); new_c += 1
        print(f'  {fname}: {new_c} шинэ, {dup_c} давхардсан')

    pid_matched = 0
    for rec in all_recs:
        pid = reg_map.get(rec['partner_reg'])
        if pid: pid_matched += 1
        db.session.add(VatRecord(
            ddtd=rec['ddtd'], parent_ddtd=rec['parent_ddtd'], date=rec['date'],
            type=rec['type'], partner_name=rec['partner_name'],
            partner_register=rec['partner_reg'], amount=rec['amount'],
            vat_amount=rec['vat_amount'], total_amount=rec['total_amount'],
            paid_amount=rec['paid_amount'], remaining=rec['remaining'],
            tax_type=rec['tax_type'], source=rec['source'],
            ebarimt_status=rec['status'], month=rec['month'], partner_id=pid,
        ))
    db.session.commit()

    total = VatRecord.query.count()
    out_t = VatRecord.query.filter_by(type='out').count()
    in_t  = VatRecord.query.filter_by(type='in').count()
    with_parent = VatRecord.query.filter(VatRecord.parent_ddtd != None, VatRecord.parent_ddtd != '').count()
    print(f'\n{"="*50}')
    print(f'Нийт           : {total}')
    print(f'  OUT          : {out_t}')
    print(f'  IN           : {in_t}')
    print(f'  Анхны        : {total - with_parent}')
    print(f'  Хаалтын      : {with_parent}')
    print(f'Partner тулгасан: {pid_matched}/{total}')

    han = Partner.query.filter_by(register='6413811').first()
    if han:
        han_recs = VatRecord.query.filter(VatRecord.partner_id==han.id, VatRecord.type=='out',
            db.or_(VatRecord.parent_ddtd==None, VatRecord.parent_ddtd=='')).all()
        print(f'\nХан Алтай: {len(han_recs)} баримт, {sum(v.total_amount for v in han_recs):,.0f}₮')

    print('\n✅ Дуусав — журналын бичилт хийгдээгүй.')
