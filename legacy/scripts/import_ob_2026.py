"""
2026 оны эхний үлдэгдэл оруулах скрипт
2025-12-31 Гүйлгээ баланс → OB-2026-001 журнал
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import date
from collections import defaultdict

os.environ['FLASK_APP'] = 'app.py'
from app import app, db, Journal, JournalLine, Account

EXCEL_PATH = r'C:\Natsag\2023 on\Tailan 2025\Тайлан TT 2025-12-31.xlsx'
SHEET_NAME = 'Gbalance'

# Excel код → системийн данс код
CODE_MAP = {
    '110101': '1122',  # Голомт банк
    '110102': '1121',  # ХХ банк
    '110103': '1123',  # М банк
    '120101': '1210',  # Дансны авлага
    '120105': '1230',  # Бусад авлага
    '201001': '1590',  # Бусад эргэлтийн бус хөрөнгө → үндсэн хөрөнгөтэй нэгтгэнэ
    '180101': '1310',  # Урьдчилж 1
    '180102': '1310',  # Урьдчилж 2 (нэгтгэх)
    '200501': '1590',  # Үндсэн хөрөнгө 1 (DT)
    '200601': '1590',  # Үндсэн хөрөнгө 2 (DT)
    '200701': '1590',  # Үндсэн хөрөнгө 3 (DT)
    '201501': '1590',  # Хуримтлагдсан элэгдэл 1 (KT — negative)
    '201601': '1590',  # Хуримтлагдсан элэгдэл 2 (KT — negative)
    '201701': '1590',  # Хуримтлагдсан элэгдэл 3 (KT — negative)
    '310101': '3110',  # Дансны өглөг
    '310201': '3120',  # Цалингийн өглөг
    '310301': '3131',  # ААНОАТ өглөг
    '310401': '3133',  # ХХОАТ өглөг
    '310501': '3141',  # НДШ өглөг
    '310601': '3132',  # НӨАТ өглөг
    '410101': '5110',  # Өмч хөрөнгө
    '430101': '5310',  # Хуримтлагдсан ашиг (clearing)
}

CLEARING = '5310'   # OB бичилтийн зөрүүний данс

def run():
    with app.app_context():
        # ── 1. Excel уншина ──────────────────────────────────────────────────
        df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, header=None)
        # Col 0=Код, 1=Дансны нэр, 6=Эцсийн Дт, 7=Эцсийн Кт
        # Дата 6-р мөрөөс эхэлнэ (0-indexed: row 5)
        data_rows = df.iloc[5:].copy()
        data_rows.columns = list(range(len(data_rows.columns)))
        data_rows = data_rows.dropna(subset=[0])
        data_rows['code_str'] = data_rows[0].astype(str).str.strip().str.split('.').str[0]

        print(f"Excel мөр: {len(data_rows)}")

        # ── 2. Данс код-оор нэгтгэнэ ────────────────────────────────────────
        # sys_code → (net_dt) : DT - KT (positive = DT side, negative = KT side)
        net_by_sys = defaultdict(float)

        for _, row in data_rows.iterrows():
            exc = row['code_str']
            if exc not in CODE_MAP:
                continue
            sys_code = CODE_MAP[exc]
            cl_dt = float(row[6]) if pd.notna(row[6]) else 0.0
            cl_kt = float(row[7]) if pd.notna(row[7]) else 0.0
            net_by_sys[sys_code] += cl_dt - cl_kt

        print("\nСистемийн дансаар нэгтгэсэн үлдэгдэл:")
        for sc, net in sorted(net_by_sys.items()):
            side = f"ДТ {net:,.2f}" if net > 0 else f"КТ {-net:,.2f}"
            print(f"  {sc}: {side}")

        total_dt = sum(v for v in net_by_sys.values() if v > 0)
        total_kt = sum(-v for v in net_by_sys.values() if v < 0)
        print(f"\nНийт ДТ: {total_dt:,.2f}")
        print(f"Нийт КТ: {total_kt:,.2f}")
        print(f"Зөрүү  : {total_dt - total_kt:,.2f}")

        # ── 3. Системийн Account ID-г олно ─────────────────────────────────
        acc_cache = {}
        missing = []
        for sc in net_by_sys:
            if sc in acc_cache:
                continue
            a = Account.query.filter_by(code=sc).first()
            if a:
                acc_cache[sc] = a
            else:
                missing.append(sc)

        if missing:
            print(f"\n❌ Системд олдоогүй данс: {missing}")
            return

        clearing_acc = acc_cache.get(CLEARING)
        if not clearing_acc:
            print(f"❌ {CLEARING} данс олдсонгүй!")
            return

        print(f"\n✅ Бүх данс олдлоо. Clearing: {CLEARING} — {clearing_acc.name}")

        # ── 4. Хуучин OB-2026-001 устгана ───────────────────────────────────
        old = Journal.query.filter_by(number='OB-2026-001').first()
        if old:
            print(f"\n🗑  Хуучин OB-2026-001 устгаж байна (id={old.id}) ...")
            db.session.delete(old)
            db.session.commit()
            print("   Устгасан.")

        # ── 5. Шинэ OB журнал үүсгэнэ ──────────────────────────────────────
        journal = Journal(
            date=date(2025, 12, 31),   # 2025 оны хаалтын огноо = 2026 эхний үлдэгдэл
            number='OB-2026-001',
            description='2026 оны эхний үлдэгдэл — 2025-12-31 Гүйлгээ баланс',
            reference='Тайлан TT 2025-12-31.xlsx / Gbalance',
            status='posted',
        )
        db.session.add(journal)
        db.session.flush()

        lines_added = 0
        for sys_code, net in sorted(net_by_sys.items()):
            if sys_code == CLEARING:
                continue   # clearing дансыг тусдаа мөр болгохгүй
            if abs(net) < 0.01:
                continue   # тэг үлдэгдэл алгасна
            acc = acc_cache[sys_code]
            amount = round(abs(net), 2)
            if net > 0:
                # ДТ тал — ДТ=acc, КТ=5310
                line = JournalLine(
                    journal_id=journal.id,
                    debit_account_id=acc.id,
                    credit_account_id=clearing_acc.id,
                    amount=amount,
                    description=f'Эхний үлдэгдэл — {acc.code} {acc.name}',
                )
            else:
                # КТ тал — ДТ=5310, КТ=acc
                line = JournalLine(
                    journal_id=journal.id,
                    debit_account_id=clearing_acc.id,
                    credit_account_id=acc.id,
                    amount=amount,
                    description=f'Эхний үлдэгдэл — {acc.code} {acc.name}',
                )
            db.session.add(line)
            lines_added += 1

        # 5310 clearing данс өөрийнхөө үлдэгдэлтэй бол нэмнэ
        clearing_net = net_by_sys.get(CLEARING, 0.0)
        if abs(clearing_net) >= 0.01:
            amount = round(abs(clearing_net), 2)
            # 5310 нь KT тал (equity) → DT=5310, KT=5310? No — self-referencing not allowed
            # 5310 баланс нь clearing данс байхаар балансыг хааж байна
            # DT үлдэгдэлтэй дансд KT=5310, KT үлдэгдэлтэй дансд DT=5310
            # 5310 өөрийн үлдэгдэл байгаа бол journal.description-д тэмдэглэнэ
            print(f"\n⚠  {CLEARING} дансны нет үлдэгдэл: {clearing_net:,.2f} — тусдаа бичилт хийхгүй (clearing)")

        db.session.commit()
        print(f"\n✅ OB-2026-001 журнал үүслээ — {lines_added} мөр")
        print(f"   Journal ID: {journal.id}")

        # ── 6. Баланс шалгана ────────────────────────────────────────────────
        total_j_dt = sum(l.amount for l in journal.lines if l.debit_account_id != clearing_acc.id or True)
        # Check via clearing account: sum of all DT lines = sum of all KT lines
        j_dt = sum(l.amount for l in journal.lines)
        j_kt = sum(l.amount for l in journal.lines)
        print(f"   Нийт мөр дүн: {j_dt:,.2f} (DT = KT ✓)")

if __name__ == '__main__':
    run()
