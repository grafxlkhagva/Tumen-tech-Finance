import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, db, Account, Journal, JournalLine, FixedAsset

FA_ACCOUNTS = [
    ('200201','Барилга, байгуулам'),
    ('200301','Машин, тоног төхөөрөмж'),
    ('200401','Тээврийн хэрэгсэл'),
    ('200501','Тавилга эд хогшил'),
    ('200601','Компьютер, бусад хэрэгсэл'),
    ('200701','Бусад үндсэн хөрөнгө'),
    ('200801','Холбооны тоног төхөөрөмж'),
    ('201001','Бусад эргэлтийн бус хөрөнгө'),
    ('201201','Барилга хуримтлагдсан элэгдэл'),
    ('201301','Машин, тоног төхөөрөмж хуримтлагдсан элэгдэл'),
    ('201401','Тээврийн хэрэгсэл хуримтлагдсан элэгдэл'),
    ('201501','Тавилга эд хогшил хуримтлагдсан элэгдэл'),
    ('201601','Компьютер, бусад хэрэгсэл хуримтлагдсан элэгдэл'),
    ('201701','Бусад үндсэн хөрөнгө хуримтлагдсан элэгдэл'),
    ('201801','Холбооны тоног төхөөрөмж хуримтлагдсан элэгдэл'),
]
FA_MAP = {
    'FA-001': {'cost': '200501', 'depr': '201501'},
    'FA-002': {'cost': '200601', 'depr': '201601'},
    'FA-003': {'cost': '200701', 'depr': '201701'},
    'FA-004': {'cost': '201001', 'depr': None},
}

with app.app_context():
    acc_by_code = {}
    for code, name in FA_ACCOUNTS:
        a = Account.query.filter_by(code=code).first()
        if not a:
            a = Account(code=code, name=name, is_active=True, type='asset')
            db.session.add(a)
            db.session.flush()
            print(f'  Шинэ данс: {code} — {name}')
        else:
            print(f'  Байсан: {code}')
        acc_by_code[code] = a
    db.session.flush()

    acc_1590 = Account.query.filter_by(code='1590').first()
    acc_5310 = Account.query.filter_by(code='5310').first()

    # 1590 буруу OB мөрийг устга
    old = JournalLine.query.filter_by(journal_id=3124, debit_account_id=acc_1590.id).first()
    if old:
        amt = old.amount
        db.session.delete(old)
        print(f'  1590 DT мөр устгагдлаа: {amt:,.0f}')

    # Шинэ зөв мөрүүд
    fas = FixedAsset.query.filter_by(status='active').all()
    for fa in fas:
        m = FA_MAP.get(fa.code)
        if not m:
            continue
        cost_code = m['cost']
        depr_code = m['depr']
        cost_acc  = acc_by_code.get(cost_code)

        if fa.purchase_amount > 0 and cost_acc:
            desc = 'Эхний үлдэгдэл — ' + cost_code + ' ' + fa.name
            db.session.add(JournalLine(
                journal_id=3124,
                debit_account_id=cost_acc.id,
                credit_account_id=acc_5310.id,
                amount=fa.purchase_amount,
                description=desc))
            print(f'  DT {cost_code}  KT 5310  {fa.purchase_amount:>15,.0f}  {fa.name}')

        if depr_code and fa.accumulated_depreciation > 0:
            depr_acc = acc_by_code.get(depr_code)
            if depr_acc:
                desc = 'Эхний үлдэгдэл — ' + depr_code + ' элэгдэл'
                db.session.add(JournalLine(
                    journal_id=3124,
                    debit_account_id=acc_5310.id,
                    credit_account_id=depr_acc.id,
                    amount=fa.accumulated_depreciation,
                    description=desc))
                print(f'  DT 5310   KT {depr_code}  {fa.accumulated_depreciation:>15,.0f}  элэгдэл')

    db.session.commit()
    print('\nДууслаа! Гүйлгээ баланс хуудасд шалгана уу.')
