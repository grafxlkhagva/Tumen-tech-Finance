import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import pandas as pd
from app import app, db, CashTransaction, Partner

EXCEL = r'C:\Users\natsa\Desktop\2026\TT_CashFlow_2026_Journal.xlsx'

with app.app_context():
    db.create_all()

    # Clear existing cash transactions
    CashTransaction.query.delete()
    db.session.commit()

    df = pd.read_excel(EXCEL, sheet_name='Хуулга', header=1, skiprows=0)
    df = df.iloc[1:].reset_index(drop=True)
    df.columns = ['num','sar','on','company','date','bank','description','partner_name','partner_acc',
                  'exchange','income','expense','income_cat','expense_cat','crm_code','master_name','debit_acc','credit_acc']

    # Build partner map from unique names
    partner_names = df['partner_name'].dropna().unique()
    partner_map = {}
    for name in partner_names:
        name = str(name).strip()
        if not name:
            continue
        p = Partner.query.filter(Partner.name == name).first()
        if not p:
            p = Partner(name=name, type='both')
            db.session.add(p)
            db.session.flush()
        partner_map[name] = p.id
    db.session.commit()
    print(f"Partners: {len(partner_map)}")

    # Import transactions
    batch = []
    for i, row in df.iterrows():
        try:
            partner_name = str(row['partner_name']).strip() if pd.notna(row['partner_name']) else ''
            income_val = float(row['income']) if pd.notna(row['income']) and row['income'] else 0
            expense_val = float(row['expense']) if pd.notna(row['expense']) and row['expense'] else 0

            txn = CashTransaction(
                row_num=int(row['num']) if pd.notna(row['num']) else i+1,
                month=int(row['sar']) if pd.notna(row['sar']) else None,
                year=int(row['on']) if pd.notna(row['on']) else 2026,
                company=str(row['company']) if pd.notna(row['company']) else '',
                date=row['date'] if pd.notna(row['date']) else None,
                bank=str(row['bank']) if pd.notna(row['bank']) else '',
                description=str(row['description']) if pd.notna(row['description']) else '',
                partner_name=partner_name,
                partner_acc=str(row['partner_acc']) if pd.notna(row['partner_acc']) else '',
                exchange_rate=float(row['exchange']) if pd.notna(row['exchange']) else 1,
                income=income_val,
                expense=expense_val,
                income_cat=str(row['income_cat']) if pd.notna(row['income_cat']) else '',
                expense_cat=str(row['expense_cat']) if pd.notna(row['expense_cat']) else '',
                crm_code=str(row['crm_code']) if pd.notna(row['crm_code']) else '',
                master_name=str(row['master_name']) if pd.notna(row['master_name']) else '',
                debit_acc=str(row['debit_acc']) if pd.notna(row['debit_acc']) else '',
                credit_acc=str(row['credit_acc']) if pd.notna(row['credit_acc']) else '',
                partner_id=partner_map.get(partner_name)
            )
            batch.append(txn)
            if len(batch) >= 200:
                db.session.bulk_save_objects(batch)
                db.session.commit()
                batch = []
        except Exception as e:
            print(f"Row {i} error: {e}")

    if batch:
        db.session.bulk_save_objects(batch)
        db.session.commit()

    total = CashTransaction.query.count()
    total_income = db.session.query(db.func.sum(CashTransaction.income)).scalar() or 0
    total_expense = db.session.query(db.func.sum(CashTransaction.expense)).scalar() or 0
    print(f"Imported: {total} transactions")
    print(f"Total income:  {total_income:,.0f}")
    print(f"Total expense: {total_expense:,.0f}")
    print("DONE!")
