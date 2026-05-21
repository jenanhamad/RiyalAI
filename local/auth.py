"""Simple JWT auth for local personal use."""
import os
import uuid
from datetime import datetime, timedelta, date

import bcrypt
import jwt

from database import get_connection

SECRET = os.environ.get("JWT_SECRET", "riyalai-local-dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_HOURS = 24 * 30  # 30 days for personal app


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None


def register_user(email: str, password: str, display_name: str = "") -> dict:
    conn = get_connection()
    existing = conn.execute("SELECT user_id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise ValueError("Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    conn.execute(
        """INSERT INTO users (user_id, email, password_hash, display_name, xp, level, streak,
           weekly_xp, week_start, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, 1, 0, 0, ?, ?, ?)""",
        (user_id, email, hash_password(password), display_name or email.split("@")[0], week_start, now, now),
    )
    conn.commit()
    conn.close()
    token = create_token(user_id, email)
    return {"token": token, "userId": user_id, "email": email, "displayName": display_name or email.split("@")[0]}


def login_user(email: str, password: str) -> dict:
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not row or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid email or password")
    token = create_token(row["user_id"], row["email"])
    return {
        "token": token,
        "userId": row["user_id"],
        "email": row["email"],
        "displayName": row["display_name"] or row["email"].split("@")[0],
    }
