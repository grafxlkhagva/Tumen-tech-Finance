"""
type='out' баримтуудыг банкны зарлагатай тулгаж
буруу ангилагдсан (авалт боловч борлуулалтаар орсон) баримтыг олох
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# cash_transactions: expense column = зарлагын дүн
# income column = орлогын дүн
print("=== type='out' баримт боловч банкны зарлагатай тааруулалт ===")
c.execute("""
    SELECT v.id, v.date, v.total_amount, v.partner_name, v.ddtd,
           ct.id as ct_id, ct.date as ct_date, ct.expense as ct_amount,
           ct.description, ct.partner_name as ct_partner
    FROM vat_records v
    JOIN cash_transactions ct
      ON ABS(v.total_amount - ct.expense) < 1
     AND ct.expense > 0
     AND ABS(julianday(v.date) - julianday(ct.date)) <= 7
    WHERE v.type = 'out'
    ORDER BY v.date
""")
matches = c.fetchall()
print(f"Банкны зарлагатай тааруулагдсан type='out' баримт: {len(matches)}")
if matches:
    print(f"\n{'VatID':>6} {'VAT огноо':12} {'Дүн':>14} {'Харилцагч (VAT)':30} {'CT огноо':12} {'Тайлбар':35}")
    print('-'*120)
    for r in matches:
        print(f"  {r[0]:>4} {str(r[1]):12} {r[2]:>14,.0f} {str(r[3] or '')[:28]:30} {str(r[6]):12} {str(r[8] or '')[:33]}")

# Мөн type='out' боловч орлогын талаас тааруулагдаагүйг шалгах
print("\n=== type='out' боловч банкны орлогод тохирох гүйлгээ байгаагүй ===")
c.execute("""
    SELECT v.id, v.date, v.total_amount, v.partner_name
    FROM vat_records v
    WHERE v.type = 'out'
      AND NOT EXISTS (
        SELECT 1 FROM cash_transactions ct
        WHERE ABS(v.total_amount - ct.income) < 1
          AND ct.income > 0
          AND ABS(julianday(v.date) - julianday(ct.date)) <= 30
      )
    ORDER BY v.date
    LIMIT 30
""")
unmatched = c.fetchall()
print(f"Орлогод тохирох гүйлгээгүй type='out' баримт (дээд 30): {len(unmatched)}")

# id=1205 дэлгэрэнгүй
print("\n=== id=1205 (Монголын маркетингийн холбоо) ===")
c.execute("""
    SELECT id, date, type, total_amount, partner_name, ddtd, source, invoice_no
    FROM vat_records WHERE id=1205
""")
r = c.fetchone()
if r:
    print(f"  id={r[0]}, date={r[1]}, type={r[2]}, amount={r[3]:,.0f}, partner={r[4]}")
    print(f"  ddtd={r[5]}, source={r[6]}, invoice={r[7]}")

# Банкны зарлагаас Монголын маркетингийн холбоо хайх
print("\n=== Банкны зарлагад 'маркетинг' эсвэл 2,000,000 дүн ===")
c.execute("""
    SELECT id, date, expense, description, partner_name
    FROM cash_transactions
    WHERE (lower(description) LIKE '%маркетинг%' OR lower(partner_name) LIKE '%маркетинг%'
           OR expense = 2000000)
      AND expense > 0
    ORDER BY date
""")
for r in c.fetchall():
    print(f"  ct_id={r[0]}, date={r[1]}, expense={r[2]:,.0f}, desc={r[3]}, partner={r[4]}")

conn.close()
print("\nДуусав.")
