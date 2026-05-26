import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, VatRecord, Partner
from sqlalchemy import func

with app.app_context():
    # Дэлгэцэнд харагдаж байгаа харилцагчдыг шалгана
    names = ['АЛТГАНА', 'Хан Алтай', 'АПУ', 'Говь Рэмэут']

    for name in names:
        partners = Partner.query.filter(Partner.name.ilike(f'%{name}%')).all()
        print(f"\n=== {name} ===")
        for p in partners:
            print(f"  Partner: {p.name} (id={p.id}, reg={p.register})")
            recs = VatRecord.query.filter_by(partner_id=p.id, type='out').all()
            reg_recs = VatRecord.query.filter(
                VatRecord.partner_register == p.register,
                VatRecord.type == 'out',
                VatRecord.partner_id == None
            ).all() if p.register else []

            total_amt = sum(r.total_amount or 0 for r in recs)
            reg_total = sum(r.total_amount or 0 for r in reg_recs)

            print(f"  partner_id-тэй баримт: {len(recs)} ширхэг | нийт: {total_amt:,.0f}₮")
            print(f"  register-тэй (partner_id=NULL): {len(reg_recs)} ширхэг | {reg_total:,.0f}₮")

            # Баримт бүрийн дүн
            for r in recs[:10]:
                print(f"    {r.date} | {r.ddtd[:20] if r.ddtd else '-'} | нийт={r.total_amount:,.0f}₮ | НӨАТ={r.vat_amount:,.0f}₮ | дүн={r.amount:,.0f}₮ | сар={r.month}")

            # Давхардал шалгах
            ddtds = [r.ddtd for r in recs if r.ddtd]
            dup = len(ddtds) - len(set(ddtds))
            if dup > 0:
                print(f"  ⚠ Давхардсан ДДТД: {dup}")

    # Нийт out vat_records-ын дүн
    print("\n=== Нийт eBarimt out баримт ===")
    total = db.session.query(func.sum(VatRecord.total_amount)).filter_by(type='out').scalar() or 0
    cnt = VatRecord.query.filter_by(type='out').count()
    print(f"  Нийт: {cnt} баримт | {total:,.0f}₮")

    # Сараар
    rows = db.session.query(VatRecord.month, func.count(VatRecord.id), func.sum(VatRecord.total_amount))\
        .filter_by(type='out').group_by(VatRecord.month).order_by(VatRecord.month).all()
    print("\n  Сараар:")
    for month, cnt, amt in rows:
        print(f"    {month}-р сар: {cnt} баримт | {amt:,.0f}₮")
