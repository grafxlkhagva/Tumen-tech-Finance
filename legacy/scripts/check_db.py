import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from app import app, db
from app import Account, Journal, JournalLine, CashTransaction, VatRecord, Partner, Receivable, Payable, FixedAsset
with app.app_context():
    print('=== МЭДЭЭЛЛИЙН САНГИЙН БАЙДАЛ ===')
    print(f'Данс (Account):         {Account.query.count()}')
    print(f'Журнал (Journal):       {Journal.query.count()}')
    print(f'Журналын мөр:           {JournalLine.query.count()}')
    print(f'Мөнгөн гүйлгээ (Cash): {CashTransaction.query.count()}')
    print(f'VatRecord:              {VatRecord.query.count()}')
    print(f'Харилцагч (Partner):    {Partner.query.count()}')
    print(f'Авлага (Receivable):    {Receivable.query.count()}')
    print(f'Өглөг (Payable):        {Payable.query.count()}')
    print(f'Үндсэн хөрөнгө:        {FixedAsset.query.count()}')
    for db_path in ['accounting.db', 'instance/accounting.db']:
        if os.path.exists(db_path):
            size_mb = os.path.getsize(db_path) / (1024*1024)
            print(f'\nDB файл: {db_path}  ({size_mb:.2f} MB)')
    uri = app.config.get('SQLALCHEMY_DATABASE_URI','?')
    print(f'DB URI: {uri}')
