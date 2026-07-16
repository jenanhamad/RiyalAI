# Run ريالي locally (no AWS)

Everything runs on your Mac. **No Cognito, no Lambda, no deploy.**

## Setup (once)

```bash
cd /Users/jenanhamad/RiyalAI

# Backend
python3 -m venv local/.venv
local/.venv/bin/pip install -r local/requirements.txt
cp local/.env.example local/.env
# Edit local/.env → add OPENROUTER_API_KEY=sk-or-v1-...

# Frontend
cd frontend && npm install && cd ..
```

## Start

**Terminal 1 — API**
```bash
cd local
../local/.venv/bin/uvicorn main:app --reload --port 8000
```

**Terminal 2 — React**
```bash
cd frontend
npm start
```

Open http://localhost:3000 → **Register** with email + password → use the app.

## Your data

| What | Where |
|------|--------|
| Database | `data/riyalai.db` |
| Receipt images | `data/uploads/` |
| Login session | Browser localStorage |

Back up the `data/` folder to keep your history.

## AI features

Voice and challenges need `OPENROUTER_API_KEY` in `local/.env`. Everything else works offline.

---

## التجربة على الجوال (نفس الواي فاي)

الجوال ما يفهم `localhost` — لازم عنوان IP حق الماك.

### الطريقة السريعة

```bash
chmod +x scripts/start-mobile.sh
./scripts/start-mobile.sh
```

راح يطلع لك رابط مثل: `http://192.168.1.23:3000` — افتحه من **Safari** أو **Chrome** على الجوال.

### يدوي (خطوتين)

**1) اعرف IP الماك**

```bash
ipconfig getifaddr en0
```

مثال: `192.168.1.23`

**2) شغّل السيرفرات على الشبكة**

Terminal 1:
```bash
cd local
../local/.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Terminal 2 — أنشئ `frontend/.env.local`:
```
REACT_APP_API_URL=http://192.168.1.23:8000
```
(غيّر الرقم لـ IP حقك)

```bash
cd frontend
HOST=0.0.0.0 npm start
```

من الجوال: `http://192.168.1.23:3000`

### إضافة أيقونة على الشاشة الرئيسية (مثل التطبيق)

1. افتح الرابط في **Safari** (آيفون) أو **Chrome** (أندرويد)
2. **آيفون:** زر المشاركة → «إضافة إلى الشاشة الرئيسية»
3. **أندرويد:** القائمة ⋮ → «إضافة إلى الشاشة الرئيسية» أو «Install app»

### ملاحظات

| موضوع | تفاصيل |
|--------|---------|
| نفس الواي فاي | الماك والجوال لازم على نفس الشبكة |
| جدار الحماية | إذا ما فتح، اسمح Node/Python في Firewall على الماك |
| الميكروفون | على آيفون أحياناً يحتاج HTTPS؛ جرّب أولاً على الواي فاي |
| بيانات الجوال | ما يشتغل برّا البيت إلا تنشره على الإنترنت (لاحقاً) |
