#!/usr/bin/env python3
"""Seed sample expenses and challenges for a demo user."""
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import init_db, get_connection

USERNAME = "jinan"
DEFAULT_PASSWORD = "123456"

SAMPLE_EXPENSES = [
    ("قهوة Starbucks", 18, "Food & Dining", 0),
    ("غداء مطعم", 85, "Food & Dining", 1),
    ("اوبر", 35, "Transportation", 0),
    ("بنزين أدنوك", 120, "Gas", 2),
    ("بنده", 156, "Groceries", 1),
    ("نتflix", 45, "Entertainment", 3),
    ("شي إن", 230, "Shopping", 4),
    ("STC فاتورة", 199, "Utilities", 5),
    ("صيدلية", 42, "Healthcare", 2),
    ("كافيه", 32, "Food & Dining", 0),
]

SAMPLE_CHALLENGES = [
    {
        "title": "خفّض مصروف الطعام",
        "description": "أنت تصرف كثير على الأكل — حاول تخفّض 20% هذا الأسبوع (+150 XP)",
        "category": "Food & Dining",
        "target_reduction_percent": 20,
        "xp_reward": 150,
    },
    {
        "title": "أسبوع بدون تسوق زائد",
        "description": "قلّل مشتريات التسوق 15% عن الشهر الماضي (+120 XP)",
        "category": "Shopping",
        "target_reduction_percent": 15,
        "xp_reward": 120,
    },
    {
        "title": "تحكم بالمواصلات",
        "description": "راقب مصروف أوبر والوقود — هدفك خفض 10% (+100 XP)",
        "category": "Transportation",
        "target_reduction_percent": 10,
        "xp_reward": 100,
    },
]


def _find_user(conn, username: str):
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
    if "username" in cols:
        row = conn.execute(
            """SELECT * FROM users
               WHERE lower(username) = lower(?)
                  OR lower(display_name) = lower(?)
                  OR lower(email) LIKE lower(?)""",
            (username, username, f"{username}@%"),
        ).fetchone()
    else:
        row = conn.execute(
            """SELECT * FROM users
               WHERE lower(display_name) = lower(?)
                  OR lower(email) LIKE lower(?)""",
            (username, f"%{username}%"),
        ).fetchone()
    return dict(row) if row else None


def _ensure_user(conn, username: str):
    user = _find_user(conn, username)
    if user:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
        if "username" in cols and not user.get("username"):
            conn.execute(
                "UPDATE users SET username = ?, updated_at = ? WHERE user_id = ?",
                (username, datetime.utcnow().isoformat(), user["user_id"]),
            )
            conn.commit()
            user = _find_user(conn, username)
        return user

    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
    now = datetime.utcnow().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    user_id = str(uuid.uuid4())
    email = f"{username}@example.com"
    import auth
    pwd = auth.hash_password(DEFAULT_PASSWORD)

    if "username" in cols:
        conn.execute(
            """INSERT INTO users (user_id, username, email, password_hash, display_name, xp, level, streak,
               weekly_xp, week_start, last_log_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 0, 1, 0, 0, ?, NULL, ?, ?)""",
            (user_id, username, email, pwd, username, week_start, now, now),
        )
    else:
        conn.execute(
            """INSERT INTO users (user_id, email, password_hash, display_name, xp, level, streak,
               weekly_xp, week_start, created_at, updated_at)
               VALUES (?, ?, ?, ?, 0, 1, 0, 0, ?, ?, ?)""",
            (user_id, email, pwd, username, week_start, now, now),
        )
    conn.commit()
    return _find_user(conn, username)


def seed(username: str = USERNAME, replace: bool = False):
    init_db()
    conn = get_connection()
    user = _ensure_user(conn, username)
    user_id = user["user_id"]

    if replace:
        conn.execute("DELETE FROM expenses WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM challenges WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM voice_logs WHERE user_id = ?", (user_id,))

    existing = conn.execute(
        "SELECT COUNT(*) AS c FROM expenses WHERE user_id = ?",
        (user_id,),
    ).fetchone()["c"]

    added_expenses = 0
    if replace:
        existing = 0

    if existing == 0:
        now = datetime.utcnow().isoformat()
        for merchant, amount, category, days_ago in SAMPLE_EXPENSES:
            expense_date = (date.today() - timedelta(days=days_ago)).isoformat()
            conn.execute(
                """INSERT INTO expenses (expense_id, user_id, merchant, amount, date, category,
                   payment_method, description, notes, status, has_receipt, is_recurring,
                   receipt_key, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'Credit Card', '', '', 'processed', 0, 0, NULL, ?, ?)""",
                (str(uuid.uuid4()), user_id, merchant, amount, expense_date, category, now, now),
            )
            added_expenses += 1

    existing_ch = conn.execute(
        "SELECT COUNT(*) AS c FROM challenges WHERE user_id = ?",
        (user_id,),
    ).fetchone()["c"]

    added_challenges = 0
    if existing_ch == 0 or replace:
        now = datetime.utcnow().isoformat()
        expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
        for ch in SAMPLE_CHALLENGES:
            conn.execute(
                """INSERT INTO challenges (challenge_id, user_id, title, description, category,
                   target_reduction_percent, baseline_amount, xp_reward, status, created_at, expires_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
                (
                    str(uuid.uuid4()),
                    user_id,
                    ch["title"],
                    ch["description"],
                    ch["category"],
                    ch["target_reduction_percent"],
                    500,
                    ch["xp_reward"],
                    now,
                    expires,
                ),
            )
            added_challenges += 1

    xp = added_expenses * 20 if added_expenses else int(user.get("xp") or 0)
    if added_expenses:
        xp = max(xp, 320)
    level = min(20, (xp // 500) + 1)
    today = date.today().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()

    conn.execute(
        """UPDATE users SET xp = ?, level = ?, streak = ?, last_log_date = ?,
           weekly_xp = ?, week_start = ?, display_name = ?, updated_at = ?
           WHERE user_id = ?""",
        (xp, level, 5, today, min(xp, 220), week_start, username, datetime.utcnow().isoformat(), user_id),
    )
    conn.commit()
    conn.close()

    result = {
        "ok": True,
        "username": username,
        "userId": user_id,
        "expensesAdded": added_expenses,
        "challengesAdded": added_challenges,
        "xp": xp,
        "level": level,
        "streak": 5,
        "skippedExpenses": existing > 0 and added_expenses == 0,
        "skippedChallenges": existing_ch > 0 and added_challenges == 0,
    }

    print(f"✓ User: {username} ({user_id})")
    if added_expenses:
        print(f"  + {added_expenses} sample expenses")
    else:
        print("  · skipped expenses (already seeded — use --replace to reset)")
    if added_challenges:
        print(f"  + {added_challenges} challenges")
    else:
        print(f"  · challenges already exist ({existing_ch}) — use --replace to reset")
    print(f"  XP: {xp} · Level: {level} · Streak: 5")

    return result


if __name__ == "__main__":
    replace_flag = "--replace" in sys.argv
    name = USERNAME
    for arg in sys.argv[1:]:
        if arg != "--replace" and not arg.startswith("-"):
            name = arg
    seed(name, replace=replace_flag)
