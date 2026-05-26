import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, VatRecord
from sqlalchemy import func

with app.app_context():
    # parent_ddtd-тэй баримтууд (дэд нэхэмжлэх)
    with_parent = VatRecord.query.filter(
        VatRecord.parent_ddtd != None, VatRecord.parent_ddtd != ''
    ).count()
    total = VatRecord.query.count()
    out_total = VatRecord.query.filter_by(type='out').count()

    print(f"Нийт VatRecord: {total}")
    print(f"  type='out': {out_total}")
    print(f"  parent_ddtd-тэй (дэд): {with_parent}")

    # parent_ddtd-тэй out баримтын нийт дүн
    parent_sum = db.session.query(func.sum(VatRecord.total_amount)).filter(
        VatRecord.type == 'out',
        VatRecord.parent_ddtd != None, VatRecord.parent_ddtd != ''
    ).scalar() or 0
    print(f"  parent_ddtd-тэй out-ийн нийт дүн: {parent_sum:,.0f}₮")

    # parent_ddtd-гүй out баримтын нийт дүн
    no_parent_sum = db.session.query(func.sum(VatRecord.total_amount)).filter(
        VatRecord.type == 'out',
        db.or_(VatRecord.parent_ddtd == None, VatRecord.parent_ddtd == '')
    ).scalar() or 0
    print(f"  parent_ddtd-гүй out-ийн нийт дүн: {no_parent_sum:,.0f}₮")
    print(f"  Нийт: {(parent_sum + no_parent_sum):,.0f}₮")

    print(f"\n=== АЛТГАНА-гийн бүрэн ДДТД ===")
    from app import Partner
    p = Partner.query.filter(Partner.name.ilike('%алтгана%')).first()
    if p:
        recs = VatRecord.query.filter_by(partner_id=p.id, type='out').all()
        for r in recs:
            print(f"  id={r.id} | {r.date} | ДДТД={r.ddtd} | parent={r.parent_ddtd} | нийт={r.total_amount:,.0f}₮")

    print(f"\n=== АПУ дэйри-гийн бүрэн ДДТД ===")
    p2 = Partner.query.filter(Partner.name.ilike('%апу дэйри%')).filter(Partner.is_active==True).first()
    if p2:
        recs2 = VatRecord.query.filter_by(partner_id=p2.id, type='out').all()
        for r in recs2:
            print(f"  id={r.id} | {r.date} | ДДТД={r.ddtd} | parent={r.parent_ddtd} | нийт={r.total_amount:,.0f}₮")
