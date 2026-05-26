import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from app import app, db, Account, Journal, JournalLine
from datetime import date

# ── 2025-12-31 үлдэгдэл (Excel-с авсан) ──────────────────────────
OPENING = {
    # ХӨРӨНГӨ
    'cash_total':        173_733_062.20,   # 1.1.1 Мөнгө
    'recv_trade':        171_629_688.95,   # 1.1.2 Дансны авлага
    'recv_tax':                      0,   # 1.1.3 Татвар НДШ авлага
    'recv_other':        602_156_327.00,   # 1.1.4 Бусад авлага
    'prepaid':           197_719_079.71,   # 1.1.7 Урьдчилж төлсөн зардал
    'inventory':                     0,   # 1.1.6 Бараа материал
    'fixed_assets':       28_685_851.00,  # 1.2.1 Үндсэн хөрөнгө (цэвэр)
    # ӨР ТӨЛБӨР
    'ap_trade':          391_771_972.26,   # 2.1.1.1 Дансны өглөг
    'payroll_pay':        28_406_726.42,   # 2.1.1.2 Цалингийн өглөг
    'tax_pay':           238_952_813.30,   # 2.1.1.3 Татварын өр
    'ndsh_pay':           -7_211_944.25,  # 2.1.1.4 НДШ өглөг (сөрөг=авлага)
    # ӨМЧ
    'capital':                  20_000,   # 2.3.2 Хувийн өмч
    'retained':          521_984_441.13,  # 2.3.9 Хуримтлагдсан ашиг
}

# ── МУСБОУС стандартын дансны жагсаалт ──────────────────────────
ACCOUNTS = [
    # ── ЭРГЭЛТИЙН ХӨРӨНГӨ ──
    ('1100', 'Мөнгө, түүнтэй адилтгах хөрөнгө',        'asset',     None),
    ('1110', 'Касс',                                     'asset',   '1100'),
    ('1121', 'ХХБ / ТДБ данс — 411096635',              'asset',   '1100'),
    ('1122', 'Голомт банк — 1175156757',                 'asset',   '1100'),
    ('1123', 'М банк — 9006906192',                      'asset',   '1100'),
    ('1200', 'Дансны авлага',                            'asset',     None),
    ('1210', 'Худалдааны авлага',                        'asset',   '1200'),
    ('1220', 'Татвар, НДШ авлага',                       'asset',   '1200'),
    ('1230', 'Бусад авлага',                             'asset',   '1200'),
    ('1240', 'Дотоод авлага',                            'asset',   '1200'),
    ('1281', 'Авлага — үйлчилгээний',                   'asset',   '1200'),
    ('1282', 'Авлага — бусад',                           'asset',   '1200'),
    ('1300', 'Урьдчилгаа, түр зуурын зардал',            'asset',     None),
    ('1310', 'Урьдчилж төлсөн зардал/тооцоо',           'asset',   '1300'),
    ('1320', 'Нийлүүлэгчдэд өгсөн урьдчилгаа',          'asset',   '1300'),
    ('1400', 'Бараа материал',                           'asset',     None),
    ('1410', 'Түлш, шатахуун',                          'asset',   '1400'),
    ('1420', 'Сэлбэг хэрэгсэл',                         'asset',   '1400'),
    ('1430', 'Бусад бараа материал',                     'asset',   '1400'),
    # ── ЭРГЭЛТИЙН БУС ХӨРӨНГӨ ──
    ('1500', 'Эргэлтийн бус хөрөнгө',                   'asset',     None),
    ('1510', 'Үндсэн хөрөнгө (нийт)',                   'asset',   '1500'),
    ('1511', 'Тээврийн хэрэгсэл',                       'asset',   '1500'),
    ('1512', 'Тоног төхөөрөмж',                         'asset',   '1500'),
    ('1513', 'Барилга байгууламж',                       'asset',   '1500'),
    ('1590', 'Хуримтлагдсан элэгдэл',                   'asset',   '1500'),
    ('1600', 'Биет бус хөрөнгө',                        'asset',     None),
    ('1610', 'Програм хангамж',                         'asset',   '1600'),
    # ── БОГИНО ХУГАЦААТ ӨР ТӨЛБӨР ──
    ('3000', 'Богино хугацаат өр төлбөр',               'liability',  None),
    ('3100', 'Дансны өглөг',                            'liability','3000'),
    ('3110', 'Худалдааны өглөг / нийлүүлэгч',           'liability','3100'),
    ('3111', 'Авлага — захиалагчийн урьдчилгаа',        'liability','3100'),
    ('3120', 'Цалингийн өглөг',                         'liability','3000'),
    ('3130', 'Татварын өглөг',                          'liability','3000'),
    ('3131', 'ААН орлогын татвар',                      'liability','3130'),
    ('3132', 'НӨАТ өглөг',                              'liability','3130'),
    ('3133', 'ХХОАТ өглөг',                             'liability','3130'),
    ('3140', 'НДШ өглөг',                               'liability','3000'),
    ('3141', 'Нийгмийн даатгал өглөг',                  'liability','3140'),
    ('3142', 'Эрүүл мэндийн даатгал өглөг',             'liability','3140'),
    ('3150', 'Бусад богино хугацаат өр',                'liability','3000'),
    ('3151', 'Захиалагчаас авсан урьдчилгаа',           'liability','3150'),
    ('3152', 'Банкны богино хугацаат зээл',             'liability','3150'),
    ('3153', 'Хүүний өглөг',                            'liability','3150'),
    ('3154', 'Бусад өглөг',                             'liability','3150'),
    ('3210', 'Бусад тооцоо',                            'liability','3000'),
    ('3211', 'НДШ тооцоо',                              'liability','3210'),
    ('3321', 'Бусад',                                   'liability','3000'),
    # ── УРТ ХУГАЦААТ ӨР ТӨЛБӨР ──
    ('4000', 'Урт хугацаат өр төлбөр',                  'liability',  None),
    ('4100', 'Урт хугацаат зээл',                       'liability','4000'),
    ('2112', 'Урт хугацаат зээл — банк',                'liability','4100'),
    ('2151', 'Урт хугацаат өглөг 1',                   'liability','4000'),
    ('2161', 'Урт хугацаат өглөг 2',                   'liability','4000'),
    ('2171', 'Урт хугацаат өглөг 3',                   'liability','4000'),
    ('2219', 'Бусад урт хугацаат өглөг',               'liability','4000'),
    ('3143', 'Барьцаа, баталгааны өглөг',               'liability','3000'),
    # ── ЭЗДИЙН ӨМЧ ──
    ('5000', 'Эздийн өмч',                              'equity',    None),
    ('5100', 'Дүрмийн сан',                             'equity',  '5000'),
    ('5110', 'Хувийн өмч — дүрмийн сан',               'equity',  '5100'),
    ('5200', 'Нэмж төлөгдсөн капитал',                  'equity',  '5000'),
    ('5300', 'Хуримтлагдсан ашиг',                      'equity',  '5000'),
    ('5310', 'Хуримтлагдсан ашиг (алдагдал)',           'equity',  '5300'),
    ('5320', 'Тайлант үеийн цэвэр ашиг',               'equity',  '5300'),
    # ── БОРЛУУЛАЛТЫН ОРЛОГО ──
    ('6000', 'Борлуулалтын орлого',                     'income',    None),
    ('6100', 'Тээвэрлэлтийн орлого',                   'income',  '6000'),
    ('6110', 'Дотоод тээвэр',                           'income',  '6100'),
    ('6120', 'Олон улсын тээвэр',                       'income',  '6100'),
    ('6130', 'Агуулахын үйлчилгээ',                     'income',  '6100'),
    ('6190', 'Бусад үйлчилгээний орлого',               'income',  '6000'),
    ('6200', 'Санхүүгийн орлого',                       'income',    None),
    ('6210', 'Хүүний орлого',                           'income',  '6200'),
    # ── БОРЛУУЛСАН БҮТЭЭГДЭХҮҮНИЙ ӨРТӨГ ──
    ('7000', 'Борлуулсан бүтээгдэхүүний өртөг',         'expense',   None),
    ('7100', 'Шатахуун, тосолгоо',                      'expense', '7000'),
    ('7110', 'Шатахуун',                                'expense', '7100'),
    ('7120', 'Тосолгооны материал',                     'expense', '7100'),
    ('7200', 'Тээвэр зардал',                           'expense', '7000'),
    ('7210', 'Зам, гүүрийн хураамж',                   'expense', '7200'),
    ('7220', 'Гаалийн татвар, хураамж',                 'expense', '7200'),
    ('7230', 'Жолоочийн цалин',                         'expense', '7200'),
    ('7240', 'Машин засвар',                            'expense', '7200'),
    ('7250', 'Даатгал',                                 'expense', '7200'),
    ('7260', 'Бусад тээвэр зардал',                    'expense', '7200'),
    # ── ЕРӨНХИЙ БА УДИРДЛАГЫН ЗАРДАЛ ──
    ('8000', 'Ерөнхий ба удирдлагын зардал',            'expense',   None),
    ('8100', 'Цалин хөлс',                              'expense', '8000'),
    ('8110', 'Удирдлагын цалин',                        'expense', '8100'),
    ('8120', 'Ажилтны цалин',                           'expense', '8100'),
    ('8130', 'НДШ зардал (ажил олгогч)',                 'expense', '8100'),
    ('8200', 'Оффисын зардал',                          'expense', '8000'),
    ('8210', 'Түрээс',                                  'expense', '8200'),
    ('8220', 'Цахилгаан, дулаан, ус',                   'expense', '8200'),
    ('8230', 'Утас, интернет',                          'expense', '8200'),
    ('8240', 'Хэвлэл, хуулбар',                        'expense', '8200'),
    ('8250', 'Аялал, тээвэр',                           'expense', '8200'),
    ('8300', 'Татвар, хураамж',                         'expense', '8000'),
    ('8310', 'Орон нутгийн татвар',                     'expense', '8300'),
    ('8320', 'Тэмдэгтийн хураамж',                     'expense', '8300'),
    ('8400', 'Элэгдэл, хорогдол',                       'expense', '8000'),
    ('8410', 'Үндсэн хөрөнгийн элэгдэл',               'expense', '8400'),
    ('8420', 'Биет бус хөрөнгийн хорогдол',             'expense', '8400'),
    ('8500', 'Бусад зардал',                            'expense', '8000'),
    ('8510', 'Банкны шимтгэл',                          'expense', '8500'),
    ('7300', 'Ерөнхий зардал',                          'expense', '8000'),
    ('7340', 'Банкны шимтгэл, хураамж',                 'expense', '8500'),
    ('9000', 'Татвар',                                  'expense',   None),
    ('9100', 'Орлогын татвар',                          'expense', '9000'),
]

with app.app_context():
    db.create_all()

    # ── 1. Бүх данс арилгаж шинэчлэх ──
    print("Rebuilding chart of accounts...")
    JournalLine.query.delete()
    Journal.query.delete()
    Account.query.delete()
    db.session.commit()

    code_map = {}
    for code, name, atype, parent_code in ACCOUNTS:
        parent_id = code_map.get(parent_code) if parent_code else None
        acc = Account(code=code, name=name, type=atype, parent_id=parent_id, is_active=True)
        db.session.add(acc)
        db.session.flush()
        code_map[code] = acc.id
    db.session.commit()
    print(f"  Created {len(code_map)} accounts")

    # ── 2. Эхний үлдэгдэл (2026-01-01) ──
    print("Creating opening balance entry (2026-01-01)...")

    # Мөнгийг банкуудад хуваарилах
    # 2025 оны эцэст: ХХБ=?, Голомт=?, М=? — нийт 173,733,062.20
    # Харьяалалт мэдэгдэхгүй тул банк бүрт тэнцүү хуваана
    cash_per_bank = round(OPENING['cash_total'] / 3, 2)

    # Эхний үлдэгдлийн journal
    ob = Journal(
        date=date(2026, 1, 1),
        number='OB-2026-001',
        description='2026 оны 1-р сарын 1-ний эхний үлдэгдэл (2025-12-31 үлдэгдлээс)',
        reference='Тайлан TT 2025-12-31',
        status='posted'
    )
    db.session.add(ob)
    db.session.flush()

    def add_line(jid, dt_code, ct_code, amount, desc=''):
        if abs(amount) < 0.01:
            return
        if amount > 0:
            db.session.add(JournalLine(
                journal_id=jid,
                debit_account_id=code_map[dt_code],
                credit_account_id=code_map[ct_code],
                amount=abs(amount), description=desc))
        else:
            db.session.add(JournalLine(
                journal_id=jid,
                debit_account_id=code_map[ct_code],
                credit_account_id=code_map[dt_code],
                amount=abs(amount), description=desc))

    # ХӨРӨНГӨ дебит
    add_line(ob.id, '1121', '5310', cash_per_bank,         'ХХБ/ТДБ эхний үлдэгдэл')
    add_line(ob.id, '1122', '5310', cash_per_bank,         'Голомт банк эхний үлдэгдэл')
    add_line(ob.id, '1123', '5310', OPENING['cash_total'] - cash_per_bank*2, 'М банк эхний үлдэгдэл')
    add_line(ob.id, '1210', '5310', OPENING['recv_trade'],  'Дансны авлага эхний үлдэгдэл')
    add_line(ob.id, '1220', '5310', OPENING['recv_tax'],    'Татвар НДШ авлага')
    add_line(ob.id, '1230', '5310', OPENING['recv_other'],  'Бусад авлага эхний үлдэгдэл')
    add_line(ob.id, '1310', '5310', OPENING['prepaid'],     'Урьдчилж төлсөн зардал')
    add_line(ob.id, '1510', '5310', OPENING['fixed_assets'],'Үндсэн хөрөнгө цэвэр үлдэгдэл')

    # ӨР ТӨЛБӨР кредит
    add_line(ob.id, '5310', '3110', OPENING['ap_trade'],    'Дансны өглөг эхний үлдэгдэл')
    add_line(ob.id, '5310', '3120', OPENING['payroll_pay'], 'Цалингийн өглөг')
    add_line(ob.id, '5310', '3131', OPENING['tax_pay'],     'Татварын өглөг')
    # НДШ сөрөг (авлага болно)
    add_line(ob.id, '3140', '5310', abs(OPENING['ndsh_pay']), 'НДШ авлага (сөрөг үлдэгдэл)')

    # ӨМЧ кредит — retained earnings тохируулах
    total_assets = (OPENING['cash_total'] + OPENING['recv_trade'] + OPENING['recv_tax']
                    + OPENING['recv_other'] + OPENING['prepaid'] + OPENING['fixed_assets'])
    total_liab = (OPENING['ap_trade'] + OPENING['payroll_pay'] + OPENING['tax_pay']
                  + OPENING['ndsh_pay'])
    net_equity = total_assets - total_liab - OPENING['capital']

    add_line(ob.id, '5310', '5110', OPENING['capital'],     'Дүрмийн сан')

    db.session.commit()
    print(f"  Opening balance posted. Assets={total_assets:,.0f} Liabilities={total_liab:,.0f} Equity={net_equity:,.0f}")

    # ── 3. Cash гүйлгээнүүдийг дахин бүртгэх ──
    print("Re-importing 3,122 cash transactions...")
    from app import CashTransaction
    import pandas as pd

    df = pd.read_excel(
        r'C:\Users\natsa\Desktop\2026\TT_CashFlow_2026_Journal.xlsx',
        sheet_name='Хуулга', header=1, skiprows=0)
    df = df.iloc[1:].reset_index(drop=True)
    df.columns = ['num','sar','on','company','date','bank','description','partner_name','partner_acc',
                  'exchange','income','expense','income_cat','expense_cat','crm_code','master_name','debit_acc','credit_acc']

    created = skipped = 0
    for i, row in df.iterrows():
        dt = str(row['debit_acc']).strip() if str(row['debit_acc']) not in ['nan',''] else ''
        kt = str(row['credit_acc']).strip() if str(row['credit_acc']) not in ['nan',''] else ''
        inc = float(row['income']) if str(row['income']) not in ['nan',''] else 0
        exp = float(row['expense']) if str(row['expense']) not in ['nan',''] else 0
        amount = inc + exp

        if not dt or not kt or amount <= 0 or dt not in code_map or kt not in code_map:
            skipped += 1
            continue

        jnl = Journal(
            date=row['date'].date() if hasattr(row['date'],'date') else None,
            number=f"CASH-{int(row['num']) if str(row['num']) not in ['nan',''] else i+1:05d}",
            description=str(row['description'])[:200] if str(row['description']) != 'nan' else '',
            reference=str(row['bank']) if str(row['bank']) != 'nan' else '',
            status='posted'
        )
        db.session.add(jnl)
        db.session.flush()
        db.session.add(JournalLine(
            journal_id=jnl.id,
            debit_account_id=code_map[dt],
            credit_account_id=code_map[kt],
            amount=amount,
            description=str(row['partner_name']) if str(row['partner_name']) != 'nan' else ''
        ))
        created += 1
        if created % 300 == 0:
            db.session.commit()

    db.session.commit()
    print(f"  Cash journals: created={created}, skipped={skipped}")

    # ── Хяналтын тооцоо ──
    from sqlalchemy import func
    def bal(code):
        if code not in code_map: return 0
        d = db.session.query(func.sum(JournalLine.amount)).filter(
            JournalLine.debit_account_id==code_map[code],
            JournalLine.journal.has(status='posted')).scalar() or 0
        c = db.session.query(func.sum(JournalLine.amount)).filter(
            JournalLine.credit_account_id==code_map[code],
            JournalLine.journal.has(status='posted')).scalar() or 0
        return d - c

    print("\n═══ ХЯНАЛТЫН БАЛАНС (2026-05-21) ═══")
    print(f"  1121 ХХБ/ТДБ:       {bal('1121'):>20,.0f}₮")
    print(f"  1122 Голомт:         {bal('1122'):>20,.0f}₮")
    print(f"  1123 М банк:         {bal('1123'):>20,.0f}₮")
    print(f"  1210 Дансны авлага:  {bal('1210'):>20,.0f}₮")
    print(f"  1230 Бусад авлага:   {bal('1230'):>20,.0f}₮")
    print(f"  1310 Урьдчилгаа:     {bal('1310'):>20,.0f}₮")
    print(f"  1510 Үндсэн хөрөнгө: {bal('1510'):>20,.0f}₮")
    print(f"  3110 Дансны өглөг:   {bal('3110'):>20,.0f}₮")
    print(f"  3120 Цалингийн өглөг:{bal('3120'):>20,.0f}₮")
    print(f"  3131 Татварын өглөг: {bal('3131'):>20,.0f}₮")
    print(f"  5110 Дүрмийн сан:    {bal('5110'):>20,.0f}₮")
    print(f"  5310 Хуримт. ашиг:   {bal('5310'):>20,.0f}₮")
    print(f"  6110 Тээвэрлэлт орлого: {bal('6110'):>20,.0f}₮")
    print(f"  7110 Шатахуун:       {bal('7110'):>20,.0f}₮")
    print(f"  7340 Банкны шимтгэл: {bal('7340'):>20,.0f}₮")
    total_j = Journal.query.count()
    total_l = JournalLine.query.count()
    print(f"\n  Нийт журнал: {total_j}, мөр: {total_l}")
    print("\nDONE!")
