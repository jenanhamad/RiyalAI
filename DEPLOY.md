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
| `OPENROUTER_API_KEY` | `sk-or-v1-...` (للتحديات والصوت) |
| `PUBLIC_URL` | رابط التطبيق بعد النشر، مثل `https://riyal-production.up.railway.app` |
| `RIYAL_ENV` | `production` |
| `DATA_DIR` | `/app/data` |

> بعد أول deploy، انسخ الرابط العام وضعه في `PUBLIC_URL` ثم **Redeploy**.

### 3) قرص دائم للبيانات (مهم)

بدون volume تضيع البيانات عند كل إعادة تشغيل.

1. في المشروع: **+ New** → **Volume**
2. Mount path: `/app/data`
3. اربط الـ Volume بنفس خدمة الـ Web

### 4) Deploy

Railway يكتشف `Dockerfile` تلقائياً. انتظر حتى **Success** ثم افتح الرابط العام.

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

## AWS (لاحقاً)

كود CDK موجود في `riyalai/` لو حاب تنتقل لـ Cognito + DynamoDB — الحل الحالي أبسط ومناسب للاستخدام الشخصي.
