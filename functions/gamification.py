"""XP, leveling, streaks, challenges, and leaderboard logic."""
from datetime import datetime, timedelta, date
from decimal import Decimal
import os
import uuid
import json

import boto3
from boto3.dynamodb.conditions import Attr, Key

XP_PER_EXPENSE = 20
XP_PER_LEVEL = 500
MAX_LEVEL = 20
STREAK_MULTIPLIER_DAYS = 7

dynamodb = boto3.resource("dynamodb")
USERS_TABLE = os.environ.get("USERS_TABLE_NAME", "")
CHALLENGES_TABLE = os.environ.get("CHALLENGES_TABLE_NAME", "")
EXPENSES_TABLE = os.environ.get("TABLE_NAME", "")

users_table = dynamodb.Table(USERS_TABLE) if USERS_TABLE else None
challenges_table = dynamodb.Table(CHALLENGES_TABLE) if CHALLENGES_TABLE else None
expenses_table = dynamodb.Table(EXPENSES_TABLE) if EXPENSES_TABLE else None


def _today():
    return date.today().isoformat()


def _parse_date(d):
    if not d:
        return None
    if isinstance(d, date):
        return d
    return date.fromisoformat(str(d)[:10])


def _week_start(d=None):
    """Monday of the week containing d (ISO)."""
    d = d or date.today()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def _level_from_xp(xp):
    return min(MAX_LEVEL, (int(xp) // XP_PER_LEVEL) + 1)


def _xp_progress(xp):
    return int(xp) % XP_PER_LEVEL


def get_or_create_profile(user_id, email=None):
    if not users_table:
        raise RuntimeError("Users table not configured")
    resp = users_table.get_item(Key={"userId": user_id})
    if "Item" in resp:
        profile = resp["Item"]
        _maybe_reset_weekly_xp(profile, user_id)
        return profile

    now = datetime.utcnow().isoformat()
    profile = {
        "userId": user_id,
        "xp": 0,
        "level": 1,
        "streak": 0,
        "lastLogDate": None,
        "weeklyXp": 0,
        "weekStart": _week_start(),
        "email": email or "",
        "displayName": "",
        "createdAt": now,
        "updatedAt": now,
    }
    users_table.put_item(Item=profile)
    return profile


def _maybe_reset_weekly_xp(profile, user_id):
    """Reset weekly XP every Monday 00:00 (week boundary)."""
    current_week = _week_start()
    if profile.get("weekStart") != current_week:
        users_table.update_item(
            Key={"userId": user_id},
            UpdateExpression="SET weeklyXp = :zero, weekStart = :ws, updatedAt = :now",
            ExpressionAttributeValues={
                ":zero": 0,
                ":ws": current_week,
                ":now": datetime.utcnow().isoformat(),
            },
        )
        profile["weeklyXp"] = 0
        profile["weekStart"] = current_week
    return profile


def award_xp_for_expense(user_id, expense_date=None):
    """
    Award XP on expense log, update streak, apply 7-day multiplier.
    Returns dict with xpEarned, level, xp, streak, leveledUp, multiplier.
    """
    profile = get_or_create_profile(user_id)
    today = _parse_date(expense_date) or date.today()
    today_str = today.isoformat()
    yesterday = (today - timedelta(days=1)).isoformat()
    last_log = profile.get("lastLogDate")
    streak = int(profile.get("streak", 0))

    if last_log == today_str:
        pass  # same day, streak unchanged
    elif last_log == yesterday:
        streak += 1
    else:
        streak = 1

    multiplier = 2 if streak >= STREAK_MULTIPLIER_DAYS else 1
    xp_earned = XP_PER_EXPENSE * multiplier

    old_xp = int(profile.get("xp", 0))
    new_xp = old_xp + xp_earned
    old_level = _level_from_xp(old_xp)
    new_level = _level_from_xp(new_xp)
    weekly_xp = int(profile.get("weeklyXp", 0)) + xp_earned

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression=(
            "SET xp = :xp, #lvl = :lvl, streak = :streak, lastLogDate = :ld, "
            "weeklyXp = :wxp, updatedAt = :now"
        ),
        ExpressionAttributeNames={"#lvl": "level"},
        ExpressionAttributeValues={
            ":xp": new_xp,
            ":lvl": new_level,
            ":streak": streak,
            ":ld": today_str,
            ":wxp": weekly_xp,
            ":now": datetime.utcnow().isoformat(),
        },
    )

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


def profile_response(user_id):
    profile = get_or_create_profile(user_id)
    xp = int(profile.get("xp", 0))
    streak_week = build_streak_week_display(user_id)
    return {
        "userId": user_id,
        "xp": xp,
        "level": int(profile.get("level", _level_from_xp(xp))),
        "xpProgress": _xp_progress(xp),
        "xpToNextLevel": XP_PER_LEVEL,
        "maxLevel": MAX_LEVEL,
        "streak": int(profile.get("streak", 0)),
        "lastLogDate": profile.get("lastLogDate"),
        "weeklyXp": int(profile.get("weeklyXp", 0)),
        "streakWeek": streak_week,
        "streakMultiplierActive": int(profile.get("streak", 0)) >= STREAK_MULTIPLIER_DAYS,
    }


def build_streak_week_display(user_id):
    """7-day row: done / today / upcoming."""
    today = date.today()
    days = []
    logged_dates = _expense_dates_last_n_days(user_id, 14)

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        if d > today:
            state = "upcoming"
        elif d_str in logged_dates:
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


def _arabic_day(weekday):
    names = ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"]
    return names[weekday]


def _expense_dates_last_n_days(user_id, n):
    if not expenses_table:
        return set()
    cutoff = (date.today() - timedelta(days=n)).isoformat()
    dates = set()
    resp = expenses_table.scan(FilterExpression=Attr("userId").eq(user_id))
    for item in resp.get("Items", []):
        d = item.get("date", "")
        if d and d >= cutoff:
            dates.add(d[:10])
    return dates


def list_challenges(user_id):
    if not challenges_table:
        return []
    try:
        resp = challenges_table.query(
            IndexName="UserIdIndex",
            KeyConditionExpression=Key("userId").eq(user_id),
        )
        items = resp.get("Items", [])
    except Exception:
        resp = challenges_table.scan(FilterExpression=Attr("userId").eq(user_id))
        items = resp.get("Items", [])

    now = datetime.utcnow()
    result = []
    for ch in items:
        ch = _enrich_challenge_progress(ch, user_id)
        expires = ch.get("expiresAt", "")
        if ch.get("status") == "active" and expires:
            try:
                if datetime.fromisoformat(expires.replace("Z", "")) < now:
                    ch["status"] = "failed"
            except ValueError:
                pass
        result.append(ch)
    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


def _enrich_challenge_progress(challenge, user_id):
    category = challenge.get("category", "Other")
    baseline = float(challenge.get("baselineAmount", 0))
    target_pct = float(challenge.get("targetReductionPercent", 20))
    current = _category_spend_current_week(user_id, category)
    target_amount = baseline * (1 - target_pct / 100) if baseline > 0 else 0

    if baseline > 0:
        if current <= target_amount:
            progress = 100
        else:
            progress = max(0, min(100, int(100 * (1 - (current - target_amount) / baseline))))
    else:
        progress = 0

    out = dict(challenge)
    out["currentSpend"] = current
    out["targetAmount"] = target_amount
    out["progressPercent"] = progress
    if progress >= 100 and out.get("status") == "active":
        out["status"] = "completed"
    return out


def _category_spend_current_week(user_id, category):
    if not expenses_table:
        return 0
    week_start = _week_start()
    total = 0
    resp = expenses_table.scan(
        FilterExpression=Attr("userId").eq(user_id) & Attr("category").eq(category)
    )
    for item in resp.get("Items", []):
        d = item.get("date", "")[:10]
        if d >= week_start:
            total += float(item.get("amount", 0))
    return total


def create_challenges_for_user(user_id, challenges_data):
    if not challenges_table:
        raise RuntimeError("Challenges table not configured")
    created = []
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
    now = datetime.utcnow().isoformat()

    for ch in challenges_data:
        category = ch.get("category", "Other")
        baseline = _category_spend_last_30_days(user_id, category)
        item = {
            "challengeId": str(uuid.uuid4()),
            "userId": user_id,
            "title": ch.get("title", ""),
            "description": ch.get("description", ""),
            "category": category,
            "targetReductionPercent": Decimal(str(ch.get("target_reduction_percent", 20))),
            "baselineAmount": Decimal(str(baseline)),
            "xpReward": int(ch.get("xp_reward", 150)),
            "status": "active",
            "createdAt": now,
            "expiresAt": expires,
        }
        challenges_table.put_item(Item=item)
        created.append(item)
    return created


def _category_spend_last_30_days(user_id, category):
    if not expenses_table:
        return 0
    cutoff = (date.today() - timedelta(days=30)).isoformat()
    total = 0
    resp = expenses_table.scan(
        FilterExpression=Attr("userId").eq(user_id) & Attr("category").eq(category)
    )
    for item in resp.get("Items", []):
        d = item.get("date", "")[:10]
        if d >= cutoff:
            total += float(item.get("amount", 0))
    return total


def complete_challenge(challenge_id, user_id):
    resp = challenges_table.get_item(Key={"challengeId": challenge_id})
    if "Item" not in resp:
        return None, "not_found"
    ch = resp["Item"]
    if ch.get("userId") != user_id:
        return None, "forbidden"
    if ch.get("status") == "completed":
        return {"xpAwarded": 0, "alreadyClaimed": True}, "ok"
    ch = _enrich_challenge_progress(ch, user_id)
    if ch.get("progressPercent", 0) < 100:
        return ch, "not_completed"

    reward = int(ch.get("xpReward", 150))
    profile = get_or_create_profile(user_id)
    new_xp = int(profile.get("xp", 0)) + reward
    new_level = _level_from_xp(new_xp)
    weekly_xp = int(profile.get("weeklyXp", 0)) + reward

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET xp = :xp, #lvl = :lvl, weeklyXp = :wxp, updatedAt = :now",
        ExpressionAttributeNames={"#lvl": "level"},
        ExpressionAttributeValues={
            ":xp": new_xp,
            ":lvl": new_level,
            ":wxp": weekly_xp,
            ":now": datetime.utcnow().isoformat(),
        },
    )
    challenges_table.update_item(
        Key={"challengeId": challenge_id},
        UpdateExpression="SET #s = :status",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":status": "completed"},
    )
    return {"xpAwarded": reward, "xp": new_xp, "level": new_level}, "ok"


def get_leaderboard(user_id, limit=20):
    if not users_table:
        return {"rankings": [], "currentUser": None}
    resp = users_table.scan()
    users = resp.get("Items", [])
    current_week = _week_start()

    rankings = []
    for u in users:
        if u.get("weekStart") != current_week:
            weekly = 0
        else:
            weekly = int(u.get("weeklyXp", 0))
        rankings.append({
            "userId": u["userId"],
            "displayName": u.get("displayName") or u.get("email", "مستخدم")[:20] or "مستخدم",
            "weeklyXp": weekly,
            "level": int(u.get("level", 1)),
            "xp": int(u.get("xp", 0)),
        })

    rankings.sort(key=lambda x: x["weeklyXp"], reverse=True)
    top = rankings[:limit]

    current_rank = None
    for i, r in enumerate(rankings):
        if r["userId"] == user_id:
            current_rank = i + 1
            break

    current_user = next((r for r in rankings if r["userId"] == user_id), None)
    if current_user:
        current_user = {**current_user, "rank": current_rank}

    return {
        "rankings": [{**r, "rank": i + 1} for i, r in enumerate(top)],
        "currentUser": current_user,
        "weekStart": current_week,
        "resetsAt": "Monday 00:00",
    }


def check_and_complete_challenges(user_id):
    """Auto-award XP when challenge spending target is met."""
    if not challenges_table:
        return
    resp = challenges_table.query(
        IndexName="UserIdIndex",
        KeyConditionExpression=Key("userId").eq(user_id),
    ) if challenges_table else {"Items": []}
    for ch in resp.get("Items", []):
        if ch.get("status") != "active":
            continue
        enriched = _enrich_challenge_progress(ch, user_id)
        if enriched.get("progressPercent", 0) >= 100:
            try:
                complete_challenge(ch["challengeId"], user_id)
            except Exception:
                pass


def build_expense_summary_for_ai(user_id):
    if not expenses_table:
        return "لا توجد مصروفات."
    cutoff = (date.today() - timedelta(days=30)).isoformat()
    resp = expenses_table.scan(FilterExpression=Attr("userId").eq(user_id))
    expenses = [e for e in resp.get("Items", []) if (e.get("date", "")[:10] >= cutoff)]

    if not expenses:
        return "لا توجد مصروفات في آخر 30 يوم."

    total = sum(float(e.get("amount", 0)) for e in expenses)
    by_cat = {}
    for e in expenses:
        cat = e.get("category", "Other")
        by_cat[cat] = by_cat.get(cat, 0) + float(e.get("amount", 0))

    lines = [f"إجمالي المصروفات (30 يوم): {total:.2f} ريال", f"عدد العمليات: {len(expenses)}"]
    for cat, amt in sorted(by_cat.items(), key=lambda x: -x[1]):
        pct = (amt / total * 100) if total else 0
        lines.append(f"- {cat}: {amt:.2f} ريال ({pct:.0f}%)")
    return "\n".join(lines)
