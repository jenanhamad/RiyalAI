"""Simple JWT auth for local personal use."""
import os
import re
import uuid
from datetime import datetime, timedelta, date

import bcrypt
import jwt

from database import get_connection

SECRET = os.environ.get("JWT_SECRET", "riyalai-local-dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_HOURS = 24 * 30  # 30 days for personal app
USERNAME_RE = re.compile(r"^[^\s@]{3,20}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def normalize_username(username: str) -> str:
    return username.strip()


def validate_username(username: str) -> str:
    username = normalize_username(username)
    if not USERNAME_RE.match(username):
        raise ValueError("اسم المستخدم: 3–20 حرفاً بدون مسافات")
    return username


def normalize_email(email: str | None) -> str | None:
    if not email or not str(email).strip():
        return None
    email = str(email).strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("البريد الإلكتروني غير صالح")
    return email


def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def _row_mode(row) -> str:
    try:
        mode = row["active_mode"]
    except (KeyError, IndexError):
        mode = "personal"
    return mode if mode in ("personal", "business") else "personal"


def register_user(
    username: str,
    password: str,
    email: str | None = None,
    account_mode: str = "personal",
) -> dict:
    username = validate_username(username)
    if len(password) < 6:
        raise ValueError("كلمة المرور 6 أحرف على الأقل")

    mode = account_mode if account_mode in ("personal", "business") else "personal"
    normalized_email = normalize_email(email)

    conn = get_connection()
    existing = conn.execute(
        "SELECT user_id FROM users WHERE lower(username) = lower(?)",
        (username,),
    ).fetchone()
    if existing:
        conn.close()
        raise ValueError("اسم المستخدم مستخدم مسبقاً")

    if normalized_email:
        email_taken = conn.execute(
            "SELECT user_id FROM users WHERE lower(email) = lower(?)",
            (normalized_email,),
        ).fetchone()
        if email_taken:
            conn.close()
            raise ValueError("البريد الإلكتروني مستخدم مسبقاً")

    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    stored_email = normalized_email or f"{user_id}@local.riyalai"
    conn.execute(
        """INSERT INTO users (user_id, username, email, password_hash, display_name, xp, level, streak,
           weekly_xp, week_start, active_mode, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 1, 0, 0, ?, ?, ?, ?)""",
        (user_id, username, stored_email, hash_password(password), username, week_start, mode, now, now),
    )
    conn.commit()
    conn.close()
    token = create_token(user_id, username)
    return {
        "token": token,
        "userId": user_id,
        "username": username,
        "displayName": username,
        "email": normalized_email,
        "activeMode": mode,
    }


def login_user(username: str, password: str) -> dict:
    username = normalize_username(username)
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM users WHERE lower(username) = lower(?)",
        (username,),
    ).fetchone()
    conn.close()
    if not row or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid username or password")
    display = row["display_name"] or row["username"]
    token = create_token(row["user_id"], row["username"])
    return {
        "token": token,
        "userId": row["user_id"],
        "username": row["username"],
        "displayName": display,
        "activeMode": _row_mode(row),
    }
