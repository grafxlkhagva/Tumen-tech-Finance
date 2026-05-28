#!/usr/bin/env python3
"""
Verify TypeScript calc_salary mirrors PL/pgSQL calc_salary_row.

Runs 1000 random inputs through both:
  1. Postgres `calc_salary_row(...)` (DB-side)
  2. JS `calcSalary(...)` via embedded node call

Asserts identical rounded outputs on: bod, niit, emndsh, emndsh_org, ded23, hhoat, adv, gart.
"""
from __future__ import annotations
import json
import os
import random
import subprocess
import sys
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

DB_URL = os.environ["SUPABASE_DB_URL"]

JS_RUNNER = """
const { calcSalary } = require('./apps/web/src/lib/payroll/calc.ts');
const cases = JSON.parse(process.argv[2]);
const results = cases.map(c => calcSalary(c));
console.log(JSON.stringify(results));
"""

def main(n: int = 1000) -> int:
    print(f"Generating {n} random test cases...")
    cases = []
    for _ in range(n):
        cases.append({
            "base_salary":     random.choice([500_000, 800_000, 1_500_000, 2_700_000, 3_500_000, 5_400_000, 7_800_000, 8_500_000]),
            "worked_hours":    random.choice([80, 120, 168, 176, 184, 200]),
            "month":           random.randint(1, 12),
            "phone_allowance": random.choice([0, 40_000, 100_000, 200_000]),
            "sales_bonus":     random.choice([0, 0, 0, 100_000, 500_000]),
            "leave_pay":       random.choice([0, 0, 0, 50_000]),
            "advance_override": random.choice([None, None, None, 1_000_000]),
        })

    print("Running PL/pgSQL calc_salary_row for each case...")
    conn = psycopg2.connect(DB_URL)
    pg_results = []
    with conn.cursor() as c:
        for case in cases:
            c.execute("""
                SELECT bod, total_hours, niit, emndsh, emndsh_org, ded23, hhoat, adv, gart
                FROM calc_salary_row(%s, %s, %s, %s, %s, %s, 0, %s)
            """, (
                case["base_salary"], case["worked_hours"], case["month"],
                case["phone_allowance"], case["sales_bonus"], case["leave_pay"],
                case["advance_override"],
            ))
            row = c.fetchone()
            pg_results.append({
                "bod": float(row[0]), "total_hours": int(row[1]), "niit": float(row[2]),
                "emndsh": float(row[3]), "emndsh_org": float(row[4]), "ded23": float(row[5]),
                "hhoat": float(row[6]), "adv": float(row[7]), "gart": float(row[8]),
            })
    conn.close()

    print("Running TS calcSalary for each case via tsx...")
    # Use tsx to run TypeScript directly
    runner_path = ROOT / "scripts" / "_payroll_runner.ts"
    runner_path.write_text("""
import { calcSalary } from "../apps/web/src/lib/payroll/calc";
const cases = JSON.parse(process.argv[2]);
const results = cases.map((c: any) => calcSalary(c));
console.log(JSON.stringify(results));
""")
    try:
        proc = subprocess.run(
            ["npx", "tsx", str(runner_path), json.dumps(cases)],
            capture_output=True, text=True, cwd=str(ROOT / "apps" / "web"), timeout=60,
        )
        if proc.returncode != 0:
            print("❌ tsx failed:", proc.stderr)
            return 1
        ts_results = json.loads(proc.stdout.strip().split("\n")[-1])
    finally:
        runner_path.unlink(missing_ok=True)

    print(f"Comparing {len(cases)} pairs...")
    mismatches = 0
    for i, (case, pg, ts) in enumerate(zip(cases, pg_results, ts_results)):
        for k in ("bod", "niit", "emndsh", "emndsh_org", "ded23", "hhoat", "adv", "gart"):
            if abs(pg[k] - ts[k]) > 0.5:  # allow 1 MNT rounding diff
                if mismatches < 5:
                    print(f"❌ Case {i}: {k} PG={pg[k]} TS={ts[k]} input={case}")
                mismatches += 1
                break

    if mismatches == 0:
        print(f"✅ All {n} cases match.")
        return 0
    else:
        print(f"⚠️  {mismatches}/{n} mismatches.")
        return 1


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    sys.exit(main(n))
