"""
ريالي (ryialAI) local API server — run without AWS.

  cd local && pip install -r requirements.txt
  cp .env.example .env   # add OPENROUTER_API_KEY
  uvicorn main:app --reload --port 8000
"""
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
import asyncio
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env")

from database import init_db, get_connection
import gamification as gam
import auth
import voice_service as voice
import seed_sample_data as seed_demo
import friends as social

import openrouter as orouter

_DATA_ROOT = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent.parent / "data")))
UPLOAD_DIR = _DATA_ROOT / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR = Path(__file__).parent.parent / "frontend" / "build"
SERVE_FRONTEND = os.environ.get("SERVE_FRONTEND", "1") == "1" and STATIC_DIR.is_dir()
BASE_URL = os.environ.get("PUBLIC_URL", os.environ.get("LOCAL_API_URL", "http://localhost:8000"))
PORT = int(os.environ.get("PORT", "8000"))

app = FastAPI(title="ريالي ryialAI API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


@app.get("/")
def root():
    if SERVE_FRONTEND:
        return FileResponse(STATIC_DIR / "index.html")
    return {
        "service": "ريالي ryialAI API",
        "status": "ok",
        "health": "/expenses/health",
        "docs": "/docs",
    }


def get_user_id(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "يلزم تسجيل الدخول")
    payload = auth.decode_token(authorization.replace("Bearer ", ""))
    if not payload:
        raise HTTPException(401, "انتهت الجلسة — سجّل دخولك مرة ثانية")
    return payload["sub"]


class RegisterBody(BaseModel):
    username: str
    password: str
    email: str | None = None


class LoginBody(BaseModel):
    username: str
    password: str


class ExpenseBody(BaseModel):
    merchant: str
    amount: float
    date: str | None = None
    category: str = "Other"
    paymentMethod: str = "Credit Card"
    description: str = ""
    notes: str = ""
    hasReceipt: bool = False
    receiptKey: str | None = None


def _expense_row_to_api(row) -> dict:
    return {
        "expenseId": row["expense_id"],
        "userId": row["user_id"],
        "merchant": row["merchant"],
        "amount": row["amount"],
        "date": row["date"],
        "category": row["category"],
        "paymentMethod": row["payment_method"],
        "description": row["description"],
        "notes": row["notes"],
        "status": row["status"],
        "hasReceipt": bool(row["has_receipt"]),
        "isRecurring": bool(row["is_recurring"]),
        "receiptKey": row["receipt_key"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


@app.get("/expenses/health")
def health():
    openrouter_ok = bool(os.environ.get("OPENROUTER_API_KEY", "").strip())
    return {
        "status": "healthy",
        "service": "ريالي-ryialAI",
        "timestamp": datetime.utcnow().isoformat(),
        "openrouterConfigured": openrouter_ok,
    }


@app.post("/admin/seed-demo")
def admin_seed_demo(
    username: str = "jinan",
    replace: bool = False,
    x_seed_secret: str | None = Header(None, alias="X-Seed-Secret"),
):
    """One-shot demo seed on Railway volume — requires SEED_SECRET env var."""
    expected = os.environ.get("SEED_SECRET", "").strip()
    if not expected or x_seed_secret != expected:
        raise HTTPException(403, "Forbidden")
    try:
        return seed_demo.seed(username, replace=replace)
    except Exception as e:
        raise HTTPException(500, str(e)) from e


@app.post("/auth/register")
def register(body: RegisterBody):
    try:
        return auth.register_user(body.username, body.password, body.email)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/auth/login")
def login(body: LoginBody):
    try:
        return auth.login_user(body.username, body.password)
    except ValueError:
        raise HTTPException(401, "Invalid username or password")


@app.get("/profile")
def profile(user_id: str = Depends(get_user_id)):
    return gam.profile_response(user_id)


@app.get("/challenges")
def challenges(user_id: str = Depends(get_user_id)):
    return {"challenges": gam.list_challenges(user_id)}


@app.post("/challenges/generate")
def generate_challenges(user_id: str = Depends(get_user_id)):
    try:
        summary = gam.build_expense_summary_for_ai(user_id)
        ai_result = orouter.generate_weekly_challenges(summary)
        created = gam.create_challenges_for_user(user_id, ai_result.get("challenges", []))
        return {"message": "Challenges generated", "count": len(created), "challenges": created}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/challenges/{challenge_id}/claim")
def claim_challenge(challenge_id: str, user_id: str = Depends(get_user_id)):
    result, status = gam.complete_challenge(challenge_id, user_id)
    if status == "not_found":
        raise HTTPException(404, "Challenge not found")
    if status == "forbidden":
        raise HTTPException(403, "Access denied")
    if status == "not_completed":
        raise HTTPException(400, detail={"error": "Challenge not yet completed", "challenge": result})
    return {"message": "Challenge reward claimed", "reward": result}


class AddFriendBody(BaseModel):
    username: str


class JoinGroupBody(BaseModel):
    groupId: str


@app.get("/users/lookup/{username}")
def lookup_user(username: str, user_id: str = Depends(get_user_id)):
    profile = social.lookup_username(username)
    if not profile:
        raise HTTPException(404, "اسم المستخدم غير موجود")
    profile["isMe"] = profile["userId"] == user_id
    return profile


@app.get("/friends")
def get_friends(user_id: str = Depends(get_user_id)):
    return {"friends": social.list_friends(user_id)}


@app.post("/friends")
def add_friend(body: AddFriendBody, user_id: str = Depends(get_user_id)):
    try:
        friend = social.add_friend(user_id, body.username)
        return {"message": "تمت إضافة الصديق", "friend": friend}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/friends/{friend_id}")
def delete_friend(friend_id: str, user_id: str = Depends(get_user_id)):
    return social.remove_friend(user_id, friend_id)


@app.get("/friends/leaderboard")
def friends_leaderboard(user_id: str = Depends(get_user_id)):
    return social.get_friends_leaderboard(user_id)


@app.get("/challenges/shared")
def shared_challenges(user_id: str = Depends(get_user_id)):
    return {"groups": social.list_shared_challenges(user_id)}


@app.post("/challenges/{challenge_id}/share")
def share_challenge(challenge_id: str, user_id: str = Depends(get_user_id)):
    try:
        return social.share_challenge_with_friends(challenge_id, user_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/challenges/shared/join")
def join_shared(body: JoinGroupBody, user_id: str = Depends(get_user_id)):
    try:
        return social.join_shared_group(body.groupId, user_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@app.get("/leaderboard")
def leaderboard(user_id: str = Depends(get_user_id)):
    return gam.get_leaderboard(user_id)


@app.get("/expenses")
def list_expenses(user_id: str = Depends(get_user_id)):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    items = [_expense_row_to_api(r) for r in rows]
    return {"expenses": items, "count": len(items)}


def _create_expense_for_user(body: ExpenseBody, user_id: str, *, voice_bonus: bool = False):
    if not body.merchant or body.amount <= 0:
        raise HTTPException(400, "Merchant and positive amount are required")

    expense_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    expense_date = body.date or datetime.utcnow().strftime("%Y-%m-%d")
    conn = get_connection()
    conn.execute(
        """INSERT INTO expenses (expense_id, user_id, merchant, amount, date, category,
           payment_method, description, notes, status, has_receipt, is_recurring,
           receipt_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?, 0, ?, ?, ?)""",
        (
            expense_id, user_id, body.merchant, body.amount, expense_date, body.category,
            body.paymentMethod, body.description, body.notes, int(body.hasReceipt),
            body.receiptKey, now, now,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)).fetchone()
    conn.close()

    gamification_result = gam.award_xp_for_expense(user_id, expense_date, voice_bonus=voice_bonus)
    gam.check_and_complete_challenges(user_id)

    return {
        "message": "Expense created successfully",
        "expenseId": expense_id,
        "expense": _expense_row_to_api(row),
        "gamification": gamification_result,
    }


@app.post("/expenses")
def create_expense(body: ExpenseBody, user_id: str = Depends(get_user_id)):
    return _create_expense_for_user(body, user_id)


@app.get("/expenses/recurring")
def recurring(user_id: str = Depends(get_user_id)):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM expenses WHERE user_id = ? AND is_recurring = 1",
        (user_id,),
    ).fetchall()
    conn.close()
    items = [_expense_row_to_api(r) for r in rows]
    monthly_total = sum(float(r["amount"]) for r in rows)
    return {"recurringExpenses": items, "monthlyTotal": monthly_total, "count": len(items)}


@app.get("/expenses/analytics")
def analytics(user_id: str = Depends(get_user_id)):
    conn = get_connection()
    rows = conn.execute("SELECT * FROM expenses WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    if not rows:
        return {
            "totalExpenses": 0,
            "categoryBreakdown": {},
            "monthlyTrend": {},
            "recurringTotal": 0,
            "expenseCount": 0,
        }
    total = sum(float(r["amount"]) for r in rows)
    categories = {}
    monthly_trend = {}
    for r in rows:
        cat = r["category"]
        categories[cat] = categories.get(cat, 0) + float(r["amount"])
        mk = r["date"][:7]
        monthly_trend[mk] = monthly_trend.get(mk, 0) + float(r["amount"])
    recurring_total = sum(float(r["amount"]) for r in rows if r["is_recurring"])
    return {
        "totalExpenses": total,
        "categoryBreakdown": categories,
        "monthlyTrend": monthly_trend,
        "recurringTotal": recurring_total,
        "expenseCount": len(rows),
    }


@app.get("/expenses/{expense_id}")
def get_expense(expense_id: str, user_id: str = Depends(get_user_id)):
    conn = get_connection()
    row = conn.execute("SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Expense not found")
    if row["user_id"] != user_id:
        raise HTTPException(403, "Access denied")
    return _expense_row_to_api(row)


@app.put("/expenses/{expense_id}")
def update_expense(expense_id: str, body: dict, user_id: str = Depends(get_user_id)):
    conn = get_connection()
    row = conn.execute("SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Expense not found")
    if row["user_id"] != user_id:
        conn.close()
        raise HTTPException(403, "Access denied")

    field_map = {
        "merchant": "merchant", "amount": "amount", "category": "category",
        "paymentMethod": "payment_method", "description": "description",
        "notes": "notes", "date": "date", "receiptKey": "receipt_key", "hasReceipt": "has_receipt",
    }
    updates = []
    values = []
    for api_field, db_field in field_map.items():
        if api_field in body:
            val = body[api_field]
            if api_field == "hasReceipt":
                val = int(val)
            updates.append(f"{db_field} = ?")
            values.append(val)
    if updates:
        values.append(datetime.utcnow().isoformat())
        values.append(expense_id)
        conn.execute(
            f"UPDATE expenses SET {', '.join(updates)}, updated_at = ? WHERE expense_id = ?",
            values,
        )
        conn.commit()
    conn.close()
    return {"message": "Expense updated successfully"}


@app.delete("/expenses/{expense_id}")
def delete_expense(expense_id: str, user_id: str = Depends(get_user_id)):
    conn = get_connection()
    row = conn.execute("SELECT user_id FROM expenses WHERE expense_id = ?", (expense_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Expense not found")
    if row["user_id"] != user_id:
        conn.close()
        raise HTTPException(403, "Access denied")
    conn.execute("DELETE FROM expenses WHERE expense_id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return {"message": "Expense deleted successfully"}


@app.post("/expenses/{expense_id}/recurring")
def toggle_recurring(expense_id: str, user_id: str = Depends(get_user_id)):
    conn = get_connection()
    row = conn.execute("SELECT * FROM expenses WHERE expense_id = ?", (expense_id,)).fetchone()
    if not row or row["user_id"] != user_id:
        conn.close()
        raise HTTPException(404 if not row else 403)
    new_val = 0 if row["is_recurring"] else 1
    conn.execute(
        "UPDATE expenses SET is_recurring = ?, updated_at = ? WHERE expense_id = ?",
        (new_val, datetime.utcnow().isoformat(), expense_id),
    )
    conn.commit()
    conn.close()
    return {"message": "Updated", "isRecurring": bool(new_val)}


class UploadUrlBody(BaseModel):
    expenseId: str
    filename: str
    contentType: str = "image/jpeg"


@app.post("/upload")
def upload_url(body: UploadUrlBody, user_id: str = Depends(get_user_id)):
    key = f"receipts/{user_id}/{body.expenseId}/{body.filename}"
    upload_url = f"{BASE_URL}/uploads/{user_id}/{body.expenseId}/{body.filename}"
    return {"uploadUrl": upload_url, "key": key}


@app.put("/uploads/{user_id}/{expense_id}/{filename}")
async def receive_upload(user_id: str, expense_id: str, filename: str, request: Request):
    dest = UPLOAD_DIR / user_id / expense_id
    dest.mkdir(parents=True, exist_ok=True)
    content = await request.body()
    (dest / filename).write_bytes(content)
    return {"ok": True}


@app.get("/uploads/{user_id}/{expense_id}/{filename}")
def serve_upload(user_id: str, expense_id: str, filename: str):
    path = UPLOAD_DIR / user_id / expense_id / filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


def _check_voice_rate_limit(user_id: str):
    from datetime import date
    today = date.today().isoformat()
    conn = get_connection()
    row = conn.execute(
        """SELECT COUNT(*) AS c FROM voice_logs
           WHERE user_id = ? AND created_at >= ? AND status = 'processed'""",
        (user_id, today),
    ).fetchone()
    conn.close()
    if int(row["c"]) >= voice.VOICE_DAILY_LIMIT:
        raise HTTPException(429, detail={
            "error": f"تجاوزت الحد اليومي ({voice.VOICE_DAILY_LIMIT} تسجيل صوتي)",
        })


def _log_voice(user_id: str, transcription: str, amount, category, confidence, status: str):
    conn = get_connection()
    conn.execute(
        """INSERT INTO voice_logs (log_id, user_id, transcription, amount, category,
           confidence, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            str(uuid.uuid4()), user_id, transcription, amount, category, confidence,
            status, datetime.utcnow().isoformat(),
        ),
    )
    conn.commit()
    conn.close()


class VoiceConfirmRequest(BaseModel):
    amount: float
    category: str
    note: str | None = None
    transcription: str
    source: str = "voice"


def _voice_service_error(exc: Exception) -> HTTPException:
    msg = str(exc)
    if "OPENROUTER_API_KEY is not configured" in msg:
        return HTTPException(503, detail={
            "error": "مفتاح OpenRouter غير مضبوط على الخادم — أضف OPENROUTER_API_KEY في Railway Variables",
        })
    if isinstance(exc, ValueError):
        return HTTPException(503, detail={"error": msg})
    return HTTPException(500, detail={"error": f"Voice processing failed: {msg}"})


@app.post("/voice/process")
async def voice_process(
    audio_file: UploadFile | None = File(None),
    transcription: str | None = Form(None),
    user_id: str = Depends(get_user_id),
):
    """Transcribe + extract — does NOT save expense."""
    _check_voice_rate_limit(user_id)
    text = (transcription or "").strip()

    if not text:
        if not audio_file:
            raise HTTPException(400, "audio_file or transcription is required")
        audio_bytes = await audio_file.read()
        if not audio_bytes:
            raise HTTPException(400, "Empty audio file")
        filename = audio_file.filename or "voice.webm"
        try:
            text = await asyncio.to_thread(voice.transcribe_audio, audio_bytes, filename)
        except ValueError as e:
            raise _voice_service_error(e) from e
        except Exception as e:
            _log_voice(user_id, "", None, None, None, "failed")
            raise _voice_service_error(e) from e

    if not text:
        raise HTTPException(400, "Could not transcribe audio")

    try:
        extracted = await asyncio.to_thread(voice.extract_expense, text)
    except Exception as e:
        _log_voice(user_id, text, None, None, None, "failed")
        raise _voice_service_error(e) from e

    _log_voice(
        user_id, text, extracted["amount"], extracted["category"],
        extracted["confidence"], "processed",
    )

    return {
        "transcription": text,
        "amount": extracted["amount"],
        "category": extracted["category"],
        "note": extracted.get("note"),
        "confidence": extracted["confidence"],
        "xp_awarded": 0,
    }


@app.post("/receipt/process")
async def receipt_process(
    image_file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
):
    """Extract expense from receipt image — does NOT save."""
    _check_voice_rate_limit(user_id)
    image_bytes = await image_file.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image file")
    filename = image_file.filename or "receipt.jpg"
    try:
        extracted = await asyncio.to_thread(voice.extract_receipt_image, image_bytes, filename)
    except Exception as e:
        _log_voice(user_id, "receipt", None, None, None, "failed")
        raise _voice_service_error(e) from e

    _log_voice(
        user_id, extracted["transcription"], extracted["amount"], extracted["category"],
        extracted["confidence"], "processed",
    )
    return {
        "transcription": extracted["transcription"],
        "amount": extracted["amount"],
        "category": extracted["category"],
        "note": extracted.get("note"),
        "confidence": extracted["confidence"],
        "source": "receipt",
        "xp_awarded": 0,
    }


@app.post("/voice/confirm")
def voice_confirm(body: VoiceConfirmRequest, user_id: str = Depends(get_user_id)):
    """Save expense after user confirms extracted data."""
    if body.amount <= 0:
        raise HTTPException(400, detail={
            "error": "amount must be positive",
            "transcription": body.transcription,
        })

    category = voice.normalize_category(body.category)
    merchant = (body.note or ("إيصال" if body.source == "receipt" else "مصروف صوتي"))[:100]
    source_label = "إيصال" if body.source == "receipt" else "صوت"
    expense_body = ExpenseBody(
        merchant=merchant,
        amount=float(body.amount),
        category=category,
        description=body.note or "",
        notes=f"{source_label}: {body.transcription[:200]}",
        paymentMethod="Digital Wallet",
        hasReceipt=body.source == "receipt",
    )
    result = _create_expense_for_user(expense_body, user_id, voice_bonus=True)
    xp = result["gamification"]["xpEarned"]
    _log_voice(
        user_id, body.transcription, body.amount, category, None, "confirmed",
    )
    return {
        "transcription": body.transcription,
        "amount": body.amount,
        "category": category,
        "note": body.note,
        "confidence": 1.0,
        "xp_awarded": xp,
        "expenseId": result["expenseId"],
        "expense": result["expense"],
        "gamification": result["gamification"],
        "messageAr": f"تم تسجيل {body.amount} ريال — +{xp} XP",
    }


class VoiceBody(BaseModel):
    audioBase64: str | None = None
    transcription: str | None = None
    mimeType: str = "audio/webm"


@app.post("/voice/expense")
def voice_expense_legacy(body: VoiceBody, user_id: str = Depends(get_user_id)):
    """Legacy one-shot endpoint — prefer /voice/process + /voice/confirm."""
    raise HTTPException(410, detail={
        "error": "Use POST /voice/process then POST /voice/confirm",
    })


# Production: serve React SPA (must be after API routes)
if SERVE_FRONTEND:
    assets_dir = STATIC_DIR / "static"
    if assets_dir.is_dir():
        app.mount("/static", StaticFiles(directory=assets_dir), name="static")

    _API_PREFIXES = (
        "auth", "expenses", "profile", "challenges", "leaderboard",
        "voice", "upload", "uploads", "docs", "openapi.json", "redoc",
    )

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith(_API_PREFIXES):
            raise HTTPException(404, "Not found")
        asset = STATIC_DIR / full_path
        if asset.is_file():
            return FileResponse(asset)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=os.environ.get("RIYAL_ENV") != "production")
