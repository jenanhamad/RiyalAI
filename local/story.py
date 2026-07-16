"""Personal weekly story — shareable AI narrative of the week."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from database import get_connection


def _week_bounds(ref: date | None = None):
    ref = ref or date.today()
    start = ref - timedelta(days=ref.weekday())  # Monday
    end = start + timedelta(days=6)
    return start, end


def _fetch_personal(user_id: str, start: str, end: str):
    conn = get_connection()
    rows = conn.execute(
        """SELECT * FROM expenses
           WHERE user_id = ?
             AND COALESCE(mode, 'personal') = 'personal'
             AND COALESCE(entry_type, 'expense') = 'expense'
             AND date >= ? AND date <= ?
           ORDER BY date ASC""",
        (user_id, start, end),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def build_week_stats(user_id: str) -> dict:
    this_start, this_end = _week_bounds()
    prev_start = this_start - timedelta(days=7)
    prev_end = this_start - timedelta(days=1)

    this_rows = _fetch_personal(user_id, this_start.isoformat(), this_end.isoformat())
    prev_rows = _fetch_personal(user_id, prev_start.isoformat(), prev_end.isoformat())

    this_total = sum(float(r["amount"]) for r in this_rows)
    prev_total = sum(float(r["amount"]) for r in prev_rows)
    delta = this_total - prev_total
    delta_pct = ((delta / prev_total) * 100) if prev_total > 0 else None

    by_cat: dict[str, float] = defaultdict(float)
    by_day: dict[str, float] = defaultdict(float)
    merchants: dict[str, int] = defaultdict(int)
    for r in this_rows:
        by_cat[r.get("category") or "Other"] += float(r["amount"])
        by_day[str(r["date"])[:10]] += float(r["amount"])
        merchants[r.get("merchant") or ""] += 1

    top_cat = max(by_cat.items(), key=lambda x: x[1]) if by_cat else None
    top_merchant = max(merchants.items(), key=lambda x: x[1]) if merchants else None

    day_bars = []
    for i in range(7):
        d = this_start + timedelta(days=i)
        key = d.isoformat()
        day_bars.append({
            "date": key,
            "labelAr": ["ن", "ث", "ر", "خ", "ج", "س", "ح"][i],
            "amount": round(by_day.get(key, 0), 2),
        })

    conn = get_connection()
    user = conn.execute(
        "SELECT streak, weekly_xp, xp, level FROM users WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    conn.close()

    return {
        "weekStart": this_start.isoformat(),
        "weekEnd": this_end.isoformat(),
        "totalSpent": round(this_total, 2),
        "prevWeekSpent": round(prev_total, 2),
        "deltaAmount": round(delta, 2),
        "deltaPercent": round(delta_pct, 1) if delta_pct is not None else None,
        "savedVsLastWeek": round(-delta, 2) if delta < 0 else 0,
        "expenseCount": len(this_rows),
        "topCategory": top_cat[0] if top_cat else None,
        "topCategoryAmount": round(top_cat[1], 2) if top_cat else 0,
        "topMerchant": top_merchant[0] if top_merchant and top_merchant[0] else None,
        "categoryBreakdown": dict(sorted(by_cat.items(), key=lambda x: -x[1])),
        "dayBars": day_bars,
        "streak": int(user["streak"] or 0) if user else 0,
        "weeklyXp": int(user["weekly_xp"] or 0) if user else 0,
        "level": int(user["level"] or 1) if user else 1,
    }


def _fallback_story(stats: dict) -> dict:
    total = stats["totalSpent"]
    top = stats.get("topCategory") or "Other"
    count = stats["expenseCount"]
    delta = stats.get("deltaPercent")
    sentences = []

    if count == 0:
        sentences = [
            "أسبوع هادئ — ما سجّلت مصروفات بعد.",
            "افتح الميكروفون وابدأ قصة أسبوعك من أول مصروف.",
            "كل تسجيل = +XP وخطوة أقرب لهدفك.",
        ]
        mood = "calm"
        title = "أسبوع بانتظارك"
    else:
        sentences.append(f"هذا الأسبوع صرفت {total:.0f} ريال على {count} عمليات.")
        if top:
            pct = (stats["topCategoryAmount"] / total * 100) if total else 0
            sentences.append(f"أكثر شي: {top} — حوالي {pct:.0f}% من إنفاقك.")
        if delta is not None:
            if delta < -5:
                sentences.append(f"وفّرت تقريباً {abs(stats['deltaAmount']):.0f} ريال عن الأسبوع اللي قبل — قوي!")
            elif delta > 5:
                sentences.append(f"زدت عن الأسبوع السابق بـ {stats['deltaAmount']:.0f} ريال — راقب عاداتك.")
            else:
                sentences.append("إنفاقك قريب من الأسبوع السابق — استقرار حلو.")
        if stats.get("streak", 0) >= 3:
            sentences.append(f"سلسلتك {stats['streak']} أيام — استمر!")
        else:
            sentences.append("سجّل غداً عشان تكمل السلسلة وتضاعف XP.")
        mood = "up" if (delta is not None and delta < 0) else "steady"
        title = "قصة أسبوعك"

    return {
        "title": title,
        "sentences": sentences[:5],
        "mood": mood,
        "shareCaption": " · ".join(sentences[:2]) + " — عبر ريالي",
        "source": "fallback",
    }


def summary_text_for_ai(stats: dict) -> str:
    lines = [
        f"أسبوع {stats['weekStart']} إلى {stats['weekEnd']}",
        f"إجمالي: {stats['totalSpent']} ريال ({stats['expenseCount']} عملية)",
        f"الأسبوع السابق: {stats['prevWeekSpent']} ريال",
        f"الفرق: {stats['deltaAmount']} ريال",
        f"أعلى فئة: {stats.get('topCategory')} = {stats.get('topCategoryAmount')} ريال",
        f"سلسلة: {stats.get('streak')} · XP أسبوعي: {stats.get('weeklyXp')}",
        "تفصيل الفئات:",
    ]
    for cat, amt in list(stats.get("categoryBreakdown", {}).items())[:6]:
        lines.append(f"  - {cat}: {amt}")
    return "\n".join(lines)


def get_weekly_story(user_id: str, ai_story: dict | None = None) -> dict:
    stats = build_week_stats(user_id)
    story = ai_story or _fallback_story(stats)
    return {
        "stats": stats,
        "story": story,
        "generatedAt": datetime.utcnow().isoformat(),
    }
