"""
Давхардсан харилцагчдыг нэгтгэх скрипт
- Нормчилсон нэрээр бүлэглэнэ
- Кодтой эсвэл хамгийн их лавлагаатайг үлдээнэ
- Бусдын VatRecord/CashTransaction лавлагааг шилжүүлнэ
- Хуучин alias-уудыг шинэ partner-т нэмнэ
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import app, db, Partner, VatRecord, CashTransaction
from name_match import norm
from collections import defaultdict

def run():
    with app.app_context():
        partners = Partner.query.filter_by(is_active=True).all()
        print(f'Нийт идэвхтэй харилцагч: {len(partners)}')

        # Нормчилсон нэрээр бүлэглэнэ
        groups = defaultdict(list)
        for p in partners:
            groups[norm(p.name)].append(p)

        dups = {k: v for k, v in groups.items() if len(v) > 1}
        print(f'Давхардсан бүлэг: {len(dups)}')
        print()

        merged = 0
        for key, plist in dups.items():
            # Хамгийн сайн харилцагчийг сонгоно
            # 1. Кодтой → давуу эрхтэй
            # 2. VAT + CASH лавлагаа олон → давуу
            def score(p):
                vat  = VatRecord.query.filter_by(partner_id=p.id).count()
                cash = CashTransaction.query.filter_by(partner_id=p.id).count()
                code_bonus = 1000 if p.code else 0
                return code_bonus + vat + cash

            plist.sort(key=score, reverse=True)
            primary   = plist[0]
            secondary = plist[1:]

            print(f'[{key}]  → ҮЛДЭХ: id={primary.id} "{primary.name}" код={primary.code or "--"}')

            # Primary-н alias жагсаалт
            try:
                aliases = json.loads(primary.aliases) if primary.aliases else []
            except Exception:
                aliases = []
            if not isinstance(aliases, list):
                aliases = []

            for dup in secondary:
                vat_cnt  = VatRecord.query.filter_by(partner_id=dup.id).count()
                cash_cnt = CashTransaction.query.filter_by(partner_id=dup.id).count()
                print(f'           устгах: id={dup.id} "{dup.name}" VAT={vat_cnt} CASH={cash_cnt}')

                # Лавлагааг шилжүүлнэ
                if vat_cnt:
                    VatRecord.query.filter_by(partner_id=dup.id).update(
                        {'partner_id': primary.id}, synchronize_session=False
                    )
                if cash_cnt:
                    CashTransaction.query.filter_by(partner_id=dup.id).update(
                        {'partner_id': primary.id}, synchronize_session=False
                    )

                # Нэрийг alias болгоно
                dup_name = dup.name.strip()
                if dup_name and dup_name not in aliases and dup_name != primary.name:
                    aliases.append(dup_name)

                # Кодгүй primary байвал dup-ийн кодыг хуулна
                if not primary.code and dup.code:
                    primary.code = dup.code

                # Register байвал хуулна
                if not primary.register and dup.register:
                    primary.register = dup.register

                # Устгах (deactivate)
                dup.is_active = False

            # Alias хадгална
            primary.aliases = json.dumps(aliases, ensure_ascii=False) if aliases else primary.aliases
            merged += len(secondary)

        db.session.commit()
        print()
        print(f'✅ {merged} харилцагч нэгтгэгдлээ')
        print(f'Идэвхтэй үлдсэн: {Partner.query.filter_by(is_active=True).count()}')

if __name__ == '__main__':
    run()
