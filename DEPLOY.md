# نشر ريـال على الإنترنت

تطبيق واحد (Docker): واجهة React + API + قاعدة SQLite على قرص دائم.

## الطريقة الأسهل: Railway

### 1) حساب وربط GitHub

1. سجّل في [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo** → اختر `RiyalAI`

### 2) متغيرات البيئة (Settings → Variables)

| Variable | القيمة |
|----------|--------|
| `JWT_SECRET` | سلسلة عشوائية طويلة (مثلاً 32 حرف) |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` (مطلوب للـ AI) |
| `OPENROUTER_MODEL` | `anthropic/claude-haiku-4.5` — تحديات، story، استخراج من النص |
| `OPENROUTER_RECEIPT_MODEL` | `google/gemini-2.5-flash-lite` — قراءة إيصالات الصور |
| `OPENROUTER_TRANSCRIPTION_MODEL` | *(اختياري)* بدونها الصوت يستخدم `google/gemini-2.0-flash-001` |
| `PUBLIC_URL` | رابط التطبيق بعد النشر، مثل `https://riyal-production.up.railway.app` |
| `SMTP_HOST` | *(لنسيت كلمة المرور)* مثل `smtp.gmail.com` أو `smtp.resend.com` |
| `SMTP_PORT` | `587` (افتراضي) |
| `SMTP_USER` | اسم مستخدم SMTP |
| `SMTP_PASSWORD` | كلمة مرور SMTP أو App Password |
| `SMTP_FROM` | `ريالي <noreply@yourdomain.com>` |
| `SMTP_USE_TLS` | `1` (افتراضي) |
| `RIYAL_ENV` | `production` |
| `DATA_DIR` | `/app/data` |
| `SERVE_FRONTEND` | `1` |

> بعد أول deploy، انسخ الرابط العام وضعه في `PUBLIC_URL` ثم **Redeploy**.

### 3) قرص دائم للبيانات (مهم)

بدون volume تضيع البيانات عند كل إعادة تشغيل.

1. في المشروع: **+ New** → **Volume**
2. Mount path: `/app/data`
3. اربط الـ Volume بنفس خدمة الـ Web

### 4) Deploy

Railway يكتشف `Dockerfile` تلقائياً. انتظر حتى **Success** ثم افتح الرابط العام.

### استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| Build failed | تحقق من Logs؛ غالباً `npm` — أعد Deploy |
| 502 / Crash | تأكد `JWT_SECRET` موجود |
| رفع إيصال لا يعمل | عيّن `PUBLIC_URL` = رابط Railway بالضبط |
| تحديات AI لا تعمل | أضف `OPENROUTER_API_KEY` |
| الصوت/الإيصال لا يعمل | تأكد `OPENROUTER_TRANSCRIPTION_MODEL` و `OPENROUTER_RECEIPT_MODEL`؛ تحقق من `/expenses/health` → `openrouterModels` |
| نسيت كلمة المرور لا ترسل بريد | أضف `SMTP_*` و `PUBLIC_URL`؛ بدون SMTP الرابط يظهر في Railway Logs فقط |

### بيانات تجريبية على الـ Volume

**طريقة 1 — من Terminal (بعد `railway login`):**

```bash
railway link
railway run python local/seed_sample_data.py jinan --replace
```

**طريقة 2 — عبر HTTP (بدون CLI):**

1. في Variables أضف مؤقتاً: `SEED_SECRET=كلمة-سر-عشوائية`
2. Redeploy
3. نفّذ (استبدل الرابط والسر):

```bash
curl -X POST "https://YOUR-APP.up.railway.app/admin/seed-demo?username=jinan&replace=true" \
  -H "X-Seed-Secret: كلمة-سر-عشوائية"
```

4. احذف `SEED_SECRET` من Variables بعد النجاح

---

## Render (بديل)

1. [render.com](https://render.com) → **New** → **Web Service**
2. اربط الريبو، Runtime: **Docker**
3. أضف **Disk** mount: `/app/data` (1 GB)
4. نفس متغيرات البيئة أعلاه
5. أو استخدم `render.yaml` من الريبو

---

## تجربة محلية قبل النشر

```bash
cd /Users/jenanhamad/RiyalAI
docker build -t riyal .
docker run -p 8000:8000 \
  -e JWT_SECRET=test-secret-change-me \
  -e OPENROUTER_API_KEY=sk-or-v1-... \
  -e OPENROUTER_TRANSCRIPTION_MODEL=google/gemini-2.0-flash-001 \
  -e OPENROUTER_RECEIPT_MODEL=google/gemini-2.0-flash-001 \
  -e PUBLIC_URL=http://localhost:8000 \
  -v riyal-data:/app/data \
  riyal
```

افتح: http://localhost:8000

---

## بعد النشر

- سجّل حساب جديد من الجوال أو الكمبيوتر
- **HTTPS** مفعّل تلقائياً → الميكروفون يشتغل على آيفون
- أضف للشاشة الرئيسية من Safari / Chrome

## تكلفة تقريبية (Railway)

خطة Hobby ~ $5/شهر مع volume صغير — راجع [railway.app/pricing](https://railway.app/pricing).
