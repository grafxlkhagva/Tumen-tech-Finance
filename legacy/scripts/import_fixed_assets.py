"""
2025-12-31 тайлангийн Excel-ээс үндсэн хөрөнгийн бүртгэл оруулах скрипт

Excel-ийн Gbalance хуудаснаас 200xxx (анхны өртөг) ба 201xxx (элэгдэл)
дансдыг уншиж FixedAsset хүснэгтэд оруулна.
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import date

os.environ['FLASK_APP'] = 'app.py'
from app import app, db, FixedAsset

EXCEL_PATH = r'C:\Natsag\2023 on\Tailan 2025\Тайлан TT 2025-12-31.xlsx'
SHEET_NAME = 'Gbalance'

# Excel код → {AngillаL, элэгдлийн данс, FA код}
# Хос: 200501↔201501, 200601↔201601, 200701↔201701
FA_ASSET_CODES = {
    '200501': {'depr_code': '201501', 'cat': 'Тавилга, эд хогшил', 'fa_code': 'FA-001'},
    '200601': {'depr_code': '201601', 'cat': 'Компьютер, техник',  'fa_code': 'FA-002'},
    '200701': {'depr_code': '201701', 'cat': 'Бусад',               'fa_code': 'FA-003'},
    '201001': {'depr_code': None,      'cat': 'Бусад',              'fa_code': 'FA-004'},
}

def run():
    with app.app_context():
        # ── 1. Excel уншина ──────────────────────────────────────────────────
        df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, header=None)
        # Col 0=Код, 1=Нэр, 6=Эцсийн ДТ, 7=Эцсийн КТ  (мөр 5-аас)
        data = df.iloc[5:].copy()
        data.columns = list(range(len(data.columns)))
        data = data.dropna(subset=[0])
        data['code_str'] = data[0].astype(str).str.strip().str.split('.').str[0]

        # Lookup бүтээнэ: excel_code → (name, closing_dt, closing_kt)
        lookup = {}
        for _, row in data.iterrows():
            code = row['code_str']
            name = str(row[1]).strip() if pd.notna(row[1]) else ''
            dt   = float(row[6]) if pd.notna(row[6]) else 0.0
            kt   = float(row[7]) if pd.notna(row[7]) else 0.0
            lookup[code] = (name, dt, kt)

        print("\nExcel-д олдсон FA-тай холбоотой дансд:")
        for c in list(FA_ASSET_CODES.keys()) + [v['depr_code'] for v in FA_ASSET_CODES.values() if v['depr_code']]:
            if c and c in lookup:
                n, d, k = lookup[c]
                print(f"  {c}: {n:<45} ДТ={d:>15,.0f}  КТ={k:>15,.0f}")

        # ── 2. FixedAsset бичлэг үүсгэх / шинэчлэх ────────────────────────
        print()
        created = updated = 0

        for exc_code, info in FA_ASSET_CODES.items():
            if exc_code not in lookup:
                print(f"⚠  {exc_code} Excel-д байхгүй — алгасав")
                continue

            fa_name, fa_dt, _ = lookup[exc_code]
            if not fa_name or fa_name in ('nan', ''):
                fa_name = f'Үндсэн хөрөнгө ({exc_code})'

            # Хуримтлагдсан элэгдэл
            # Excel-д элэгдэл нь ДТ талд сөрөг тоогоор, эсвэл КТ талд эерэг тоогоор байна
            acc_depr = 0.0
            if info['depr_code'] and info['depr_code'] in lookup:
                _, depr_dt, depr_kt = lookup[info['depr_code']]
                if depr_kt > 0:
                    acc_depr = depr_kt          # КТ тал эерэг
                elif depr_dt < 0:
                    acc_depr = abs(depr_dt)     # ДТ тал сөрөг → abs авна

            book_val = fa_dt - acc_depr
            fa_code  = info['fa_code']

            existing = FixedAsset.query.filter_by(code=fa_code).first()
            if existing:
                existing.name                    = fa_name
                existing.category                = info['cat']
                existing.purchase_amount         = fa_dt
                existing.accumulated_depreciation= acc_depr
                updated += 1
                print(f"♻  {fa_code} шинэчлэгдлээ: {fa_name}")
            else:
                fa = FixedAsset(
                    code=fa_code,
                    name=fa_name,
                    category=info['cat'],
                    purchase_amount=fa_dt,
                    accumulated_depreciation=acc_depr,
                    useful_life=5,
                    salvage_value=0,
                    status='active',
                    notes=f'2025-12-31 тайлангаас оруулсан (Excel код: {exc_code})',
                )
                db.session.add(fa)
                created += 1
                print(f"✅ {fa_code} нэмэгдлээ: {fa_name}")

            print(f"     Анхны өртөг: {fa_dt:>18,.0f}₮")
            print(f"     Хуримтлагдсан элэгдэл: {acc_depr:>10,.0f}₮")
            print(f"     Дансны үнэ:  {book_val:>18,.0f}₮")
            print()

        db.session.commit()

        # ── 3. Нийт шалгалт ─────────────────────────────────────────────────
        all_fa = FixedAsset.query.all()
        total_cost  = sum(a.purchase_amount for a in all_fa)
        total_depr  = sum(a.accumulated_depreciation for a in all_fa)
        total_book  = sum(a.book_value for a in all_fa)

        print(f"{'─'*55}")
        print(f"Шинэ: {created}   Шинэчлэгдсэн: {updated}")
        print(f"Нийт үндсэн хөрөнгийн тоо : {len(all_fa)}")
        print(f"Нийт анхны өртөг           : {total_cost:>18,.0f}₮")
        print(f"Нийт хуримтлагдсан элэгдэл: {total_depr:>18,.0f}₮")
        print(f"Нийт дансны үнэ (цэвэр)   : {total_book:>18,.0f}₮")
        print(f"{'─'*55}")
        print(f"\n✅ Дууслаа! /fixed-assets хуудасд шалгана уу.")

if __name__ == '__main__':
    run()
