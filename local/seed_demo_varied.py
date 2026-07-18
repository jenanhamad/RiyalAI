#!/usr/bin/env python3
"""Seed varied demo data for 3 users, each with a different business type.

Users & businesses:
  - jinan    -> ماتشا بار      (Matcha bar)
  - Sarah    -> بوتيك عبايات   (Abaya boutique)
  - Alhanouf -> مطبخ ورق العنب (Vine-leaves home kitchen)

Each user gets: personal expenses, business expenses + income, challenges,
voice logs. Friendships are created between all three for the friends
leaderboard. Run with the project venv:

  cd local && ./.venv/bin/python seed_demo_varied.py
"""
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import init_db, get_connection
import auth

DEFAULT_PASSWORD = "123456"
NOW = datetime.utcnow().isoformat()


def d(days_ago: int) -> str:
    return (date.today() - timedelta(days=days_ago)).isoformat()


# ---------------------------------------------------------------------------
# Demo definitions
# entry tuple: (merchant, amount, date_days_ago, category, payment_method,
#               has_receipt, is_recurring, entry_type, project_tag, notes)
# ---------------------------------------------------------------------------
def personal(merchant, amount, days_ago, category, method="Credit Card",
             receipt=0, recurring=0, notes=""):
    return (merchant, amount, days_ago, category, method, receipt, recurring,
            "expense", "", notes, "personal")


def biz_exp(merchant, amount, days_ago, category, method="Bank Transfer",
            receipt=0, recurring=0, tag="", notes=""):
    return (merchant, amount, days_ago, category, method, receipt, recurring,
            "expense", tag, notes, "business")


def biz_inc(merchant, amount, days_ago, tag="", method="Digital Wallet", notes=""):
    return (merchant, amount, days_ago, "Other", method, 0, 0,
            "income", tag, notes, "business")


DEMO = {
    "jinan": {
        "business_name": "ماتشا بار",
        "active_mode": "business",
        "xp": 480, "level": 1, "streak": 5, "weekly_xp": 160,
        "personal": [
            personal("قهوة ستاربكس", 19, 0, "Food & Dining"),
            personal("غداء شواية", 74, 1, "Food & Dining"),
            personal("أوبر", 28, 1, "Transportation"),
            personal("بنده", 143, 2, "Groceries"),
            personal("نتفلكس", 45, 3, "Entertainment", recurring=1),
            personal("صيدلية النهدي", 66, 4, "Healthcare"),
            personal("بنزين أدنوك", 110, 5, "Gas"),
            personal("مطعم سوشي", 132, 6, "Food & Dining"),
        ],
        "business": [
            biz_exp("مورد ماتشا ياباني", 1200, 8, "Inventory", receipt=1, tag="مخزون"),
            biz_exp("مخزون حليب وبدائل", 340, 5, "Inventory", receipt=1, tag="مخزون"),
            biz_exp("أكواب ومستلزمات", 260, 6, "Inventory", receipt=0, tag="مخزون"),
            biz_exp("إيجار الكشك", 3500, 12, "Rent", receipt=1, recurring=1),
            biz_exp("راتب باريستا", 2500, 10, "Salaries", receipt=1, recurring=1),
            biz_exp("حملة انستقرام", 400, 4, "Marketing", receipt=0, tag="تسويق"),
            biz_exp("تصوير منتجات", 300, 7, "Marketing", receipt=1, tag="تسويق"),
            biz_exp("فاتورة كهرباء", 220, 9, "Utilities", receipt=1),
            biz_exp("صيانة مكينة", 180, 11, "Equipment", receipt=0),
            biz_exp("توصيل مخزون", 90, 3, "Transportation", receipt=0),
        ],
        "income": [
            biz_inc("مبيعات اليوم", 650, 6, "المحل"),
            biz_inc("مبيعات اليوم", 720, 5, "المحل"),
            biz_inc("طلبات أونلاين", 480, 4, "طلبات أونلاين"),
            biz_inc("مبيعات اليوم", 810, 3, "المحل"),
            biz_inc("طلبات أونلاين", 540, 2, "طلبات أونلاين"),
            biz_inc("مبيعات اليوم", 900, 1, "المحل"),
            biz_inc("مبيعات اليوم", 1020, 0, "المحل"),
        ],
        "challenges": [
            ("خفّض مصروف الطعام", "تصرف كثير على الأكل — خفّض 20% هذا الأسبوع (+150 XP)",
             "Food & Dining", 20, 150),
            ("تحكم بالمواصلات", "راقب أوبر والوقود — هدفك خفض 10% (+100 XP)",
             "Transportation", 10, 100),
        ],
        "voice": [
            ("سجل مبيعات اليوم ألف وعشرين ريال", 1020, "Other", "confirmed", 0),
            ("اشتريت مخزون حليب بثلاثمية وأربعين", 340, "Inventory", "confirmed", 1),
            ("قهوة بتسعة عشر ريال", 19, "Food & Dining", "processed", 0),
        ],
    },
    "Sarah": {
        "business_name": "بوتيك عبايات",
        "active_mode": "business",
        "xp": 300, "level": 1, "streak": 3, "weekly_xp": 220,
        "personal": [
            personal("شي إن", 285, 0, "Shopping"),
            personal("نون", 190, 2, "Shopping"),
            personal("صالون تجميل", 250, 3, "Healthcare"),
            personal("مطعم إيطالي", 165, 4, "Food & Dining"),
            personal("قهوة", 22, 1, "Food & Dining"),
            personal("كريم", 40, 5, "Transportation"),
            personal("بقالة", 98, 6, "Groceries"),
        ],
        "business": [
            biz_exp("قماش عبايات كريب", 2200, 11, "Inventory", receipt=1, tag="تشكيلة الشتاء"),
            biz_exp("أجور خياطة وتطريز", 1500, 8, "Inventory", receipt=1, tag="تشكيلة الشتاء"),
            biz_exp("إيجار الأتيليه", 4000, 13, "Rent", receipt=1, recurring=1),
            biz_exp("راتب خياطة", 3000, 10, "Salaries", receipt=1, recurring=1),
            biz_exp("تسويق مؤثرة سناب", 1500, 5, "Marketing", receipt=0, tag="تسويق"),
            biz_exp("جلسة تصوير عبايات", 600, 7, "Marketing", receipt=1, tag="تسويق"),
            biz_exp("عمولة مندوب مبيعات", 350, 4, "Commissions", receipt=0),
            biz_exp("فاتورة كهرباء وماء", 300, 9, "Utilities", receipt=1),
            biz_exp("شحن أرامكس", 420, 3, "Transportation", receipt=1, tag="طلبات العيد"),
            biz_exp("مكينة خياطة", 900, 12, "Equipment", receipt=0),
        ],
        "income": [
            biz_inc("بيع عباية", 1200, 6, "تشكيلة الشتاء"),
            biz_inc("طلبات العيد", 1800, 5, "طلبات العيد"),
            biz_inc("بيع عباية", 950, 4, "تشكيلة الشتاء"),
            biz_inc("طلبات العيد", 2100, 2, "طلبات العيد"),
            biz_inc("بيع عباية", 640, 1, "تشكيلة الشتاء"),
            biz_inc("بيع عباية", 780, 0, "تشكيلة الشتاء"),
        ],
        "challenges": [
            ("أسبوع بدون تسوق زائد", "قلّل مشتريات التسوق 15% عن الأسبوع الماضي (+120 XP)",
             "Shopping", 15, 120),
            ("خفّض مصروف الطعام", "خفّض مصروف المطاعم 10% هذا الأسبوع (+100 XP)",
             "Food & Dining", 10, 100),
        ],
        "voice": [
            ("بعت عباية بألف ومئتين", 1200, "Other", "confirmed", 0),
            ("شحن أرامكس أربعمية وعشرين", 420, "Transportation", "confirmed", 1),
            ("شي إن مئتين وخمسة وثمانين", 285, "Shopping", "processed", 0),
        ],
    },
    "Alhanouf": {
        "business_name": "مطبخ ورق العنب",
        "active_mode": "business",
        "xp": 620, "level": 2, "streak": 7, "weekly_xp": 300,
        "personal": [
            personal("مخبز", 35, 0, "Food & Dining"),
            personal("بقالة العثيم", 210, 1, "Groceries"),
            personal("أوبر", 32, 2, "Transportation"),
            personal("صيدلية", 58, 3, "Healthcare"),
            personal("مطعم", 88, 4, "Food & Dining"),
            personal("بنزين", 100, 5, "Gas"),
            personal("قهوة", 18, 1, "Food & Dining"),
            personal("سوق الخضار", 76, 6, "Groceries"),
        ],
        "business": [
            biz_exp("مخزون ورق عنب طازج", 480, 6, "Inventory", receipt=1, tag="مناسبات"),
            biz_exp("أرز ومكونات الحشو", 360, 5, "Inventory", receipt=1, tag="مناسبات"),
            biz_exp("زيت وليمون ومواد", 190, 7, "Inventory", receipt=0),
            biz_exp("إيجار المطبخ السحابي", 1800, 12, "Rent", receipt=1, recurring=1),
            biz_exp("أجرة مساعدة تجهيز", 1200, 9, "Salaries", receipt=0, recurring=1),
            biz_exp("إعلان انستقرام", 250, 4, "Marketing", receipt=0, tag="تسويق"),
            biz_exp("فاتورة غاز وكهرباء", 210, 8, "Utilities", receipt=1),
            biz_exp("توصيل مندوب", 300, 3, "Transportation", receipt=0, tag="طلبات الجمعة"),
            biz_exp("أواني وقدور طبخ", 260, 11, "Equipment", receipt=1),
            biz_exp("عمولة تطبيق توصيل", 140, 2, "Commissions", receipt=0),
        ],
        "income": [
            biz_inc("علب ورق عنب", 320, 6, "طلبات يومية"),
            biz_inc("طلبات الجمعة", 600, 5, "طلبات الجمعة"),
            biz_inc("علب ورق عنب", 280, 4, "طلبات يومية"),
            biz_inc("مناسبة عائلية", 900, 3, "مناسبات"),
            biz_inc("علب ورق عنب", 390, 1, "طلبات يومية"),
            biz_inc("طلبات الجمعة", 520, 0, "طلبات الجمعة"),
        ],
        "challenges": [
            ("تحكم بالمواصلات", "راقب مصروف التوصيل والوقود — خفض 10% (+100 XP)",
             "Transportation", 10, 100),
            ("وفّر في البقالة", "قلّل مصروف البقالة الشخصي 15% (+120 XP)",
             "Groceries", 15, 120),
        ],
        "voice": [
            ("مبيعات طلبات الجمعة ستمية ريال", 600, "Other", "confirmed", 0),
            ("مخزون ورق عنب بأربعمية وثمانين", 480, "Inventory", "confirmed", 1),
            ("بقالة بمئتين وعشرة", 210, "Groceries", "processed", 0),
        ],
    },
}


def ensure_user(conn, username, business_name):
    row = conn.execute(
        "SELECT * FROM users WHERE lower(username) = lower(?)", (username,)
    ).fetchone()
    if row:
        return row["user_id"]
    user_id = str(uuid.uuid4())
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    conn.execute(
        """INSERT INTO users (user_id, username, email, password_hash, display_name,
           xp, level, streak, weekly_xp, week_start, last_log_date, active_mode,
           created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 1, 0, 0, ?, NULL, 'personal', ?, ?)""",
        (user_id, username, f"{username.lower()}@example.com",
         auth.hash_password(DEFAULT_PASSWORD), username, week_start, NOW, NOW),
    )
    return user_id


def insert_entry(conn, user_id, e):
    (merchant, amount, days_ago, category, method, receipt, recurring,
     entry_type, tag, notes, mode) = e
    conn.execute(
        """INSERT INTO expenses (expense_id, user_id, merchant, amount, date, category,
           payment_method, description, notes, status, has_receipt, is_recurring,
           receipt_key, mode, entry_type, project_tag, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, 'processed', ?, ?, NULL, ?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), user_id, merchant, amount, d(days_ago), category,
         method, notes, receipt, recurring, mode, entry_type, tag, NOW, NOW),
    )


def insert_challenge(conn, user_id, ch):
    title, desc, category, pct, xp = ch
    baseline = 500
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
    conn.execute(
        """INSERT INTO challenges (challenge_id, user_id, title, description, category,
           target_reduction_percent, baseline_amount, xp_reward, status, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
        (str(uuid.uuid4()), user_id, title, desc, category, pct, baseline, xp, NOW, expires),
    )


def insert_voice(conn, user_id, v, days_ago):
    transcription, amount, category, status, _ = v
    created = (datetime.utcnow() - timedelta(days=days_ago)).isoformat()
    conn.execute(
        """INSERT INTO voice_logs (log_id, user_id, transcription, amount, category,
           confidence, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (str(uuid.uuid4()), user_id, transcription, amount, category, 0.95, status, created),
    )


def make_friends(conn, ids):
    for a in ids:
        for b in ids:
            if a == b:
                continue
            conn.execute(
                "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
                (a, b, NOW),
            )


def main():
    init_db()
    conn = get_connection()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    today = date.today().isoformat()
    user_ids = []
    summary = []

    for username, cfg in DEMO.items():
        user_id = ensure_user(conn, username, cfg["business_name"])
        user_ids.append(user_id)

        # wipe existing demo rows for a clean, repeatable seed
        conn.execute("DELETE FROM expenses WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM challenges WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM voice_logs WHERE user_id = ?", (user_id,))

        for e in cfg["personal"] + cfg["business"] + cfg["income"]:
            insert_entry(conn, user_id, e)
        for ch in cfg["challenges"]:
            insert_challenge(conn, user_id, ch)
        for i, v in enumerate(cfg["voice"]):
            insert_voice(conn, user_id, v, days_ago=i)

        conn.execute(
            """UPDATE users SET xp = ?, level = ?, streak = ?, weekly_xp = ?,
               week_start = ?, last_log_date = ?, active_mode = ?, display_name = ?,
               updated_at = ? WHERE user_id = ?""",
            (cfg["xp"], cfg["level"], cfg["streak"], cfg["weekly_xp"], week_start,
             today, cfg["active_mode"], username, NOW, user_id),
        )
        summary.append({
            "username": username,
            "business": cfg["business_name"],
            "personal": len(cfg["personal"]),
            "businessExpenses": len(cfg["business"]),
            "income": len(cfg["income"]),
            "challenges": len(cfg["challenges"]),
            "voice": len(cfg["voice"]),
        })
        print(f"✓ {username} → {cfg['business_name']}: "
              f"{len(cfg['personal'])} شخصي · {len(cfg['business'])} مصروف عمل · "
              f"{len(cfg['income'])} إيراد · {len(cfg['challenges'])} تحدي · "
              f"{len(cfg['voice'])} صوت")

    make_friends(conn, user_ids)
    conn.commit()
    conn.close()
    print(f"\n✓ تمت التعبئة — أصدقاء مربوطين: {len(user_ids)} · كلمة المرور للحسابات الجديدة: {DEFAULT_PASSWORD}")
    return {"ok": True, "users": summary, "friendshipsLinked": len(user_ids), "defaultPassword": DEFAULT_PASSWORD}


if __name__ == "__main__":
    main()
