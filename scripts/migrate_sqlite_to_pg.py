#!/usr/bin/env python3
"""
Tumen Accounting — SQLite → Supabase Postgres data migration.

Reads from legacy/instance/accounting.db, transforms into the new schema,
and inserts into the Supabase Postgres DB.

Key transformations:
  - Integer IDs → UUIDs (mapping kept in memory for FK resolution)
  - Single company assumption (all rows tagged with DEFAULT_COMPANY_ID)
  - journal_lines: (debit_account_id, credit_account_id, amount) →
                   2 rows: (account_id=Dr, debit, 0) + (account_id=Cr, 0, credit)
  - FLOAT → NUMERIC(18,2) with rounding
  - period_id resolved from journal.date
  - status strings normalized to lowercase
  - partner.aliases TEXT (JSON string) → JSONB array
  - timestamps coerced

Usage:
    # 1. Populate SUPABASE_DB_URL in .env.local first
    python3 scripts/migrate_sqlite_to_pg.py [--dry-run] [--table TABLE] [--reset]

    # Example:
    python3 scripts/migrate_sqlite_to_pg.py --dry-run     # validate only
    python3 scripts/migrate_sqlite_to_pg.py               # run full migration
    python3 scripts/migrate_sqlite_to_pg.py --reset       # truncate first
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[1]
SQLITE_PATH = ROOT / "legacy" / "instance" / "accounting.db"
ENV_FILE    = ROOT / ".env.local"

# Default tenant created in migration 015
DEFAULT_COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

# Tables in FK-dependency order
TABLE_ORDER = [
    "accounts",
    "partners",
    "employees",
    "journals",
    "journal_lines",
    "vat_records",
    "receivables",
    "payables",
    "cash_transactions",
    "invoice_payments",
    "salary_records",
    "fixed_assets",
    "reconciliations",
]

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def to_money(v: Any) -> Decimal | None:
    if v is None or v == "":
        return None
    try:
        return Decimal(str(v)).quantize(Decimal("0.01"))
    except Exception:
        return None


def to_date(v: Any) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, datetime):
        return v.date()
    s = str(v).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%d/%m/%Y"):
        try:
            return datetime.strptime(s.split(".")[0], fmt).date()
        except ValueError:
            continue
    # Last attempt: ISO format
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None


def to_bool(v: Any) -> bool:
    if v is None or v == "":
        return False
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("1", "true", "yes", "y", "t")


def to_uuid_map(int_id: int | None, mapping: dict[int, uuid.UUID]) -> uuid.UUID | None:
    if int_id is None:
        return None
    return mapping.get(int(int_id))


def parse_aliases(v: Any) -> list[str]:
    """legacy partner.aliases is TEXT (JSON string or comma-sep). Return list."""
    if v is None or v == "":
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    s = str(v).strip()
    if not s:
        return []
    try:
        parsed = json.loads(s)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
        if isinstance(parsed, dict):
            return [str(v) for v in parsed.values()]
        return [str(parsed)]
    except Exception:
        # fallback: comma-separated
        return [t.strip() for t in s.split(",") if t.strip()]


# -----------------------------------------------------------------------------
# DB connections
# -----------------------------------------------------------------------------
def open_sqlite() -> sqlite3.Connection:
    if not SQLITE_PATH.exists():
        sys.exit(f"❌ SQLite DB not found: {SQLITE_PATH}")
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def open_postgres(dry_run: bool = False) -> psycopg2.extensions.connection:
    load_dotenv(ENV_FILE)
    url = os.environ.get("SUPABASE_DB_URL", "")
    if "CHANGE_ME" in url or not url:
        sys.exit("❌ SUPABASE_DB_URL not configured in .env.local. "
                 "Set it to: postgresql://postgres:[PASSWORD]@db.PROJECT_REF.supabase.co:5432/postgres")
    log(f"Connecting to Postgres: {url.split('@')[1]}")
    conn = psycopg2.connect(url, connect_timeout=15)
    conn.autocommit = False
    return conn


# -----------------------------------------------------------------------------
# Table migrators
# -----------------------------------------------------------------------------
class Migrator:
    def __init__(self, sl: sqlite3.Connection, pg: psycopg2.extensions.connection, dry_run: bool):
        self.sl = sl
        self.pg = pg
        self.dry_run = dry_run
        self.maps: dict[str, dict[int, uuid.UUID]] = {t: {} for t in TABLE_ORDER}
        self.period_cache: dict[tuple[int, int], uuid.UUID] = {}
        self._load_period_cache()

    # -------------------------------------------------------------------------
    def _load_period_cache(self) -> None:
        with self.pg.cursor() as c:
            c.execute("SELECT year, month, id FROM periods WHERE company_id = %s",
                      (str(DEFAULT_COMPANY_ID),))
            for y, m, pid in c.fetchall():
                self.period_cache[(y, m)] = pid
        log(f"Loaded {len(self.period_cache)} periods into cache")

    def _period_for(self, d: date) -> uuid.UUID | None:
        if not d:
            return None
        return self.period_cache.get((d.year, d.month))

    def _execute(self, sql: str, rows: list[tuple]) -> int:
        if not rows:
            return 0
        # Even in dry-run we INSERT — the transaction is rolled back at the end,
        # so the DB is unchanged but dependent queries (e.g. picking default
        # account_id) work within the transaction.
        with self.pg.cursor() as c:
            psycopg2.extras.execute_batch(c, sql, rows, page_size=500)
        return len(rows)

    # -------------------------------------------------------------------------
    def migrate_accounts(self) -> None:
        log("→ accounts")
        sl_rows = self.sl.execute("SELECT * FROM accounts").fetchall()
        rows = []
        mapping = self.maps["accounts"]

        # Pass 1: assign UUIDs
        for r in sl_rows:
            mapping[r["id"]] = uuid.uuid4()

        # Pass 2: build rows with resolved parent_id
        for r in sl_rows:
            t = r["type"]
            # Normalize account_type to lowercase enum
            type_enum = {
                "Хөрөнгө": "asset", "asset": "asset", "Asset": "asset",
                "Өр төлбөр": "liability", "liability": "liability",
                "Эзний өмч": "equity", "equity": "equity",
                "Орлого": "income", "income": "income",
                "Зардал": "expense", "expense": "expense",
            }.get(t, t.lower() if t else "asset")

            rows.append((
                str(mapping[r["id"]]),
                str(DEFAULT_COMPANY_ID),
                r["code"],
                r["name"],
                type_enum,
                str(mapping[r["parent_id"]]) if r["parent_id"] else None,
                to_bool(r["is_active"]) if "is_active" in r.keys() else True,
            ))

        n = self._execute(
            "INSERT INTO accounts (id, company_id, code, name, type, parent_id, is_active) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (company_id, code) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} accounts")

    # -------------------------------------------------------------------------
    def migrate_partners(self) -> None:
        log("→ partners")
        sl_rows = self.sl.execute("SELECT * FROM partners").fetchall()
        rows = []
        code_seen: dict[str, uuid.UUID] = {}   # code -> assigned UUID
        skipped_dup = 0

        for r in sl_rows:
            code = (r["code"] or "").strip() if "code" in r.keys() else ""
            if code and code in code_seen:
                # Duplicate code → map legacy ID to the already-created partner
                self.maps["partners"][r["id"]] = code_seen[code]
                skipped_dup += 1
                continue

            new_id = uuid.uuid4()
            self.maps["partners"][r["id"]] = new_id
            if code:
                code_seen[code] = new_id

            ptype = (r["type"] or "customer").lower()
            if ptype not in ("customer","supplier","both","employee","other"):
                ptype = "other"
            rows.append((
                str(new_id),
                str(DEFAULT_COMPANY_ID),
                code or None,
                r["name"],
                r["register"] if "register" in r.keys() else None,
                None,                                           # tin
                ptype,
                r["phone"] if "phone" in r.keys() else None,
                r["email"] if "email" in r.keys() else None,
                r["address"] if "address" in r.keys() else None,
                json.dumps(parse_aliases(r["aliases"] if "aliases" in r.keys() else None)),
                to_bool(r["is_active"]) if "is_active" in r.keys() else True,
            ))

        if skipped_dup:
            log(f"  deduped {skipped_dup} duplicate-code partners")
        n = self._execute(
            "INSERT INTO partners (id, company_id, code, name, register, tin, type, "
            "phone, email, address, aliases, is_active) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} partners")

    # -------------------------------------------------------------------------
    def migrate_employees(self) -> None:
        log("→ employees")
        sl_rows = self.sl.execute("SELECT * FROM employees").fetchall()
        rows = []
        for r in sl_rows:
            new_id = uuid.uuid4()
            self.maps["employees"][r["id"]] = new_id
            rows.append((
                str(new_id),
                str(DEFAULT_COMPANY_ID),
                to_uuid_map(r["partner_id"], self.maps["partners"]) and
                  str(to_uuid_map(r["partner_id"], self.maps["partners"])),
                (r["name"] or "")[:60] or "Unknown",
                r["lastname"] if "lastname" in r.keys() else None,
                r["tin"] if "tin" in r.keys() else None,
                None,                                           # employee_code
                r["title"] if "title" in r.keys() else None,
                None,                                           # department
                to_date(r["hire_date"]) if "hire_date" in r.keys() else None,
                to_bool(r["is_active"]) if "is_active" in r.keys() else True,
                to_money(r["base_salary"]) or Decimal("0"),
                to_money(r["adv_base"]) or Decimal("0"),
                to_money(r["phone_allowance"]) or Decimal("0"),
                int(r["exp_years"] or 0) if "exp_years" in r.keys() else 0,
                r["bank"] if "bank" in r.keys() else None,
                r["account"] if "account" in r.keys() else None,
                r["email"] if "email" in r.keys() else None,
                r["color"] if "color" in r.keys() else None,
            ))
        n = self._execute(
            "INSERT INTO employees (id, company_id, partner_id, first_name, last_name, tin, "
            "employee_code, title, department, hire_date, is_active, base_salary, advance_base, "
            "phone_allowance, experience_years, bank_name, bank_account, email, color) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (company_id, tin) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} employees")

    # -------------------------------------------------------------------------
    def migrate_journals(self) -> None:
        log("→ journals")
        sl_rows = self.sl.execute("SELECT * FROM journals").fetchall()
        rows = []
        skipped = 0
        for r in sl_rows:
            d = to_date(r["date"])
            if not d:
                skipped += 1
                continue
            pid = self._period_for(d)
            if not pid:
                skipped += 1
                continue

            new_id = uuid.uuid4()
            self.maps["journals"][r["id"]] = new_id
            status = (r["status"] or "draft").lower()
            if status not in ("draft", "posted", "reversed"):
                status = "draft"

            number = r["number"] or f"MIG-{r['id']}"
            rows.append((
                str(new_id),
                str(DEFAULT_COMPANY_ID),
                str(pid),
                number,
                d,
                r["reference"] if "reference" in r.keys() else None,
                r["description"],
                "draft",      # bring everything in as draft; we'll post in a second pass
                "import",
                str(r["id"]),
            ))

        n = self._execute(
            "INSERT INTO journals (id, company_id, period_id, number, date, reference, "
            "description, status, source, source_ref) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (company_id, number) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} journals (skipped {skipped} due to no period/date)")
        self._original_statuses = {
            r["id"]: (r["status"] or "draft").lower()
            for r in sl_rows
        }

    # -------------------------------------------------------------------------
    def migrate_journal_lines(self) -> None:
        """SPECIAL: 1 hyper-row → 2 standard double-entry rows.

        Per-journal line counter: multiple legacy rows for the same journal
        must each get unique line_no values."""
        log("→ journal_lines (transforming hyper-rows to standard double-entry)")
        # Order by journal_id then id so per-journal counter is stable
        sl_rows = self.sl.execute(
            "SELECT * FROM journal_lines ORDER BY journal_id, id"
        ).fetchall()
        rows = []
        skipped = 0
        line_counter: dict[uuid.UUID, int] = {}  # journal_uuid → next line_no

        for r in sl_rows:
            journal_uuid = self.maps["journals"].get(r["journal_id"])
            if not journal_uuid:
                skipped += 1
                continue

            debit_acc_id  = r["debit_account_id"]
            credit_acc_id = r["credit_account_id"]
            amount = to_money(r["amount"])
            if not amount or amount == 0:
                skipped += 1
                continue

            # Debit side
            if debit_acc_id:
                debit_uuid = self.maps["accounts"].get(debit_acc_id)
                if debit_uuid:
                    line_counter[journal_uuid] = line_counter.get(journal_uuid, 0) + 1
                    rows.append((
                        str(uuid.uuid4()), str(journal_uuid), line_counter[journal_uuid],
                        str(debit_uuid), None, amount, Decimal("0"),
                        r["description"],
                    ))

            # Credit side
            if credit_acc_id:
                credit_uuid = self.maps["accounts"].get(credit_acc_id)
                if credit_uuid:
                    line_counter[journal_uuid] = line_counter.get(journal_uuid, 0) + 1
                    rows.append((
                        str(uuid.uuid4()), str(journal_uuid), line_counter[journal_uuid],
                        str(credit_uuid), None, Decimal("0"), amount,
                        r["description"],
                    ))

        n = self._execute(
            "INSERT INTO journal_lines (id, journal_id, line_no, account_id, partner_id, "
            "debit, credit, description) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            rows,
        )
        log(f"  inserted {n} lines from {len(sl_rows)} hyper-rows (skipped {skipped})")

    # -------------------------------------------------------------------------
    def post_journals(self) -> None:
        """Run post_journal() on journals that were 'posted' in legacy."""
        log("→ posting journals that were posted in legacy")
        if self.dry_run:
            log("  (dry-run: skip)")
            return
        with self.pg.cursor() as c:
            # Disable RLS by using service_role (psycopg2 connects as postgres)
            c.execute(
                "SELECT id FROM journals WHERE company_id = %s "
                "AND source = 'import' AND status = 'draft'",
                (str(DEFAULT_COMPANY_ID),))
            jids = [row[0] for row in c.fetchall()]
            log(f"  attempting to post {len(jids)} draft journals")

            posted = 0
            errors: list[tuple[str, str]] = []
            for jid in jids:
                try:
                    c.execute("SAVEPOINT s1")
                    c.execute("SELECT post_journal(%s)", (jid,))
                    c.execute("RELEASE SAVEPOINT s1")
                    posted += 1
                except psycopg2.Error as e:
                    c.execute("ROLLBACK TO SAVEPOINT s1")
                    errors.append((jid, str(e).split("\n")[0][:120]))

            log(f"  posted {posted}/{len(jids)}; {len(errors)} failed")
            if errors:
                for jid, err in errors[:10]:
                    log(f"    ❌ {jid}: {err}")
                if len(errors) > 10:
                    log(f"    ... and {len(errors) - 10} more")

    # -------------------------------------------------------------------------
    def migrate_vat_records(self) -> None:
        log("→ vat_records")
        sl_rows = self.sl.execute("SELECT * FROM vat_records").fetchall()
        rows = []
        for r in sl_rows:
            d = to_date(r["date"])
            if not d:
                continue
            new_id = uuid.uuid4()
            self.maps["vat_records"][r["id"]] = new_id
            direction = "outbound" if (r["type"] or "out").lower().startswith("out") else "inbound"
            tax_type = (r["tax_type"] or "standard").lower()
            if tax_type not in ("standard","zero","reduced","exempt"):
                tax_type = "standard"
            status = "matched" if r["partner_id"] else "pending"

            # Map source values (legacy DB has Mongolian strings)
            raw_source = (r["source"] or "manual").lower().strip() if "source" in r.keys() else "manual"
            source_map = {
                "ибаримт": "ebarimt", "ebarimt": "ebarimt",
                "гар": "manual", "гараар": "manual", "manual": "manual",
                "import": "import", "оруулсан": "import",
                "нэхэмжлэх": "invoice", "invoice": "invoice",
            }
            source = source_map.get(raw_source, "manual")

            amount = to_money(r["amount"]) or Decimal("0")
            vat    = to_money(r["vat_amount"]) or Decimal("0")
            total  = to_money(r["total_amount"]) or (amount + vat)
            # Enforce total = amount + vat
            if total != amount + vat:
                total = amount + vat
            paid = to_money(r["paid_amount"]) or Decimal("0")
            if paid > total:
                paid = total

            partner_uuid = to_uuid_map(r["partner_id"], self.maps["partners"])
            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID),
                direction, tax_type, d,
                r["ddtd"], r["parent_ddtd"], r["invoice_no"],
                str(partner_uuid) if partner_uuid else None,
                r["partner_name"], r["partner_register"],
                amount, vat, total, paid,
                status,
                source,
                r["ebarimt_status"] if "ebarimt_status" in r.keys() else None,
            ))

        # Dedupe at the script level so we don't violate the unique (company_id, direction, ddtd)
        seen: set[tuple] = set()
        deduped = []
        skipped_dup = 0
        for row in rows:
            ddtd = row[5]
            if ddtd is None:
                deduped.append(row)
                continue
            key = (row[1], row[2], ddtd)  # company_id, direction, ddtd
            if key in seen:
                skipped_dup += 1
                continue
            seen.add(key)
            deduped.append(row)
        if skipped_dup:
            log(f"  deduplicating: skipped {skipped_dup} rows with duplicate (direction, ddtd)")
        n = self._execute(
            "INSERT INTO vat_records (id, company_id, direction, tax_type, date, ddtd, "
            "parent_ddtd, invoice_no, partner_id, partner_name, partner_register, "
            "amount, vat_amount, total_amount, paid_amount, status, source, ebarimt_status) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            deduped,
        )
        log(f"  inserted {n}/{len(sl_rows)} vat_records")

    # -------------------------------------------------------------------------
    def _pick_account(self, *, type: str, code_prefixes: list[str] = None,
                      name_contains: list[str] = None) -> str:
        """Pick the first matching account, falling back to any postable account of type."""
        with self.pg.cursor() as c:
            # Try by code prefix
            if code_prefixes:
                for prefix in code_prefixes:
                    c.execute("SELECT id FROM accounts WHERE company_id = %s AND type = %s "
                              "AND code LIKE %s AND is_postable = true LIMIT 1",
                              (str(DEFAULT_COMPANY_ID), type, prefix + "%"))
                    r = c.fetchone()
                    if r:
                        return r[0]
            # Try by name substring
            if name_contains:
                for kw in name_contains:
                    c.execute("SELECT id FROM accounts WHERE company_id = %s AND type = %s "
                              "AND lower(name) LIKE %s AND is_postable = true LIMIT 1",
                              (str(DEFAULT_COMPANY_ID), type, f"%{kw.lower()}%"))
                    r = c.fetchone()
                    if r:
                        return r[0]
            # Fallback: any postable account of this type
            c.execute("SELECT id FROM accounts WHERE company_id = %s AND type = %s "
                      "AND is_postable = true ORDER BY code LIMIT 1",
                      (str(DEFAULT_COMPANY_ID), type))
            r = c.fetchone()
            if not r:
                raise RuntimeError(f"No postable {type} account found in company")
            return r[0]

    def migrate_receivables(self) -> None:
        log("→ receivables")
        sl_rows = self.sl.execute("SELECT * FROM receivables").fetchall()
        ar_acc = self._pick_account(
            type="asset",
            code_prefixes=["121", "12", "13"],
            name_contains=["авлага", "ar"],
        )
        log(f"  using AR account: {ar_acc}")

        rows = []
        for r in sl_rows:
            d = to_date(r["date"])
            if not d:
                continue
            partner_uuid = to_uuid_map(r["partner_id"], self.maps["partners"])
            if not partner_uuid:
                continue
            new_id = uuid.uuid4()
            self.maps["receivables"][r["id"]] = new_id
            amount = to_money(r["amount"]) or Decimal("0")
            if amount <= 0:
                continue
            paid = to_money(r["paid_amount"]) or Decimal("0")
            paid = min(paid, amount)
            status = (r["status"] or "draft").lower()
            if status not in ("draft","open","partial","paid","overdue","cancelled","written_off"):
                status = "open"
            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID), str(partner_uuid),
                r["invoice_no"], d, to_date(r["due_date"]),
                r["description"],
                amount, Decimal("0"), amount,           # treat amount as total (no VAT in legacy)
                paid, status,
                r["responsible"] if "responsible" in r.keys() else None,
                str(ar_acc),
            ))

        n = self._execute(
            "INSERT INTO receivables (id, company_id, partner_id, invoice_no, invoice_date, "
            "due_date, description, amount, vat_amount, total_amount, paid_amount, status, "
            "responsible, ar_account_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (company_id, invoice_no) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} receivables")

    # -------------------------------------------------------------------------
    def migrate_payables(self) -> None:
        log("→ payables")
        sl_rows = self.sl.execute("SELECT * FROM payables").fetchall()
        if not sl_rows:
            log("  (no payables in source)")
            return

        try:
            ap_acc = self._pick_account(
                type="liability",
                code_prefixes=["21", "22"],
                name_contains=["өглөг", "ap"],
            )
        except RuntimeError:
            log("  (no liability account → skip)")
            return

        rows = []
        for r in sl_rows:
            d = to_date(r["date"])
            if not d:
                continue
            partner_uuid = to_uuid_map(r["partner_id"], self.maps["partners"])
            if not partner_uuid:
                continue
            new_id = uuid.uuid4()
            self.maps["payables"][r["id"]] = new_id
            amount = to_money(r["amount"]) or Decimal("0")
            if amount <= 0:
                continue
            paid = to_money(r["paid_amount"]) or Decimal("0")
            paid = min(paid, amount)
            status = (r["status"] or "draft").lower()
            if status not in ("draft","open","partial","paid","overdue","cancelled","written_off"):
                status = "open"
            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID), str(partner_uuid),
                r["invoice_no"], d, to_date(r["due_date"]),
                r["description"],
                amount, Decimal("0"), amount, paid, status,
                str(ap_acc),
            ))
        n = self._execute(
            "INSERT INTO payables (id, company_id, partner_id, invoice_no, invoice_date, "
            "due_date, description, amount, vat_amount, total_amount, paid_amount, status, "
            "ap_account_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} payables")

    # -------------------------------------------------------------------------
    def migrate_cash_transactions(self) -> None:
        log("→ cash_transactions (note: bank_accounts will be auto-created from unique banks)")
        sl_rows = self.sl.execute("SELECT * FROM cash_transactions").fetchall()
        # Distinct banks
        banks = sorted({(r["bank"] or "Unknown") for r in sl_rows})
        log(f"  found {len(banks)} distinct banks: {banks[:5]}...")

        # Create bank_accounts (one per distinct bank, linked to a default cash GL account)
        cash_acc = self._pick_account(
            type="asset",
            code_prefixes=["111", "112", "11"],
            name_contains=["банк", "касс", "cash", "bank"],
        )
        log(f"  using cash GL account: {cash_acc}")

        bank_map: dict[str, uuid.UUID] = {}
        for b in banks:
            bid = uuid.uuid4()
            bank_map[b] = bid
        with self.pg.cursor() as c:
            psycopg2.extras.execute_batch(c,
                "INSERT INTO bank_accounts (id, company_id, name, bank_name, account_number, "
                "currency, gl_account_id) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                [(str(bank_map[b]), str(DEFAULT_COMPANY_ID), b, b, f"MIGRATED-{b}", "MNT", str(cash_acc))
                 for b in banks])

        rows = []
        for r in sl_rows:
            d = to_date(r["date"])
            if not d:
                continue
            new_id = uuid.uuid4()
            self.maps["cash_transactions"][r["id"]] = new_id

            income  = to_money(r["income"]) or Decimal("0")
            expense = to_money(r["expense"]) or Decimal("0")
            if income > 0:
                direction, amount = "income", income
            elif expense > 0:
                direction, amount = "expense", expense
            else:
                continue  # zero rows are useless

            bank = r["bank"] or "Unknown"
            partner_uuid = to_uuid_map(r["partner_id"], self.maps["partners"])
            journal_uuid = self.maps["journals"].get(r["journal_id"]) if r["journal_id"] else None

            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID),
                str(bank_map[bank]),
                d,
                direction, amount,
                r["description"], r["partner_name"], r["partner_acc"],
                str(partner_uuid) if partner_uuid else None,
                r["income_cat"] or r["expense_cat"],
                "MNT", Decimal("1.0"),
                r["row_num"],
                str(journal_uuid) if journal_uuid else None,
            ))

        n = self._execute(
            "INSERT INTO cash_transactions (id, company_id, bank_account_id, txn_date, "
            "direction, amount, description, partner_name, partner_acc, partner_id, "
            "category, currency, exchange_rate, source_row_num, journal_id) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} cash transactions")

    # -------------------------------------------------------------------------
    def migrate_invoice_payments(self) -> None:
        log("→ invoice_payments")
        sl_rows = self.sl.execute("SELECT * FROM invoice_payments").fetchall()
        rows = []
        for r in sl_rows:
            recv_uuid = to_uuid_map(r["receivable_id"], self.maps["receivables"])
            cash_uuid = to_uuid_map(r["cash_txn_id"], self.maps["cash_transactions"])
            if not recv_uuid or not cash_uuid:
                continue
            amount = to_money(r["amount"]) or Decimal("0")
            if amount <= 0:
                continue
            rows.append((
                str(uuid.uuid4()), str(DEFAULT_COMPANY_ID),
                str(recv_uuid), None, str(cash_uuid),
                amount, date.today(),
                r["notes"],
            ))
        n = self._execute(
            "INSERT INTO invoice_payments (id, company_id, receivable_id, payable_id, "
            "cash_txn_id, amount, payment_date, notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} invoice_payments")

    # -------------------------------------------------------------------------
    def migrate_salary_records(self) -> None:
        log("→ salary_records")
        sl_rows = self.sl.execute("SELECT * FROM salary_records").fetchall()
        rows = []
        for r in sl_rows:
            emp_uuid = to_uuid_map(r["employee_id"], self.maps["employees"])
            if not emp_uuid:
                continue
            year, month = int(r["year"]), int(r["month"])
            pid = self.period_cache.get((year, month))
            if not pid:
                continue
            new_id = uuid.uuid4()
            self.maps["salary_records"][r["id"]] = new_id
            status = (r["status"] or "draft").lower()
            if status not in ("draft","approved","posted","paid","cancelled"):
                status = "draft"
            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID), str(emp_uuid), str(pid),
                year, month,
                to_money(r["base_salary"]) or Decimal("0"),
                to_money(r["worked_hrs"]) or Decimal("0"),
                to_money(r["total_hrs"]) or Decimal("0"),
                to_money(r["phone"]) or Decimal("0"),
                to_money(r["sales_bonus"]) or Decimal("0"),
                to_money(r["leave_pay"]) or Decimal("0"),
                to_money(r["bod_salary"]) or Decimal("0"),
                to_money(r["total_income"]) or Decimal("0"),
                to_money(r["emndsh"]) or Decimal("0"),
                to_money(r["hhoat_ded"]) or Decimal("0"),
                to_money(r["hhoat"]) or Decimal("0"),
                to_money(r["advance"]) or Decimal("0"),
                to_money(r["other_ded"]) or Decimal("0"),
                to_money(r["net_pay"]) or Decimal("0"),
                status,
                r["notes"],
            ))
        n = self._execute(
            "INSERT INTO salary_records (id, company_id, employee_id, period_id, year, month, "
            "base_salary, worked_hours, total_hours, phone_allowance, sales_bonus, leave_pay, "
            "bod_salary, total_income, emndsh, hhoat_deduction, hhoat, advance, other_deduction, "
            "net_pay, status, notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (employee_id, year, month) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} salary_records")

    # -------------------------------------------------------------------------
    def migrate_fixed_assets(self) -> None:
        log("→ fixed_assets")
        sl_rows = self.sl.execute("SELECT * FROM fixed_assets").fetchall()
        asset_acc = self._pick_account(
            type="asset",
            code_prefixes=["15", "16"],
            name_contains=["хөрөнгө", "asset"],
        )

        rows = []
        for r in sl_rows:
            d = to_date(r["purchase_date"])
            if not d:
                continue
            new_id = uuid.uuid4()
            self.maps["fixed_assets"][r["id"]] = new_id
            life_years = int(r["useful_life"] or 5)
            life_months = max(life_years * 12, 1)
            purchase = to_money(r["purchase_amount"]) or Decimal("0")
            if purchase <= 0:
                continue
            salvage = to_money(r["salvage_value"]) or Decimal("0")
            if salvage >= purchase:
                salvage = Decimal("0")
            accum = to_money(r["accumulated_depreciation"]) or Decimal("0")
            if accum > purchase:
                accum = purchase
            status = (r["status"] or "active").lower()
            if status not in ("active","inactive","disposed","written_off"):
                status = "active"
            rows.append((
                str(new_id), str(DEFAULT_COMPANY_ID),
                r["code"], r["name"], r["category"],
                d, purchase, life_months, salvage, accum,
                str(asset_acc),
                r["location"], r["responsible_person"], status, r["notes"],
            ))
        n = self._execute(
            "INSERT INTO fixed_assets (id, company_id, code, name, category, purchase_date, "
            "purchase_amount, useful_life_months, salvage_value, accumulated_depreciation, "
            "asset_account_id, location, responsible_person, status, notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
            "ON CONFLICT (company_id, code) DO NOTHING",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} fixed_assets")

    # -------------------------------------------------------------------------
    def migrate_reconciliations(self) -> None:
        log("→ reconciliations")
        sl_rows = self.sl.execute("SELECT * FROM reconciliations").fetchall()
        if not sl_rows:
            log("  (no reconciliations in source)")
            return
        rows = []
        for r in sl_rows:
            partner_uuid = to_uuid_map(r["partner_id"], self.maps["partners"])
            vat_uuid = to_uuid_map(r["vat_record_id"], self.maps["vat_records"])
            cash_uuid = to_uuid_map(r["cash_txn_id"], self.maps["cash_transactions"])
            if not partner_uuid:
                continue
            rows.append((
                str(uuid.uuid4()), str(DEFAULT_COMPANY_ID),
                "vat_cash", "matched", str(partner_uuid),
                str(vat_uuid) if vat_uuid else None,
                str(cash_uuid) if cash_uuid else None,
                to_money(r["matched_amount"]) or Decimal("0"),
                r["notes"],
            ))
        n = self._execute(
            "INSERT INTO reconciliations (id, company_id, type, status, partner_id, "
            "vat_record_id, cash_txn_id, matched_amount, notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            rows,
        )
        log(f"  inserted {n}/{len(sl_rows)} reconciliations")


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------
def reset_tables(pg: psycopg2.extensions.connection) -> None:
    log("Resetting tables (TRUNCATE CASCADE)...")
    with pg.cursor() as c:
        c.execute("""
        TRUNCATE
          reconciliations, depreciation_schedule, fixed_assets,
          salary_records, employees,
          invoice_payments, cash_transactions, bank_accounts,
          payables, receivables, vat_records,
          journal_lines, journals,
          partners, accounts
        RESTART IDENTITY CASCADE;
        """)


def validate(sl: sqlite3.Connection, pg: psycopg2.extensions.connection) -> None:
    log("=" * 60)
    log("VALIDATION")
    log("=" * 60)
    queries = [
        ("accounts",             "SELECT COUNT(*) FROM accounts"),
        ("partners",             "SELECT COUNT(*) FROM partners"),
        ("employees",            "SELECT COUNT(*) FROM employees"),
        ("journals",             "SELECT COUNT(*) FROM journals"),
        ("vat_records",          "SELECT COUNT(*) FROM vat_records"),
        ("receivables",          "SELECT COUNT(*) FROM receivables"),
        ("payables",             "SELECT COUNT(*) FROM payables"),
        ("cash_transactions",    "SELECT COUNT(*) FROM cash_transactions"),
        ("invoice_payments",     "SELECT COUNT(*) FROM invoice_payments"),
        ("salary_records",       "SELECT COUNT(*) FROM salary_records"),
        ("fixed_assets",         "SELECT COUNT(*) FROM fixed_assets"),
    ]
    log(f"{'Table':<22} {'SQLite':>10} {'Postgres':>10} {'Match':>8}")
    log("-" * 55)
    for name, q in queries:
        sl_n = sl.execute(q).fetchone()[0]
        with pg.cursor() as c:
            c.execute(q)
            pg_n = c.fetchone()[0]
        match = "✅" if sl_n == pg_n else "⚠️"
        log(f"{name:<22} {sl_n:>10} {pg_n:>10} {match:>8}")

    # Double-entry check
    log("")
    log("Double-entry balance per posted journal:")
    with pg.cursor() as c:
        c.execute("""
        SELECT j.number,
               COALESCE(SUM(jl.debit), 0)  AS dr,
               COALESCE(SUM(jl.credit), 0) AS cr
          FROM journals j
     LEFT JOIN journal_lines jl ON jl.journal_id = j.id
         WHERE j.status = 'posted'
      GROUP BY j.id, j.number
        HAVING COALESCE(SUM(jl.debit), 0) <> COALESCE(SUM(jl.credit), 0)
         LIMIT 10
        """)
        unbalanced = c.fetchall()
        if unbalanced:
            log(f"  ⚠️  {len(unbalanced)} unbalanced posted journals (first 10):")
            for num, dr, cr in unbalanced:
                log(f"     {num}: Dr={dr} Cr={cr} diff={dr-cr}")
        else:
            log("  ✅ All posted journals balanced.")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--reset", action="store_true", help="TRUNCATE all tables first")
    p.add_argument("--skip-post", action="store_true", help="Skip the post_journal pass")
    args = p.parse_args()

    sl = open_sqlite()
    pg = open_postgres(args.dry_run)

    try:
        if args.reset and not args.dry_run:
            reset_tables(pg)
            pg.commit()

        m = Migrator(sl, pg, args.dry_run)

        m.migrate_accounts()
        m.migrate_partners()
        m.migrate_employees()
        m.migrate_journals()
        m.migrate_journal_lines()
        m.migrate_vat_records()
        m.migrate_receivables()
        m.migrate_payables()
        m.migrate_cash_transactions()
        m.migrate_invoice_payments()
        m.migrate_salary_records()
        m.migrate_fixed_assets()
        m.migrate_reconciliations()

        if args.dry_run:
            log("DRY RUN — rolling back.")
            pg.rollback()
        else:
            pg.commit()
            log("✅ Data committed.")

            if not args.skip_post:
                m.post_journals()
                pg.commit()

            validate(sl, pg)

    except Exception as e:
        log(f"❌ ERROR: {e}")
        pg.rollback()
        raise
    finally:
        sl.close()
        pg.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
