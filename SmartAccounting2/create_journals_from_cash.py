import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app, db, Account, Journal, JournalLine, CashTransaction
from datetime import datetime

# Full account map for Tumen Teekh
ACCOUNTS_TO_ADD = [
    # Мөнгөн хөрөнгө — банк
    ('1121', 'ХХБ / ТДБ данс — 411096635', 'asset', '1020'),
    ('1122', 'Голомт банк — 1175156757', 'asset', '1020'),
    ('1123', 'М банк — 9006906192', 'asset', '1020'),
    # Авлага
    ('1281', 'Авлага — үйлчилгээний', 'asset', '1100'),
    ('1282', 'Авлага — бусад', 'asset', '1100'),
    # Өглөг / Урьдчилгаа
    ('3110', 'Худалдан авагчаас авсан урьдчилгаа', 'liability', '2000'),
    ('3111', 'Урьдчилгаа өглөг — бусад', 'liability', '2000'),
    ('3141', 'Бэлтгэн нийлүүлэгчид өглөг', 'liability', '2000'),
    ('3143', 'Барьцаа, баталгааны өглөг', 'liability', '2000'),
    ('3210', 'Цалингийн өглөг', 'liability', '2000'),
    ('3211', 'НДШ өглөг', 'liability', '2020'),
    ('3321', 'Бусад өглөг', 'liability', '2000'),
    ('2112', 'Урт хугацааны зээл', 'liability', '2500'),
    ('2151', 'Бусад урт хугацааны өглөг 1', 'liability', '2500'),
    ('2161', 'Бусад урт хугацааны өглөг 2', 'liability', '2500'),
    ('2171', 'Бусад урт хугацааны өглөг 3', 'liability', '2500'),
    ('2219', 'Бусад өглөг', 'liability', '2000'),
    # Орлого
    ('6110', 'Тээвэрлэлтийн орлого', 'income', '4000'),
    ('6190', 'Бусад үйлчилгээний орлого', 'income', '4000'),
    # Зардал
    ('7110', 'Шатахуун, тосолгооны материал', 'expense', '5200'),
    ('7210', 'Зам, гүүрийн хураамж', 'expense', '5200'),
    ('7220', 'Гаалийн татвар, хураамж', 'expense', '5200'),
    ('7240', 'Машин механизмын засвар', 'expense', '5200'),
    ('7260', 'Бусад тээвэр зардал', 'expense', '5200'),
    ('7300', 'Ерөнхий зардал', 'expense', '5900'),
    ('7340', 'Банкны шимтгэл, хураамж', 'expense', '5900'),
    # Материал
    ('1210', 'Бараа материал — нөөц', 'asset', '1200'),
]

with app.app_context():
    db.create_all()

    # 1. Add missing accounts
    code_to_id = {}
    added = 0
    for code, name, atype, parent_code in ACCOUNTS_TO_ADD:
        existing = Account.query.filter_by(code=code).first()
        if existing:
            code_to_id[code] = existing.id
            continue
        parent = Account.query.filter_by(code=parent_code).first()
        acc = Account(code=code, name=name, type=atype, parent_id=parent.id if parent else None)
        db.session.add(acc)
        db.session.flush()
        code_to_id[code] = acc.id
        added += 1

    # also load existing accounts
    for acc in Account.query.all():
        code_to_id[acc.code] = acc.id

    db.session.commit()
    print(f"Accounts added: {added}, total mapped: {len(code_to_id)}")

    # 2. Remove old auto-created journals from cash (if any)
    Journal.query.filter(Journal.number.like('CASH-%')).delete()
    db.session.commit()

    # 3. Create journal entries from cash transactions
    txns = CashTransaction.query.order_by(CashTransaction.date).all()
    print(f"Processing {len(txns)} cash transactions...")

    created = 0
    skipped = 0
    batch_journals = []

    for t in txns:
        dt_code = (t.debit_acc or '').strip()
        kt_code = (t.credit_acc or '').strip()
        amount = (t.income or 0) + (t.expense or 0)

        if not dt_code or not kt_code or amount <= 0:
            skipped += 1
            continue

        dt_id = code_to_id.get(dt_code)
        kt_id = code_to_id.get(kt_code)

        if not dt_id or not kt_id:
            skipped += 1
            continue

        jnl = Journal(
            date=t.date.date() if t.date else None,
            number=f"CASH-{t.id:05d}",
            description=t.description[:200] if t.description else '',
            reference=t.bank,
            status='posted'
        )
        db.session.add(jnl)
        db.session.flush()

        line = JournalLine(
            journal_id=jnl.id,
            debit_account_id=dt_id,
            credit_account_id=kt_id,
            amount=amount,
            description=t.partner_name or ''
        )
        db.session.add(line)
        created += 1

        if created % 200 == 0:
            db.session.commit()
            print(f"  {created} journals created...")

    db.session.commit()
    print(f"\nDone! Created: {created}, Skipped: {skipped}")

    # Summary
    from sqlalchemy import func
    total_posted = Journal.query.filter_by(status='posted').count()
    total_lines = JournalLine.query.count()
    print(f"Total posted journals: {total_posted}")
    print(f"Total journal lines: {total_lines}")

    # Check key account balances
    def bal(code):
        acc = Account.query.filter_by(code=code).first()
        if not acc: return 0
        d = db.session.query(func.sum(JournalLine.amount)).filter(
            JournalLine.debit_account_id == acc.id,
            JournalLine.journal.has(status='posted')
        ).scalar() or 0
        c = db.session.query(func.sum(JournalLine.amount)).filter(
            JournalLine.credit_account_id == acc.id,
            JournalLine.journal.has(status='posted')
        ).scalar() or 0
        return d - c

    print("\n=== Дансны үлдэгдэл ===")
    for code in ['1121','1122','1123','6110','7340','3110']:
        print(f"  {code}: {bal(code):,.0f}₮")
