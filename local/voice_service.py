"""Voice expense via OpenRouter only (transcribe + extract)."""
import base64
import importlib.util
import json
import re
from pathlib import Path
from typing import Any

VOICE_DAILY_LIMIT = 30

AR_TO_APP_CATEGORY = {
    "طعام": "Food & Dining",
    "تنقل": "Transportation",
    "ترفيه": "Entertainment",
    "تسوق": "Shopping",
    "صحة": "Healthcare",
    "تعليم": "Other",
    "فواتير": "Utilities",
    "بقالة": "Groceries",
    "وقود": "Gas",
    "بنزين": "Gas",
    "أخرى": "Other",
}

APP_CATEGORIES = {
    "Food & Dining", "Transportation", "Shopping", "Entertainment",
    "Utilities", "Healthcare", "Groceries", "Gas", "Other",
}

_MIME_BY_EXT = {
    "webm": "audio/webm",
    "m4a": "audio/m4a",
    "mp4": "audio/mp4",
    "mpeg": "audio/mpeg",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
}


def _openrouter():
    or_path = Path(__file__).parent.parent / "functions" / "openrouter.py"
    spec = importlib.util.spec_from_file_location("openrouter", or_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def normalize_category(raw: str) -> str:
    if not raw:
        return "Other"
    key = raw.strip()
    if key in AR_TO_APP_CATEGORY:
        return AR_TO_APP_CATEGORY[key]
    for cat in APP_CATEGORIES:
        if cat.lower() == key.lower():
            return cat
    return "Other"


def _parse_json_object(text: str) -> dict[str, Any]:
    raw = text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw.strip())


def transcribe_audio(audio_bytes: bytes, filename: str = "voice.webm") -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    mime = _MIME_BY_EXT.get(ext, "audio/webm")
    b64 = base64.b64encode(audio_bytes).decode("ascii")
    text = _openrouter().transcribe_audio_base64(b64, mime)
    if not text:
        raise ValueError("OpenRouter returned empty transcription")
    return text.strip()


def extract_expense(transcription: str) -> dict[str, Any]:
    raw = _openrouter().extract_expense_from_text(transcription)
    return _normalize_extracted(raw, transcription)


def _normalize_extracted(data: dict[str, Any], transcription: str) -> dict[str, Any]:
    amount = float(data.get("amount", 0) or 0)
    category = normalize_category(str(data.get("category", "أخرى")))
    note = data.get("note") or data.get("merchant")
    if note is not None:
        note = str(note).strip() or None
    confidence = float(data.get("confidence", 0.85 if amount > 0 else 0.4))
    confidence = max(0.0, min(1.0, confidence))
    return {
        "transcription": transcription,
        "amount": amount,
        "category": category,
        "note": note,
        "confidence": confidence,
    }
