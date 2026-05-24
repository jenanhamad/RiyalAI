"""Friends, invite links, and shared challenges."""
import uuid
from datetime import date, datetime, timedelta

from database import get_connection
import gamification as gam


def _row(row):
    return dict(row) if row else None


def _public_user(row):
    if not row:
        return None
    u = _row(row)
    return {
        "userId": u["user_id"],
        "username": u.get("username") or u.get("display_name"),
        "displayName": u.get("display_name") or u.get("username") or "مستخدم",
        "level": int(u.get("level") or 1),
        "xp": int(u.get("xp") or 0),
    }


def lookup_username(username: str):
    conn = get_connection()
    row = conn.execute(
        """SELECT user_id, username, display_name, level, xp FROM users
           WHERE lower(username) = lower(?) OR lower(display_name) = lower(?)""",
        (username.strip(), username.strip()),
    ).fetchone()
    conn.close()
    return _public_user(row)


def find_user_id_by_username(username: str):
    conn = get_connection()
    row = conn.execute(
        """SELECT user_id FROM users
           WHERE lower(username) = lower(?) OR lower(display_name) = lower(?)""",
        (username.strip(), username.strip()),
    ).fetchone()
    conn.close()
    return row["user_id"] if row else None


def list_friend_ids(user_id: str) -> list[str]:
    conn = get_connection()
    rows = conn.execute(
        "SELECT friend_id FROM friendships WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    conn.close()
    return [r["friend_id"] for r in rows]


def list_friends(user_id: str):
    conn = get_connection()
    rows = conn.execute(
        """SELECT u.user_id, u.username, u.display_name, u.level, u.xp, u.weekly_xp, u.week_start
           FROM friendships f
           JOIN users u ON u.user_id = f.friend_id
           WHERE f.user_id = ?
           ORDER BY u.display_name, u.username""",
        (user_id,),
    ).fetchall()
    conn.close()
    current_week = gam._week_start()
    friends = []
    for row in rows:
        u = _row(row)
        weekly = int(u.get("weekly_xp") or 0) if u.get("week_start") == current_week else 0
        friends.append({
            "userId": u["user_id"],
            "username": u.get("username") or u.get("display_name"),
            "displayName": u.get("display_name") or u.get("username") or "مستخدم",
            "level": int(u.get("level") or 1),
            "xp": int(u.get("xp") or 0),
            "weeklyXp": weekly,
        })
    return friends


def add_friend(user_id: str, username: str) -> dict:
    friend_id = find_user_id_by_username(username)
    if not friend_id:
        raise ValueError("اسم المستخدم غير موجود")
    if friend_id == user_id:
        raise ValueError("ما تقدر تضيف نفسك")

    conn = get_connection()
    existing = conn.execute(
        "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?",
        (user_id, friend_id),
    ).fetchone()
    if existing:
        conn.close()
        raise ValueError("هذا الصديق مضاف مسبقاً")

    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
        (user_id, friend_id, now),
    )
    conn.execute(
        "INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
        (friend_id, user_id, now),
    )
    conn.commit()
    row = conn.execute(
        "SELECT user_id, username, display_name, level, xp FROM users WHERE user_id = ?",
        (friend_id,),
    ).fetchone()
    conn.close()
    return _public_user(row)


def remove_friend(user_id: str, friend_id: str):
    conn = get_connection()
    conn.execute(
        "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?",
        (user_id, friend_id),
    )
    conn.execute(
        "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?",
        (friend_id, user_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


def get_friends_leaderboard(user_id: str):
    friends = list_friends(user_id)
    conn = get_connection()
    me_row = conn.execute(
        "SELECT user_id, username, display_name, level, xp, weekly_xp, week_start FROM users WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()

    current_week = gam._week_start()
    me = _row(me_row)
    entries = [{
        "userId": me["user_id"],
        "username": me.get("username") or me.get("display_name"),
        "displayName": me.get("display_name") or me.get("username") or "أنت",
        "weeklyXp": int(me.get("weekly_xp") or 0) if me.get("week_start") == current_week else 0,
        "level": int(me.get("level") or 1),
        "isMe": True,
    }]
    for f in friends:
        entries.append({**f, "isMe": False})

    entries.sort(key=lambda x: x["weeklyXp"], reverse=True)
    rankings = [{**e, "rank": i + 1} for i, e in enumerate(entries)]
    current = next((r for r in rankings if r["isMe"]), None)
    return {
        "rankings": rankings,
        "currentUser": current,
        "weekStart": current_week,
        "resetsAt": "Monday 00:00",
    }


def share_challenge_with_friends(challenge_id: str, user_id: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM challenges WHERE challenge_id = ? AND user_id = ?",
        (challenge_id, user_id),
    ).fetchone()
    if not row:
        conn.close()
        raise ValueError("Challenge not found")

    ch = _row(row)
    group_id = ch.get("group_id") or str(uuid.uuid4())
    if not ch.get("group_id"):
        conn.execute(
            "UPDATE challenges SET group_id = ? WHERE challenge_id = ?",
            (group_id, challenge_id),
        )

    friend_ids = list_friend_ids(user_id)
    if not friend_ids:
        conn.close()
        raise ValueError("أضف أصدقاء أولاً")

    now = datetime.utcnow().isoformat()
    added = []
    for fid in friend_ids:
        exists = conn.execute(
            "SELECT 1 FROM challenges WHERE user_id = ? AND group_id = ?",
            (fid, group_id),
        ).fetchone()
        if exists:
            continue
        baseline = gam._category_spend(
            fid, ch["category"], (date.today() - timedelta(days=30)).isoformat()
        )
        cid = str(uuid.uuid4())
        conn.execute(
            """INSERT INTO challenges (challenge_id, user_id, title, description, category,
               target_reduction_percent, baseline_amount, xp_reward, status, group_id,
               created_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
            (
                cid, fid, ch["title"], ch["description"], ch["category"],
                ch["target_reduction_percent"], baseline, ch["xp_reward"],
                group_id, now, ch["expires_at"],
            ),
        )
        added.append(fid)

    conn.commit()
    conn.close()
    return {"groupId": group_id, "sharedWith": len(added), "alreadyInGroup": len(friend_ids) - len(added)}


def list_shared_challenges(user_id: str):
    conn = get_connection()
    groups = conn.execute(
        """SELECT DISTINCT group_id FROM challenges
           WHERE user_id = ? AND group_id IS NOT NULL AND group_id != ''""",
        (user_id,),
    ).fetchall()
    result = []
    for g in groups:
        group_id = g["group_id"]
        member_rows = conn.execute(
            """SELECT c.*, u.username, u.display_name
               FROM challenges c
               JOIN users u ON u.user_id = c.user_id
               WHERE c.group_id = ?
               ORDER BY c.created_at""",
            (group_id,),
        ).fetchall()
        if not member_rows:
            continue
        first = _row(member_rows[0])
        members = []
        for mr in member_rows:
            ch = gam._enrich_challenge(_row(mr), mr["user_id"])
            members.append({
                "userId": mr["user_id"],
                "username": mr["username"] or mr["display_name"],
                "displayName": mr["display_name"] or mr["username"] or "مستخدم",
                "challengeId": ch["challengeId"],
                "progressPercent": ch["progressPercent"],
                "currentSpend": ch["currentSpend"],
                "status": ch["status"],
                "isMe": mr["user_id"] == user_id,
            })
        members.sort(key=lambda m: m["progressPercent"], reverse=True)
        result.append({
            "groupId": group_id,
            "title": first["title"],
            "description": first["description"],
            "category": first["category"],
            "xpReward": first["xp_reward"],
            "expiresAt": first["expires_at"],
            "memberCount": len(members),
            "members": members,
        })
    conn.close()
    result.sort(key=lambda x: x["expiresAt"], reverse=True)
    return result


def join_shared_group(group_id: str, user_id: str):
    conn = get_connection()
    template = conn.execute(
        "SELECT * FROM challenges WHERE group_id = ? LIMIT 1",
        (group_id,),
    ).fetchone()
    if not template:
        conn.close()
        raise ValueError("التحدي المشترك غير موجود")

    t = _row(template)
    exists = conn.execute(
        "SELECT 1 FROM challenges WHERE user_id = ? AND group_id = ?",
        (user_id, group_id),
    ).fetchone()
    if exists:
        conn.close()
        return {"groupId": group_id, "joined": False, "message": "already joined"}

    baseline = gam._category_spend(
        user_id, t["category"], (date.today() - timedelta(days=30)).isoformat()
    )
    now = datetime.utcnow().isoformat()
    cid = str(uuid.uuid4())
    conn.execute(
        """INSERT INTO challenges (challenge_id, user_id, title, description, category,
           target_reduction_percent, baseline_amount, xp_reward, status, group_id,
           created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)""",
        (
            cid, user_id, t["title"], t["description"], t["category"],
            t["target_reduction_percent"], baseline, t["xp_reward"],
            group_id, now, t["expires_at"],
        ),
    )
    conn.commit()
    conn.close()
    return {"groupId": group_id, "joined": True, "challengeId": cid}
