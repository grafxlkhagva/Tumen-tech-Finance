import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, Journal, JournalLine

with app.app_context():
    # eBarimt / VAT холбоотой бүх журнал
    eb = Journal.query.filter(Journal.reference == 'eBarimt').count()
    vat = Journal.query.filter(Journal.number.like('VAT%')).count()
    noat = Journal.query.filter(Journal.number.like('NOAT%')).count()

    print(f"eBarimt reference журнал: {eb}")
    print(f"VAT- журнал: {vat}")
    print(f"NOAT- журнал: {noat}")

    # Бүх журналын тоо
    total = Journal.query.count()
    print(f"\nНийт журнал: {total}")

    # Одоо байгаа reference төрлүүд
    from sqlalchemy import func
    refs = db.session.query(Journal.reference, func.count(Journal.id)).group_by(Journal.reference).order_by(func.count(Journal.id).desc()).all()
    print("\nОдоо байгаа reference-үүд:")
    for ref, cnt in refs:
        print(f"  '{ref or '(хоосон)'}': {cnt}")
