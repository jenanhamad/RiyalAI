"""Business-mode analytics: profit, VAT readiness, health score, spending leaks."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from database import get_connection

BUSINESS_CATEGORIES = {
    "Marketing",
    "Salaries",
    "Inventory",
    "Rent",
    "Tax",
    "Equipment",
    "Commissions",
    "Utilities",
    "Transportation",
    "Other",
}

AR_TO_BUSINESS = {
    "تسويق": "Marketing",
    "إعلانات": "Marketing",
    "رواتب": "Salaries",
    "راتب": "Salaries",
    "مخزون": "Inventory",
    "بضاعة": "Inventory",
    "مواد": "Inventory",
    "إيجار": "Rent",
    "ضريبة": "Tax",
    "زكاة": "Tax",
    "معدات": "Equipment",
    "أجهزة": "Equipment",
    "عمولة": "Commissions",
    "عمولات": "Commissions",
    "فواتير": "Utilities",
    "مواصلات": "Transportation",
    "وقود": "Transportation",
    "أخرى": "Other",
}

VAT_RATE = 0.15
# Categories typically VAT-recoverable for small businesses (estimate only)
VAT_ELIGIBLE = {
    "Marketing", "Inventory", "Rent", "Equipment", "Utilities", "Transportation", "Other",
}


def normalize_business_category(raw: str) -> str:
    if not raw:
        return "Other"
    key = raw.strip()
    if key in AR_TO_BUSINESS:
        return AR_TO_BUSINESS[key]
    for cat in BUSINESS_CATEGORIES:
        if cat.lower() == key.lower():
            return cat
    return "Other"


def _period_start(days: int = 30) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def _fetch_entries(user_id: str, *, since: str | None = None, mode: str = "business"):
    conn = get_connection()
    if since:
        rows = conn.execute(
            """SELECT * FROM expenses
               WHERE user_id = ? AND mode = ? AND date >= ?
               ORDER BY date DESC""",
            (user_id, mode, since),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT * FROM expenses
               WHERE user_id = ? AND mode = ?
               ORDER BY date DESC""",
            (user_id, mode),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def profit_snapshot(user_id: str, days: int = 30) -> dict:
    since = _period_start(days)
    rows = _fetch_entries(user_id, since=since)
    income = sum(r["amount"] for r in rows if (r.get("entry_type") or "expense") == "income")
    expenses = sum(r["amount"] for r in rows if (r.get("entry_type") or "expense") != "income")
    profit = income - expenses
    margin = (profit / income * 100) if income > 0 else 0.0

    today = date.today().isoformat()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    today_income = sum(
        r["amount"] for r in rows
        if (r.get("entry_type") or "expense") == "income" and str(r["date"])[:10] == today
    )
    today_expenses = sum(
        r["amount"] for r in rows
        if (r.get("entry_type") or "expense") != "income" and str(r["date"])[:10] == today
    )
    week_income = sum(
        r["amount"] for r in rows
        if (r.get("entry_type") or "expense") == "income" and str(r["date"])[:10] >= week_start
    )
    week_expenses = sum(
        r["amount"] for r in rows
        if (r.get("entry_type") or "expense") != "income" and str(r["date"])[:10] >= week_start
    )

    by_category: dict[str, float] = defaultdict(float)
    by_project: dict[str, float] = defaultdict(float)
    for r in rows:
        if (r.get("entry_type") or "expense") == "income":
            continue
        by_category[r.get("category") or "Other"] += float(r["amount"])
        tag = (r.get("project_tag") or "").strip()
        if tag:
            by_project[tag] += float(r["amount"])

    return {
        "periodDays": days,
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "profit": round(profit, 2),
        "marginPercent": round(margin, 1),
        "today": {
            "income": round(today_income, 2),
            "expenses": round(today_expenses, 2),
            "profit": round(today_income - today_expenses, 2),
        },
        "week": {
            "income": round(week_income, 2),
            "expenses": round(week_expenses, 2),
            "profit": round(week_income - week_expenses, 2),
        },
        "categoryBreakdown": dict(sorted(by_category.items(), key=lambda x: -x[1])),
        "projectBreakdown": dict(sorted(by_project.items(), key=lambda x: -x[1])),
        "entryCount": len(rows),
    }


def vat_summary(user_id: str, days: int = 90) -> dict:
    """Estimate VAT recoverable — helper only, not a tax filing tool."""
    since = _period_start(days)
    rows = _fetch_entries(user_id, since=since)
    expenses = [r for r in rows if (r.get("entry_type") or "expense") != "income"]
    eligible_total = 0.0
    missing_receipts = []
    for r in expenses:
        cat = r.get("category") or "Other"
        amt = float(r["amount"])
        if cat in VAT_ELIGIBLE:
            eligible_total += amt
        if not r.get("has_receipt"):
            missing_receipts.append({
                "expenseId": r["expense_id"],
                "merchant": r["merchant"],
                "amount": amt,
                "date": r["date"],
                "category": cat,
            })
    vat_estimate = eligible_total * VAT_RATE / (1 + VAT_RATE)  # extract VAT from inclusive totals
    return {
        "periodDays": days,
        "eligibleExpenses": round(eligible_total, 2),
        "vatRecoverableEstimate": round(vat_estimate, 2),
        "vatRate": VAT_RATE,
        "missingReceipts": missing_receipts[:15],
        "missingReceiptCount": len(missing_receipts),
        "disclaimerAr": "تقدير مساعد فقط — مو بديل عن محاسب أو ZATCA",
    }


def health_score(user_id: str) -> dict:
    snap = profit_snapshot(user_id, days=30)
    vat = vat_summary(user_id, days=90)
    score = 50
    tips = []

    if snap["income"] > 0:
        score += 15
    else:
        tips.append("سجّل إيراداتك عشان تعرف ربحك الحقيقي")

    if snap["profit"] > 0:
        score += 20
    elif snap["expenses"] > 0 and snap["income"] == 0:
        score -= 10
        tips.append("عندك مصروفات بدون إيرادات مسجّلة")
    elif snap["profit"] < 0:
        score -= 5
        tips.append("المصروفات أعلى من الإيرادات هذا الشهر")

    if snap["marginPercent"] >= 20:
        score += 10
    elif 0 < snap["marginPercent"] < 10:
        tips.append("هامش الربح منخفض — راجع التكاليف التشغيلية")

    if vat["missingReceiptCount"] == 0 and snap["entryCount"] > 0:
        score += 10
    elif vat["missingReceiptCount"] > 5:
        score -= 10
        tips.append(f"{vat['missingReceiptCount']} مصروفات بدون إيصال — قد تؤثر على الضريبة")

    # Logging consistency
    rows = _fetch_entries(user_id, since=_period_start(7))
    days_logged = len({str(r["date"])[:10] for r in rows})
    if days_logged >= 5:
        score += 10
    elif days_logged == 0:
        tips.append("ابدأ سجّل مصروفات وإيرادات العمل بالصوت")

    score = max(0, min(100, score))
    if score >= 75:
        label = "ممتاز"
    elif score >= 50:
        label = "جيد"
    elif score >= 30:
        label = "يحتاج انتباه"
    else:
        label = "حرج"

    if not tips:
        tips.append("استمر بتسجيل الإيرادات والمصروفات يومياً")

    return {
        "score": score,
        "labelAr": label,
        "tips": tips[:4],
        "daysLoggedThisWeek": days_logged,
    }


def rule_based_leaks(user_id: str) -> list[dict]:
    snap = profit_snapshot(user_id, days=30)
    leaks = []
    total_exp = snap["expenses"] or 1
    for cat, amt in list(snap["categoryBreakdown"].items())[:5]:
        pct = amt / total_exp * 100
        if pct >= 25:
            severity = "high" if pct >= 40 else "medium"
            leaks.append({
                "title": f"تركيز عالي على {cat}",
                "amount": round(amt, 2),
                "suggestion": f"{pct:.0f}% من مصروفاتك على {cat} — راجع إذا فيه توفير ممكن",
                "severity": severity,
                "category": cat,
            })

    # Recurring merchants
    rows = _fetch_entries(user_id, since=_period_start(30))
    merchant_totals: dict[str, float] = defaultdict(float)
    merchant_counts: dict[str, int] = defaultdict(int)
    for r in rows:
        if (r.get("entry_type") or "expense") == "income":
            continue
        m = (r.get("merchant") or "").strip()
        if not m:
            continue
        merchant_totals[m] += float(r["amount"])
        merchant_counts[m] += 1
    for m, count in merchant_counts.items():
        if count >= 4:
            leaks.append({
                "title": f"تكرار: {m}",
                "amount": round(merchant_totals[m], 2),
                "suggestion": f"سجّلت {m} {count} مرات هذا الشهر — هل فيه اشتراك أو هدر؟",
                "severity": "medium" if count < 8 else "high",
                "category": "Other",
            })

    if snap["income"] > 0 and snap["marginPercent"] < 5:
        leaks.append({
            "title": "هامش ربح ضعيف",
            "amount": round(abs(snap["profit"]), 2),
            "suggestion": "الربح أقل من 5% من الإيرادات — راجع الأسعار والتكاليف",
            "severity": "high",
            "category": "Other",
        })

    return leaks[:5]


def build_business_summary_for_ai(user_id: str) -> str:
    snap = profit_snapshot(user_id, days=30)
    lines = [
        f"إيرادات 30 يوم: {snap['income']} ريال",
        f"مصروفات 30 يوم: {snap['expenses']} ريال",
        f"ربح تقريبي: {snap['profit']} ريال (هامش {snap['marginPercent']}%)",
        "تفصيل المصروفات:",
    ]
    for cat, amt in list(snap["categoryBreakdown"].items())[:8]:
        lines.append(f"  - {cat}: {amt} ريال")
    if snap["projectBreakdown"]:
        lines.append("حسب المشروع:")
        for tag, amt in list(snap["projectBreakdown"].items())[:6]:
            lines.append(f"  - {tag}: {amt} ريال")
    return "\n".join(lines)


def get_active_mode(user_id: str) -> str:
    conn = get_connection()
    row = conn.execute(
        "SELECT active_mode FROM users WHERE user_id = ?", (user_id,)
    ).fetchone()
    conn.close()
    if not row:
        return "personal"
    mode = row["active_mode"] if "active_mode" in row.keys() else "personal"
    return mode if mode in ("personal", "business") else "personal"


def set_active_mode(user_id: str, mode: str) -> str:
    if mode not in ("personal", "business"):
        raise ValueError("الوضع يجب أن يكون personal أو business")
    conn = get_connection()
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE users SET active_mode = ?, updated_at = ? WHERE user_id = ?",
        (mode, now, user_id),
    )
    conn.commit()
    conn.close()
    return mode


def dashboard(user_id: str) -> dict:
    return {
        "mode": "business",
        "profit": profit_snapshot(user_id, days=30),
        "vat": vat_summary(user_id, days=90),
        "health": health_score(user_id),
        "leaks": rule_based_leaks(user_id),
    }


def _daily_bars(user_id: str, days: int = 7) -> list[dict]:
    since = _period_start(days - 1)
    rows = _fetch_entries(user_id, since=since)
    labels_ar = ["ن", "ث", "ر", "خ", "ج", "س", "ح"]
    bars = []
    for i in range(days - 1, -1, -1):
        d = date.today() - timedelta(days=i)
        key = d.isoformat()
        income = sum(
            float(r["amount"]) for r in rows
            if str(r["date"])[:10] == key and (r.get("entry_type") or "expense") == "income"
        )
        expenses = sum(
            float(r["amount"]) for r in rows
            if str(r["date"])[:10] == key and (r.get("entry_type") or "expense") != "income"
        )
        bars.append({
            "date": key,
            "labelAr": labels_ar[d.weekday()],
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "profit": round(income - expenses, 2),
        })
    return bars


def _fallback_glance_insight(profit: dict, health: dict) -> dict:
    if profit["income"] == 0 and profit["expenses"] == 0:
        return {
            "headline": "Your business at a glance",
            "headlineAr": "مشروعك بنظرة",
            "insightAr": "ابدأ سجّل إيراد أو مصروف — اللوحة تشتغل لما تدخل أرقام.",
            "focus": "أول تسجيل بالصوت اليوم",
            "tone": "neutral",
            "source": "fallback",
        }
    if profit["profit"] >= 0 and profit["marginPercent"] >= 15:
        tone = "positive"
        insight = f"وضع جيد: ربح تقريبي {profit['profit']:.0f} ريال بهامش {profit['marginPercent']}%."
        focus = "حافظ على تسجيل الإيرادات يومياً"
    elif profit["profit"] < 0:
        tone = "caution"
        insight = f"المصروفات أعلى من الإيرادات بـ {abs(profit['profit']):.0f} ريال هذا الشهر."
        focus = "راجع أعلى فئة مصروف"
    else:
        tone = "neutral"
        insight = f"إيراد {profit['income']:.0f} · مصروف {profit['expenses']:.0f} · صحة {health.get('score', 0)}/100."
        focus = "ارفع هامش الربح فوق 15%"
    return {
        "headline": "Your business at a glance",
        "headlineAr": "مشروعك بنظرة",
        "insightAr": insight,
        "focus": focus,
        "tone": tone,
        "source": "fallback",
    }


def business_glance(user_id: str, ai_insight: dict | None = None) -> dict:
    """Full analytical snapshot for the Business Glance screen."""
    profit = profit_snapshot(user_id, days=30)
    week = profit_snapshot(user_id, days=7)
    vat = vat_summary(user_id, days=90)
    health = health_score(user_id)
    leaks = rule_based_leaks(user_id)[:3]
    day_bars = _daily_bars(user_id, days=7)

    top_categories = [
        {"category": cat, "amount": amt}
        for cat, amt in list(profit["categoryBreakdown"].items())[:5]
    ]
    top_projects = [
        {"tag": tag, "amount": amt}
        for tag, amt in list(profit["projectBreakdown"].items())[:5]
    ]

    insight = ai_insight or _fallback_glance_insight(profit, health)
    if "headline" not in insight:
        insight = {**_fallback_glance_insight(profit, health), **insight}

    return {
        "title": "Your business at a glance",
        "titleAr": "مشروعك بنظرة",
        "profit": profit,
        "week": {
            "income": week["income"],
            "expenses": week["expenses"],
            "profit": week["profit"],
            "marginPercent": week["marginPercent"],
        },
        "health": health,
        "vat": {
            "vatRecoverableEstimate": vat["vatRecoverableEstimate"],
            "missingReceiptCount": vat["missingReceiptCount"],
            "disclaimerAr": vat["disclaimerAr"],
        },
        "dayBars": day_bars,
        "topCategories": top_categories,
        "topProjects": top_projects,
        "leaks": leaks,
        "insight": insight,
        "generatedAt": datetime.utcnow().isoformat(),
    }


def glance_summary_for_ai(user_id: str) -> str:
    profit = profit_snapshot(user_id, days=30)
    week = profit_snapshot(user_id, days=7)
    health = health_score(user_id)
    vat = vat_summary(user_id, days=90)
    lines = [
        f"إيراد 30 يوم: {profit['income']}",
        f"مصروف 30 يوم: {profit['expenses']}",
        f"ربح: {profit['profit']} (هامش {profit['marginPercent']}%)",
        f"أسبوع: إيراد {week['income']} مصروف {week['expenses']}",
        f"صحة: {health['score']}",
        f"VAT تقديري: {vat['vatRecoverableEstimate']}",
        "أعلى فئات:",
    ]
    for cat, amt in list(profit["categoryBreakdown"].items())[:4]:
        lines.append(f"  - {cat}: {amt}")
    return "\n".join(lines)


# Personal-looking spend while in business mode → offer convert
_PERSONAL_HINTS = [
    ("قهوة", "Food & Dining"),
    ("كوفي", "Food & Dining"),
    ("كافيه", "Food & Dining"),
    ("ستاربكس", "Food & Dining"),
    ("starbucks", "Food & Dining"),
    ("dunkin", "Food & Dining"),
    ("دانكن", "Food & Dining"),
    ("غداء", "Food & Dining"),
    ("عشاء", "Food & Dining"),
    ("فطور", "Food & Dining"),
    ("مطعم", "Food & Dining"),
    ("برجر", "Food & Dining"),
    ("بيتزا", "Food & Dining"),
    ("وجبه", "Food & Dining"),
    ("وجبة", "Food & Dining"),
    ("سناك", "Food & Dining"),
    ("نتفلكس", "Entertainment"),
    ("netflix", "Entertainment"),
    ("سينما", "Entertainment"),
    ("ألعاب", "Entertainment"),
    ("شي إن", "Shopping"),
    ("shein", "Shopping"),
    ("نون", "Shopping"),
    ("أمازون", "Shopping"),
    ("صالون", "Healthcare"),
    ("حلاق", "Healthcare"),
    ("صيدلية", "Healthcare"),
    ("Uber Eats", "Food & Dining"),
    ("هنقرستيشن", "Food & Dining"),
    ("مرسول", "Food & Dining"),
    ("جاهز", "Food & Dining"),
]

_BUSINESS_KEEP_HINTS = (
    "مخزون", "بضاعة", "مواد", "إيجار", "راتب", "رواتب", "إعلان", "تسويق",
    "عمولة", "فاتورة عمل", "مورد", "جملة", "مشروع", "عميل", "ضريبة",
)


def detect_personal_suggestion(*, merchant="", note="", transcription="", category="", entry_type="expense") -> dict | None:
    """If a business expense looks personal, return suggestion payload."""
    if entry_type == "income":
        return None
    blob = " ".join(
        str(x or "") for x in (merchant, note, transcription, category)
    ).strip().lower()
    if not blob:
        return None
    for keep in _BUSINESS_KEEP_HINTS:
        if keep.lower() in blob:
            return None
    for hint, personal_cat in _PERSONAL_HINTS:
        if hint.lower() in blob:
            return {
                "suggestPersonal": True,
                "suggestedCategory": personal_cat,
                "matchedHint": hint,
                "promptAr": "يبدو مصروف شخصي (مثل قهوة أو أكل). تبي أحوله لك لمصروف أفراد؟",
            }
    # Business "Other" + food-ish personal categories mistyped
    if str(category) in ("Food & Dining", "Entertainment", "Shopping", "Healthcare", "Groceries"):
        return {
            "suggestPersonal": True,
            "suggestedCategory": category if category != "Groceries" else "Food & Dining",
            "matchedHint": category,
            "promptAr": "يبدو مصروف شخصي. تبي أحوله لك لمصروف أفراد؟",
        }
    return None


def convert_expense_to_personal(expense_id: str, user_id: str, suggested_category: str | None = None) -> dict:
    """Move a business expense into personal mode and award XP."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise ValueError("not_found")
    if row["user_id"] != user_id:
        conn.close()
        raise ValueError("forbidden")
    mode = row["mode"] if "mode" in row.keys() else "personal"
    if mode != "business":
        conn.close()
        raise ValueError("already_personal")
    entry_type = row["entry_type"] if "entry_type" in row.keys() else "expense"
    if entry_type == "income":
        conn.close()
        raise ValueError("income_not_allowed")

    suggestion = detect_personal_suggestion(
        merchant=row["merchant"],
        note=row["description"],
        transcription=row["notes"],
        category=row["category"],
        entry_type=entry_type,
    )
    category = suggested_category or (suggestion or {}).get("suggestedCategory") or "Other"
    # Normalize against personal list
    personal_ok = {
        "Food & Dining", "Transportation", "Shopping", "Entertainment",
        "Utilities", "Healthcare", "Groceries", "Gas", "Other",
    }
    if category not in personal_ok:
        category = "Food & Dining" if suggestion else "Other"

    now = datetime.utcnow().isoformat()
    conn.execute(
        """UPDATE expenses
           SET mode = 'personal', category = ?, project_tag = '', updated_at = ?
           WHERE expense_id = ?""",
        (category, now, expense_id),
    )
    conn.commit()
    updated = conn.execute(
        "SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)
    ).fetchone()
    conn.close()

    import gamification as gam
    gamification_result = gam.award_xp_for_expense(
        user_id, updated["date"], voice_bonus=False
    )
    gam.check_and_complete_challenges(user_id)

    return {
        "message": "تم التحويل لمصروف شخصي",
        "messageAr": f"تم تحويله لمصروف أفراد — +{gamification_result.get('xpEarned', 0)} XP",
        "expense": {
            "expenseId": updated["expense_id"],
            "mode": "personal",
            "category": updated["category"],
            "merchant": updated["merchant"],
            "amount": updated["amount"],
        },
        "gamification": gamification_result,
    }
