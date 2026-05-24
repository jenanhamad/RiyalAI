# نشر ريـال على Railway — خطوة بخطوة

## 1) الكود على GitHub

```bash
git push -u origin main
```

## 2) Railway

1. [railway.app](https://railway.app) → تسجيل الدخول بـ **GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. اختر **RiyalAI** (أو اسم الريبو)
4. انتظر البناء (Dockerfile) — 3–5 دقائق

## 3) متغيرات البيئة

في المشروع → خدمة الويب → **Variables**:

```
JWT_SECRET=ضع-هنا-32-حرف-عشوائي-قوي
OPENROUTER_API_KEY=sk-or-v1-xxxx
DATA_DIR=/app/data
RIYAL_ENV=production
SERVE_FRONTEND=1
```

بعد أول نشر، من **Settings → Networking** انسخ الرابط العام ثم أضف:

```
PUBLIC_URL=https://اسم-مشروعك.up.railway.app
```

اضغط **Redeploy** بعد إضافة `PUBLIC_URL`.

## 4) Volume (لا تضيع البيانات)

1. في المشروع: **+ Create** → **Volume**
2. **Mount path:** `/app/data`
3. **Connect** إلى خدمة الـ Web

## 5) فتح التطبيق

**Settings → Networking → Generate Domain** (إن لم يظهر رابط)

افتح الرابط من الجوال → سجّل حساب → استخدم التطبيق.

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| Build failed | تحقق من Logs؛ غالباً `npm` — أعد Deploy |
| 502 / Crash | تأكد `JWT_SECRET` موجود |
| رفع إيصال لا يعمل | عيّن `PUBLIC_URL` = رابط Railway بالضبط |
| تحديات AI لا تعمل | أضف `OPENROUTER_API_KEY` |

## تكلفة تقريبية

خطة Hobby ~ $5/شهر مع volume صغير — راجع [railway.app/pricing](https://railway.app/pricing).
