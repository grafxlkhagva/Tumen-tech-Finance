"""
Supabase Auth integration for the legacy Flask app.

Flow:
  - /login GET → render login form
  - /login POST → call Supabase Auth password grant, store tokens in session
  - /logout → clear session
  - All other routes → require valid session (via before_request guard)

Token refresh: if access_token expired (Supabase JWT is 1h), call refresh.
"""
from __future__ import annotations

import functools
import os
import time
import requests
from flask import session, redirect, url_for, request, g, current_app


SUPABASE_URL: str = ""
SUPABASE_ANON_KEY: str = ""
SUPABASE_SERVICE_ROLE_KEY: str = ""

_SESSION_KEY_USER_ID    = "user_id"
_SESSION_KEY_USER_EMAIL = "user_email"
_SESSION_KEY_ACCESS     = "sb_access_token"
_SESSION_KEY_REFRESH    = "sb_refresh_token"
_SESSION_KEY_EXPIRES    = "sb_expires_at"
_SESSION_KEY_COMPANY_ID = "company_id"
_SESSION_KEY_ROLE       = "company_role"

# Public endpoints (no auth required)
PUBLIC_PATHS = ("/login", "/logout", "/static", "/healthz")


class AuthError(Exception):
    """Authentication failure (bad credentials, expired, etc.)."""


# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
def init(app):
    """Initialize auth module from environment variables."""
    global SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        app.logger.warning("SUPABASE_URL / SUPABASE_ANON_KEY not set — auth will fail.")

    @app.before_request
    def _auth_guard():
        # Allow public endpoints
        for p in PUBLIC_PATHS:
            if request.path.startswith(p):
                return None
        # Check session
        uid = session.get(_SESSION_KEY_USER_ID)
        if not uid:
            return redirect(url_for("login_view", next=request.path))
        # Refresh token if near expiry
        exp = session.get(_SESSION_KEY_EXPIRES, 0)
        if exp and exp - time.time() < 60:
            try:
                _refresh_session()
            except AuthError:
                session.clear()
                return redirect(url_for("login_view", next=request.path))
        # Make user available to templates / routes via g
        g.user = {
            "id":      session.get(_SESSION_KEY_USER_ID),
            "email":   session.get(_SESSION_KEY_USER_EMAIL),
            "role":    session.get(_SESSION_KEY_ROLE),
            "company_id": session.get(_SESSION_KEY_COMPANY_ID),
        }

    @app.context_processor
    def _inject_user():
        return {"current_user": getattr(g, "user", None)}


# -----------------------------------------------------------------------------
# Supabase Auth REST calls
# -----------------------------------------------------------------------------
def sign_in(email: str, password: str) -> dict:
    """Password grant. Returns Supabase Auth payload."""
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"email": email, "password": password},
        timeout=15,
    )
    if r.status_code != 200:
        try:
            msg = r.json().get("error_description") or r.json().get("msg") or r.text
        except Exception:
            msg = r.text
        raise AuthError(f"Sign-in failed: {msg}")
    return r.json()


def sign_out(access_token: str) -> None:
    """Revoke the access token (best-effort)."""
    if not access_token:
        return
    try:
        requests.post(
            f"{SUPABASE_URL}/auth/v1/logout",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=5,
        )
    except requests.RequestException:
        pass  # not critical


def refresh(refresh_token: str) -> dict:
    """Exchange refresh token for a new access token."""
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
        json={"refresh_token": refresh_token},
        timeout=15,
    )
    if r.status_code != 200:
        raise AuthError("Refresh failed")
    return r.json()


def update_password(access_token: str, new_password: str) -> dict:
    """User-initiated password change. Requires the user's own JWT."""
    if not new_password or len(new_password) < 8:
        raise AuthError("Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой")
    r = requests.put(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"password": new_password},
        timeout=15,
    )
    if r.status_code != 200:
        try:
            msg = r.json().get("msg") or r.json().get("error_description") or r.text
        except Exception:
            msg = r.text
        raise AuthError(f"Нууц үг солих амжилтгүй: {msg}")
    return r.json()


def verify_password(email: str, password: str) -> bool:
    """Verify that email+password are correct (used as 'current password' check)."""
    try:
        sign_in(email, password)
        return True
    except AuthError:
        return False


# -----------------------------------------------------------------------------
# Session helpers
# -----------------------------------------------------------------------------
def store_session(payload: dict, company_id: str | None = None, role: str | None = None) -> None:
    """Persist Supabase Auth payload + company info into Flask session."""
    user = payload.get("user") or {}
    session[_SESSION_KEY_USER_ID]    = user.get("id")
    session[_SESSION_KEY_USER_EMAIL] = user.get("email")
    session[_SESSION_KEY_ACCESS]     = payload.get("access_token")
    session[_SESSION_KEY_REFRESH]    = payload.get("refresh_token")
    expires_in = payload.get("expires_in") or 3600
    session[_SESSION_KEY_EXPIRES]    = int(time.time()) + int(expires_in)
    if company_id:
        session[_SESSION_KEY_COMPANY_ID] = company_id
    if role:
        session[_SESSION_KEY_ROLE] = role


def clear_session() -> None:
    for k in (_SESSION_KEY_USER_ID, _SESSION_KEY_USER_EMAIL,
              _SESSION_KEY_ACCESS, _SESSION_KEY_REFRESH, _SESSION_KEY_EXPIRES,
              _SESSION_KEY_COMPANY_ID, _SESSION_KEY_ROLE):
        session.pop(k, None)


def _refresh_session() -> None:
    rt = session.get(_SESSION_KEY_REFRESH)
    if not rt:
        raise AuthError("No refresh token")
    payload = refresh(rt)
    # Preserve company info; replace tokens
    company_id = session.get(_SESSION_KEY_COMPANY_ID)
    role = session.get(_SESSION_KEY_ROLE)
    store_session(payload, company_id=company_id, role=role)


# -----------------------------------------------------------------------------
# Company / role lookup (from user_companies table in Postgres)
# -----------------------------------------------------------------------------
def fetch_user_company(user_id: str, access_token: str) -> tuple[str | None, str | None]:
    """Return (company_id, role) for the user's default company.
    Uses PostgREST with user's own JWT so RLS applies."""
    if not SUPABASE_URL:
        return None, None
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/user_companies"
        f"?user_id=eq.{user_id}&order=is_default.desc&limit=1"
        f"&select=company_id,role",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {access_token}",
        },
        timeout=10,
    )
    if r.status_code == 200 and r.json():
        row = r.json()[0]
        return row.get("company_id"), row.get("role")
    return None, None


# -----------------------------------------------------------------------------
# Decorators (for code clarity; before_request also covers this)
# -----------------------------------------------------------------------------
def login_required(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get(_SESSION_KEY_USER_ID):
            return redirect(url_for("login_view", next=request.path))
        return f(*args, **kwargs)
    return wrapper


def role_required(*roles: str):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            if not session.get(_SESSION_KEY_USER_ID):
                return redirect(url_for("login_view", next=request.path))
            if session.get(_SESSION_KEY_ROLE) not in roles:
                return ("Forbidden — requires role: " + ", ".join(roles), 403)
            return f(*args, **kwargs)
        return wrapper
    return decorator
