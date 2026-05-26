import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, Journal, JournalLine, Account
from sqlalchemy import func

with app.app_context():
    # Receivable/invoice холбоотой журналуудыг харна
    # reference эсвэл number-аар INV, receivable, авлага гэж хайна
    print("=== INV / Авлага / Нэхэмжлэх холбоотой журналууд ===\n")

    inv_journals = Journal.query.filter(
        db.or_(
            Journal.number.like('INV%'),
            Journal.reference.like('%INV%'),
            Journal.reference.like('%receivable%'),
            Journal.reference.like('%invoice%'),
            Journal.description.like('%нэхэмжлэх%'),
            Journal.description.like('%авлага%'),
            Journal.description.like('%invoice%'),
        )
    ).order_by(Journal.date.desc()).all()

    print(f"INV/Авлага журнал: {inv_journals.__len__()}")
    for j in inv_journals[:20]:
        lines = JournalLine.query.filter_by(journal_id=j.id).all()
        print(f"  {j.number} | {j.date} | {j.description[:50]} | ref={j.reference} | status={j.status} | {len(lines)} мөр")

    print("\n=== Бүх журналын reference төрлүүд ===")
    refs = db.session.query(Journal.reference, func.count(Journal.id)).group_by(Journal.reference).all()
    for ref, cnt in sorted(refs, key=lambda x: -(x[1])):
        print(f"  {ref or '(хоосон)'}: {cnt} журнал")

    print("\n=== Бүх журналын number угтвар ===")
    from sqlalchemy import func as f
    rows = db.session.execute(db.text(
        "SELECT SUBSTR(number,1,6) as pfx, COUNT(*) as cnt FROM journals GROUP BY pfx ORDER BY cnt DESC LIMIT 20"
    )).fetchall()
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
