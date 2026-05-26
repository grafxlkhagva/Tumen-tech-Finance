"""
e-Barimт авалт/борлуулалт ангиллын алдааг шалгаж засах
"""
import io, sys, sqlite3
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
c = conn.cursor()

# Schema check
c.execute("PRAGMA table_info(vat_records)")
cols = [r[1] for r in c.fetchall()]
print("Columns:", cols)

# Find the specific record (ДДТД 82875540002601290)
c.execute("""
    SELECT id, ddtd, invoice_no, type, amount, total_amount, partner_name, date, source
    FROM vat_records
    WHERE ddtd LIKE '%82875540002601290%'
       OR invoice_no LIKE '%82875540002601290%'
""")
rows = c.fetchall()
print(f"\nБаримт хайлт (82875540002601290): {len(rows)} олдлоо")
for r in rows:
    print(f"  id={r[0]}, ddtd={r[1]}, invoice={r[2]}, type={r[3]}, amount={r[4]:,.0f}, partner={r[6]}, date={r[7]}, source={r[8]}")

# Type summary
print("\nТөрлийн нэгтгэл:")
c.execute("SELECT type, COUNT(*), SUM(total_amount) FROM vat_records GROUP BY type")
for r in c.fetchall():
    print(f"  type='{r[0]}': {r[1]} баримт, нийт {r[2]:,.0f}₮" if r[2] else f"  type='{r[0]}': {r[1]} баримт")

# Show all type='out' records to identify misclassified ones
print("\ntype='out' бүх баримтууд:")
c.execute("""
    SELECT id, ddtd, invoice_no, type, amount, total_amount, partner_name, date, source
    FROM vat_records
    WHERE type='out'
    ORDER BY date
""")
out_rows = c.fetchall()
print(f"  Нийт: {len(out_rows)} баримт")
print(f"{'ID':>6} {'ДДТД/Invoice':>25} {'type':>5} {'Дүн':>14} {'Харилцагч':30} {'Огноо':12} {'Source':10}")
print('-'*110)
for r in out_rows:
    ddtd_or_inv = (r[1] or r[2] or '')[-20:]
    partner = (r[6] or '')[:28]
    print(f"  {r[0]:>4} {ddtd_or_inv:>23} {r[3]:>5} {(r[5] or r[4] or 0):>14,.0f} {partner:30} {str(r[7]):12} {str(r[8] or ''):10}")

# Show type='in' for comparison
print("\ntype='in' баримтуудын тоо:")
c.execute("SELECT COUNT(*) FROM vat_records WHERE type='in'")
print(f"  {c.fetchone()[0]} баримт")

conn.close()
print("\nДуусав. Засахын тулд fix_vat_apply.py ажиллуулна уу.")
