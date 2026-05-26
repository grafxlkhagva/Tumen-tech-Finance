import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, VatRecord
from sqlalchemy import func

with app.app_context():
    # Давхардсан ДДТД олно
    dup_rows = db.session.query(
        VatRecord.ddtd,
        func.count(VatRecord.id).label('cnt'),
        func.sum(VatRecord.total_amount).label('total')
    ).filter(VatRecord.ddtd != None, VatRecord.ddtd != '')\
     .group_by(VatRecord.ddtd)\
     .having(func.count(VatRecord.id) > 1)\
     .order_by(func.count(VatRecord.id).desc())\
     .all()

    print(f"Давхардсан ДДТД тоо: {len(dup_rows)}\n")

    total_extra = 0
    for ddtd, cnt, total in dup_rows:
        recs = VatRecord.query.filter_by(ddtd=ddtd).all()
        print(f"ДДТД: {ddtd} ({cnt} бичлэг)")
        for r in recs:
            print(f"  id={r.id} | {r.date} | {r.partner_name} | нийт={r.total_amount:,.0f}₮ | тип={r.type} | сар={r.month}")
        # Давхардлын илүүдэл
        amounts = [r.total_amount or 0 for r in recs]
        extra = sum(amounts) - max(amounts)
        total_extra += extra
        print(f"  → Илүүдэл: {extra:,.0f}₮")
        print()

    print(f"Нийт хэт тооцогдсон дүн: {total_extra:,.0f}₮")
