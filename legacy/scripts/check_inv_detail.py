import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, Journal, JournalLine, Account

with app.app_context():
    # Нэг жишээ журналын мөрүүд
    print("=== RECV-INV журналын бичилтийн хэлбэр ===\n")

    samples = Journal.query.filter(Journal.number.like('RECV-%')).order_by(Journal.date.desc()).limit(5).all()
    for j in samples:
        print(f"Журнал: {j.number} | {j.date} | {j.description} | {j.status}")
        lines = JournalLine.query.filter_by(journal_id=j.id).all()
        for l in lines:
            dt_acc = Account.query.get(l.debit_account_id)
            kt_acc = Account.query.get(l.credit_account_id)
            dt_str = f"{dt_acc.code} {dt_acc.name}" if dt_acc else "?"
            kt_str = f"{kt_acc.code} {kt_acc.name}" if kt_acc else "?"
            print(f"   ДТ: {dt_str}")
            print(f"   КТ: {kt_str}")
            print(f"   Дүн: {l.amount:,.0f}₮")
        print()

    # Нийт дүн
    from sqlalchemy import func
    print("=== RECV журналын нийт дүн (posted) ===")
    total = db.session.query(func.sum(JournalLine.amount)).join(Journal).filter(
        Journal.number.like('RECV-%'),
        Journal.status == 'posted'
    ).scalar() or 0
    print(f"  Нийт: {total:,.0f}₮")
    print(f"  Тоо: 352 журнал")
