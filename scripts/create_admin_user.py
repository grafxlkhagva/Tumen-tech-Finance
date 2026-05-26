#!/usr/bin/env python3
"""
Create a user in Supabase Auth and link them to the default company as admin.

Usage:
    python3 scripts/create_admin_user.py <email> <password> [--role admin|accountant|auditor|viewer]

Examples:
    python3 scripts/create_admin_user.py admin@tumen.mn 'StrongPass123!'
    python3 scripts/create_admin_user.py accountant@tumen.mn 'Secret999' --role accountant

This uses the SERVICE_ROLE_KEY (admin API) — never expose this in client code.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import psycopg2
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

SUPABASE_URL              = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_DB_URL           = os.environ.get("SUPABASE_DB_URL", "")
DEFAULT_COMPANY_ID        = "00000000-0000-0000-0000-000000000001"

VALID_ROLES = ("admin", "accountant", "auditor", "viewer")


def create_user(email: str, password: str) -> dict:
    """Create user via Supabase Admin API. email_confirm=True bypasses email verification."""
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/admin/users",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
        },
        timeout=15,
    )
    if r.status_code in (200, 201):
        return r.json()
    if r.status_code == 422 and "already" in r.text.lower():
        # User already exists — fetch them instead
        r2 = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
            params={"email": email},
            timeout=15,
        )
        users = (r2.json() or {}).get("users", [])
        for u in users:
            if u.get("email", "").lower() == email.lower():
                print(f"⚠️  User {email} already exists (id={u['id']}). "
                      f"Use Dashboard to reset password if needed.")
                return u
    sys.exit(f"❌ Failed to create user: {r.status_code} {r.text}")


def link_user_to_company(user_id: str, company_id: str, role: str) -> None:
    """Insert (or update) row in user_companies."""
    conn = psycopg2.connect(SUPABASE_DB_URL, connect_timeout=15)
    conn.autocommit = True
    with conn.cursor() as c:
        c.execute("""
            INSERT INTO user_companies (user_id, company_id, role, is_default)
            VALUES (%s, %s, %s, true)
            ON CONFLICT (user_id, company_id)
            DO UPDATE SET role = EXCLUDED.role, is_default = true
        """, (user_id, company_id, role))
    conn.close()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("email")
    p.add_argument("password")
    p.add_argument("--role", default="admin", choices=VALID_ROLES)
    p.add_argument("--company-id", default=DEFAULT_COMPANY_ID)
    args = p.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or not SUPABASE_DB_URL:
        sys.exit("❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL in .env.local")
    if len(args.password) < 8:
        sys.exit("❌ Password must be at least 8 characters")

    print(f"→ Creating user {args.email} in Supabase Auth...")
    user = create_user(args.email, args.password)
    user_id = user.get("id")
    print(f"  ✅ User id: {user_id}")

    print(f"→ Linking user to company {args.company_id} as '{args.role}'...")
    link_user_to_company(user_id, args.company_id, args.role)
    print(f"  ✅ Linked.")

    print()
    print(f"🎉 User ready. Sign in at http://localhost:8080/login")
    print(f"   Email: {args.email}")
    print(f"   Role:  {args.role}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
