import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, Journal, JournalLine

with app.app_context():
    # EB- журналуудыг олно
    eb_journals = Journal.query.filter(Journal.reference == 'eBarimt').all()
    print(f"Олдсон EB журнал: {len(eb_journals)}")

    total_lines = 0
    for j in eb_journals:
        lines = JournalLine.query.filter_by(journal_id=j.id).all()
        total_lines += len(lines)
        print(f"  Устгаж байна: {j.number} | {j.date} | {j.description[:60]} | {len(lines)} мөр")
        for l in lines:
            db.session.delete(l)
        db.session.delete(j)

    db.session.commit()
    print(f"\n✓ {len(eb_journals)} журнал, {total_lines} мөр амжилттай устгагдлаа.")

    # Шалгалт
    remaining = Journal.query.filter(Journal.reference == 'eBarimt').count()
    print(f"Үлдсэн EB журнал: {remaining}")
