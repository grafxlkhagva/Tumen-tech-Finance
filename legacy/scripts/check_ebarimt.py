import sqlite3
import sys
sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('instance/accounting.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

print("\n=== Barimt related entries ===")
for t in tables:
    cur.execute(f"PRAGMA table_info({t})")
    cols = [c[1] for c in cur.fetchall()]
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    cnt = cur.fetchone()[0]
    print(f"  {t}: {cnt} rows | cols: {cols}")

# Try to find ebarimt source entries
for t in tables:
    cur.execute(f"PRAGMA table_info({t})")
    cols = [c[1] for c in cur.fetchall()]
    col_names = [c.lower() for c in cols]
    if any(x in ' '.join(col_names) for x in ['barimt', 'source', 'ref', 'memo', 'description']):
        for col in cols:
            if any(x in col.lower() for x in ['source', 'ref', 'memo', 'desc', 'note']):
                try:
                    cur.execute(f"SELECT * FROM {t} WHERE LOWER({col}) LIKE '%barimt%' LIMIT 20")
                    rows = cur.fetchall()
                    if rows:
                        print(f"\n--- {t}.{col} => barimt matches ---")
                        for r in rows:
                            print(dict(r))
                except:
                    pass
