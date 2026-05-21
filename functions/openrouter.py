"""OpenRouter API client for Claude and multimodal models."""
import json
import os
import urllib.error
import urllib.request

OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
TRANSCRIPTION_MODEL = os.environ.get("OPENROUTER_TRANSCRIPTION_MODEL", "google/gemini-2.0-flash-001")


def _api_key():
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        raise ValueError("OPENROUTER_API_KEY is not configured")
    return key


def chat_completion(messages, model=None, max_tokens=1024, temperature=0.3):
    """Call OpenRouter chat completions API."""
    payload = {
        "model": model or DEFAULT_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        OPENROUTER_BASE,
        data=body,
        headers={
            "Authorization": f"Bearer {_api_key()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://riyalai.app",
            "X-Title": "ryialAI",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=55) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter error {e.code}: {err_body}") from e

    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")
    return choices[0]["message"]["content"]


def transcribe_audio_base64(audio_b64, mime_type="audio/webm"):
    """Transcribe Arabic audio using a multimodal model."""
    content = [
        {
            "type": "text",
            "text": (
                "انسخ هذا التسجيل الصوتي بالعربية (اللهجة السعودية) حرفياً. "
                "أرجع النص فقط بدون شرح."
            ),
        },
        {
            "type": "input_audio",
            "input_audio": {
                "data": audio_b64,
                "format": mime_type.split("/")[-1] if "/" in mime_type else "webm",
            },
        },
    ]
    try:
        return chat_completion(
            [{"role": "user", "content": content}],
            model=TRANSCRIPTION_MODEL,
            max_tokens=512,
        ).strip()
    except Exception:
        # Fallback: some models expect image_url style — try text-only hint
        return chat_completion(
            [
                {
                    "role": "user",
                    "content": (
                        "Transcribe the following base64 audio (Saudi Arabic dialect). "
                        f"Audio format: {mime_type}. Base64: {audio_b64[:2000]}..."
                    ),
                }
            ],
            model=DEFAULT_MODEL,
            max_tokens=512,
        ).strip()


def extract_expense_from_text(transcription):
    """Extract expense fields from Arabic transcription."""
    prompt = (
        f'Extract expense details from this Arabic text: "{transcription}"\n'
        "Return JSON only with keys: amount (number), category (string in English "
        "matching: Food & Dining, Transportation, Shopping, Entertainment, Utilities, "
        "Healthcare, Groceries, Gas, Other), note (string), merchant (string).\n"
        "Use Saudi dialect understanding. If amount missing use 0."
    )
    raw = chat_completion(
        [{"role": "user", "content": prompt}],
        max_tokens=256,
        temperature=0.1,
    )
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def generate_weekly_challenges(expense_summary_text):
    """Generate 2-3 personalized challenges in Saudi Arabic."""
    prompt = (
        "أنت مستشار مالي سعودي لتطبيق ريالي. حلّل مصروفات آخر 30 يوم:\n\n"
        f"{expense_summary_text}\n\n"
        "أنشئ 2 إلى 3 تحديات شخصية باللهجة السعودية. "
        "كل تحدي: عنوان قصير، وصف (مثل: أنت تصرف 40% على الطعام — حاول تخفّضه 20% هذا الأسبوع (+150 XP)), "
        "category (بالإنجليزية من القائمة: Food & Dining, Transportation, Shopping, Entertainment, "
        "Utilities, Healthcare, Groceries, Gas, Other), target_reduction_percent (عدد), xp_reward (عدد 100-200).\n"
        "أرجع JSON فقط: {\"challenges\": [{\"title\", \"description\", \"category\", "
        "\"target_reduction_percent\", \"xp_reward\"}]}"
    )
    raw = chat_completion(
        [{"role": "user", "content": prompt}],
        max_tokens=1200,
        temperature=0.5,
    )
    raw = raw.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())
