"""Gamification logic backed by SQLite (local dev)."""
from datetime import datetime, timedelta, date
import uuid

from database import get_connection

XP_PER_EXPENSE = 20
XP_PER_LEVEL = 500
MAX_LEVEL = 20
STREAK_MULTIPLIER_DAYS = 7


def _week_start(d=None):
    d = d or date.today()
    return (d - timedelta(days=d.weekday())).isoformat()


def _level_from_xp(xp):
    return min(MAX_LEVEL, (int(xp) // XP_PER_LEVEL) + 1)


def _xp_progress(xp):
    return int(xp) % XP_PER_LEVEL


def _row_to_dict(row):
    return dict(row) if row else None


def get_or_create_profile(user_id, email=None):
    conn = get_connection()
    row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    now = datetime.utcnow().isoformat()
    if row:
        profile = _row_to_dict(row)
        _maybe_reset_weekly_xp(conn, profile, user_id)
        conn.close()
        return profile

    conn.execute(
        """INSERT INTO users (user_id, email, password_hash, xp, level, streak,
           weekly_xp, week_start, created_at, updated_at)
           VALUES (?, ?, '', 0, 1, 0, 0, ?, ?, ?)""",
        (user_id, email or f"{user_id}@local", _week_start(), now, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


def _maybe_reset_weekly_xp(conn, profile, user_id):
    current_week = _week_start()
    if profile.get("week_start") != current_week:
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE users SET weekly_xp = 0, week_start = ?, updated_at = ? WHERE user_id = ?",
            (current_week, now, user_id),
        )
        conn.commit()
        profile["weekly_xp"] = 0
        profile["week_start"] = current_week


def award_xp_for_expense(user_id, expense_date=None):
    profile = get_or_create_profile(user_id)
    conn = get_connection()
    today = date.fromisoformat(str(expense_date)[:10]) if expense_date else date.today()
    today_str = today.isoformat()
    yesterday = (today - timedelta(days=1)).isoformat()
    last_log = profile.get("last_log_date")
    streak = int(profile.get("streak") or 0)

    if last_log == today_str:
        pass
    elif last_log == yesterday:
        streak += 1
    else:
        streak = 1

    multiplier = 2 if streak >= STREAK_MULTIPLIER_DAYS else 1
    xp_earned = XP_PER_EXPENSE * multiplier
    old_xp = int(profile.get("xp") or 0)
    new_xp = old_xp + xp_earned
    old_level = _level_from_xp(old_xp)
    new_level = _level_from_xp(new_xp)
    weekly_xp = int(profile.get("weekly_xp") or 0) + xp_earned
    now = datetime.utcnow().isoformat()

    conn.execute(
        """UPDATE users SET xp = ?, level = ?, streak = ?, last_log_date = ?,
           weekly_xp = ?, updated_at = ? WHERE user_id = ?""",
        (new_xp, new_level, streak, today_str, weekly_xp, now, user_id),
    )
    conn.commit()
    conn.close()

    return {
        "xpEarned": xp_earned,
        "xp": new_xp,
        "level": new_level,
        "xpProgress": _xp_progress(new_xp),
        "xpToNextLevel": XP_PER_LEVEL,
        "streak": streak,
        "leveledUp": new_level > old_level,
        "multiplier": multiplier,
        "multiplierActive": multiplier > 1,
    }


def _arabic_day(weekday):
    names = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
    return names[weekday]


def _expense_dates_last_n_days(user_id, n):
    cutoff = (date.today() - timedelta(days=n)).isoformat()
    conn = get_connection()
    rows = conn.execute(
        "SELECT DISTINCT date FROM expenses WHERE user_id = ? AND date >= ?",
        (user_id, cutoff),
    ).fetchall()
    conn.close()
    return {r["date"][:10] for r in rows}


def build_streak_week_display(user_id):
    today = date.today()
    logged_dates = _expense_dates_last_n_days(user_id, 14)
    days = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        if d_str in logged_dates:
            state = "done"
        elif d == today:
            state = "today"
        else:
            state = "missed"
        days.append({
            "date": d_str,
            "dayLabel": d.strftime("%a"),
            "dayLabelAr": _arabic_day(d.weekday()),
            "state": state,
        })
    return days


def profile_response(user_id):
    profile = get_or_create_profile(user_id)
    xp = int(profile.get("xp") or 0)
    return {
        "userId": user_id,
        "xp": xp,
        "level": int(profile.get("level") or _level_from_xp(xp)),
        "xpProgress": _xp_progress(xp),
        "xpToNextLevel": XP_PER_LEVEL,
        "maxLevel": MAX_LEVEL,
        "streak": int(profile.get("streak") or 0),
        "lastLogDate": profile.get("last_log_date"),
        "weeklyXp": int(profile.get("weekly_xp") or 0),
        "streakWeek": build_streak_week_display(user_id),
        "streakMultiplierActive": int(profile.get("streak") or 0) >= STREAK_MULTIPLIER_DAYS,
    }


def _category_spend(user_id, category, since_date):
    conn = get_connection()
    row = conn.execute(
        """SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
           WHERE user_id = ? AND category = ? AND date >= ?""",
        (user_id, category, since_date),
    ).fetchone()
    conn.close()
    return float(row["total"])


def _enrich_challenge(ch, user_id):
    category = ch["category"]
    baseline = float(ch.get("baseline_amount") or 0)
    target_pct = float(ch.get("target_reduction_percent") or 20)
    current = _category_spend(user_id, category, _week_start())
    target_amount = baseline * (1 - target_pct / 100) if baseline > 0 else 0
    if baseline > 0:
        progress = 100 if current <= target_amount else max(
            0, min(100, int(100 * (1 - (current - target_amount) / baseline)))
        )
    else:
        progress = 0
    out = {
        "challengeId": ch["challenge_id"],
        "userId": ch["user_id"],
        "title": ch["title"],
        "description": ch["description"],
        "category": category,
        "targetReductionPercent": target_pct,
        "baselineAmount": baseline,
        "xpReward": ch["xp_reward"],
        "status": ch["status"],
        "createdAt": ch["created_at"],
        "expiresAt": ch["expires_at"],
        "currentSpend": current,
        "targetAmount": target_amount,
        "progressPercent": progress,
    }
    if progress >= 100 and out["status"] == "active":
        out["status"] = "completed"
    return out


def list_challenges(user_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM challenges WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    now = datetime.utcnow()
    result = []
    for row in rows:
        ch = _enrich_challenge(_row_to_dict(row), user_id)
        if ch["status"] == "active" and ch.get("expiresAt"):
            try:
                if datetime.fromisoformat(ch["expiresAt"].replace("Z", "")) < now:
                    ch["status"] = "failed"
            except ValueError:
                pass
        result.append(ch)
    return result


def create_challenges_for_user(user_id, challenges_data):
    conn = get_connection()
    created = []
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
    now = datetime.utcnow().isoformat()
    for ch in challenges_data:
        category = ch.get("category", "Other")
        baseline = _category_spend(user_id, category, (date.today() - timedelta(days=30)).isoformat())
        cid = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO challenges (challenge_id, user_id, title, description, category,
               target_reduction_percent, baseline_amount, xp_reward, status, created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)""",
            (
                cid, user_id, ch.get("title", ""), ch.get("description", ""),
                category, ch.get("target_reduction_percent", 20), baseline,
                int(ch.get("xp_reward", 150)), now, expires,
            ),
        )
        created.append({
            "challengeId": cid,
            "userId": user_id,
            "title": ch.get("title"),
            "description": ch.get("description"),
            "category": category,
            "xpReward": int(ch.get("xp_reward", 150)),
            "status": "active",
        })
    conn.commit()
    conn.close()
    return created


def complete_challenge(challenge_id, user_id):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM challenges WHERE challenge_id = ?", (challenge_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None, "not_found"
    ch = _row_to_dict(row)
    if ch["user_id"] != user_id:
        conn.close()
        return None, "forbidden"
    if ch["status"] == "completed":
        conn.close()
        return {"xpAwarded": 0, "alreadyClaimed": True}, "ok"
    enriched = _enrich_challenge(ch, user_id)
    if enriched["progressPercent"] < 100:
        conn.close()
        return enriched, "not_completed"

    reward = int(ch["xp_reward"])
    profile = get_or_create_profile(user_id)
    new_xp = int(profile.get("xp") or 0) + reward
    new_level = _level_from_xp(new_xp)
    weekly_xp = int(profile.get("weekly_xp") or 0) + reward
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE users SET xp = ?, level = ?, weekly_xp = ?, updated_at = ? WHERE user_id = ?",
        (new_xp, new_level, weekly_xp, now, user_id),
    )
    conn.execute(
        "UPDATE challenges SET status = 'completed' WHERE challenge_id = ?",
        (challenge_id,),
    )
    conn.commit()
    conn.close()
    return {"xpAwarded": reward, "xp": new_xp, "level": new_level}, "ok"


def check_and_complete_challenges(user_id):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM challenges WHERE user_id = ? AND status = 'active'",
        (user_id,),
    ).fetchall()
    conn.close()
    for row in rows:
        enriched = _enrich_challenge(_row_to_dict(row), user_id)
        if enriched["progressPercent"] >= 100:
            try:
                complete_challenge(row["challenge_id"], user_id)
            except Exception:
                pass


def get_leaderboard(user_id, limit=20):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM users").fetchall()
    conn.close()
    current_week = _week_start()
    rankings = []
    for row in rows:
        u = _row_to_dict(row)
        weekly = int(u.get("weekly_xp") or 0) if u.get("week_start") == current_week else 0
        rankings.append({
            "userId": u["user_id"],
            "displayName": u.get("display_name") or u.get("email", "مستخدم")[:20],
            "weeklyXp": weekly,
            "level": int(u.get("level") or 1),
            "xp": int(u.get("xp") or 0),
        })
    rankings.sort(key=lambda x: x["weeklyXp"], reverse=True)
    top = rankings[:limit]
    current_rank = next((i + 1 for i, r in enumerate(rankings) if r["userId"] == user_id), None)
    current_user = next((r for r in rankings if r["userId"] == user_id), None)
    if current_user:
        current_user = {**current_user, "rank": current_rank}
    return {
        "rankings": [{**r, "rank": i + 1} for i, r in enumerate(top)],
        "currentUser": current_user,
        "weekStart": current_week,
        "resetsAt": "Monday 00:00",
    }


def build_expense_summary_for_ai(user_id):
    cutoff = (date.today() - timedelta(days=30)).isoformat()
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM expenses WHERE user_id = ? AND date >= ?",
        (user_id, cutoff),
    ).fetchall()
    conn.close()
    if not rows:
        return "لا توجد مصروفات في آخر 30 يوم."
    total = sum(float(r["amount"]) for r in rows)
    by_cat = {}
    for r in rows:
        cat = r["category"]
        by_cat[cat] = by_cat.get(cat, 0) + float(r["amount"])
    lines = [f"إجمالي المصروفات (30 يوم): {total:.2f} ريال", f"عدد العمليات: {len(rows)}"]
    for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1]):
        pct = (amt / total * 100) if total else 0
        lines.append(f"- {cat}: {amt:.2f} ريال ({pct:.0f}%)")
    return "\n".join(lines)
