"""OpenRouter API client for Claude and multimodal models."""
import json
import os
import urllib.error
import urllib.request

OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
TRANSCRIPTION_MODEL = os.environ.get("OPENROUTER_TRANSCRIPTION_MODEL", "google/gemini-2.0-flash-001")
RECEIPT_VISION_MODEL = os.environ.get("OPENROUTER_RECEIPT_MODEL", TRANSCRIPTION_MODEL)


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
    """Transcribe Arabic audio using a multimodal model on OpenRouter."""
    content = [
        {
            "type": "text",
            "text": (
                "هذا تسجيل صوتي بالعامية السعودية لتسجيل مصروف مالي. "
                "انسخ التسجيل بالعربية (اللهجة السعودية) حرفياً. "
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
    """Extract expense fields from Arabic transcription via OpenRouter."""
    prompt = f"""أنت مساعد لاستخراج بيانات المصاريف من النص العربي.

استخرج من هذه الجملة:
"{transcription}"

أرجع JSON فقط بدون أي نص إضافي:
{{
  "amount": <رقم فقط، بدون رمز العملة>,
  "category": <واحدة من: طعام، تنقل، ترفيه، تسوق، صحة، تعليم، فواتير، أخرى
    أو بالإنجليزية: Food & Dining, Transportation, Shopping, Entertainment,
    Utilities, Healthcare, Groceries, Gas, Other>,
  "note": <ملاحظة قصيرة اختيارية أو null>,
  "merchant": <اسم المتجر إن وُجد أو null>,
  "confidence": <رقم من 0.0 إلى 1.0 يعكس مدى وضوح البيانات>
}}

افهم العامية السعودية (مية = 100، كم = سعر، إلخ). إذا المبلغ غير واضح استخدم 0."""
    raw = chat_completion(
        [{"role": "user", "content": prompt}],
        max_tokens=256,
        temperature=0.1,
    )
    raw = raw.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def extract_expense_from_receipt_image(image_b64: str, mime_type: str = "image/jpeg"):
    """Extract expense fields from a receipt photo via OpenRouter vision."""
    prompt = """أنت تقرأ إيصالاً أو فاتورة (عربي/إنجليزي) لتطبيق مصاريف سعودي.

استخرج من الصورة:
- المبلغ الإجمالي النهائي (total) بالريال
- اسم المتجر/المطعم
- التصنيف المناسب
- ملاحظة قصيرة إن وُجدت

أرجع JSON فقط بدون أي نص إضافي:
{
  "amount": <رقم فقط>,
  "category": <Food & Dining, Transportation, Shopping, Entertainment, Utilities, Healthcare, Groceries, Gas, Other
    أو بالعربية: طعام، تنقل، تسوق، ترفيه، فواتير، صحة، بقالة، وقود، أخرى>,
  "note": <ملاحظة قصيرة أو null>,
  "merchant": <اسم المتجر>,
  "confidence": <0.0 إلى 1.0>
}

إذا المبلغ غير واضح استخدم 0."""
    content = [
        {"type": "text", "text": prompt},
        {
            "type": "image_url",
            "image_url": {"url": f"data:{mime_type};base64,{image_b64}"},
        },
    ]
    raw = chat_completion(
        [{"role": "user", "content": content}],
        model=RECEIPT_VISION_MODEL,
        max_tokens=512,
        temperature=0.1,
    )
    raw = raw.strip()
    if "```" in raw:
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
