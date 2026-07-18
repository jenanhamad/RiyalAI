# RiyalAI (ريالي)

تطبيق مصاريف شخصي وأعمال بالذكاء الاصطناعي — واجهة React (PWA) + API (FastAPI + SQLite).

**الإنتاج:** https://riyalai.up.railway.app

## المميزات

- **وضعان:** أفراد (gamification) وأعمال (ربح / ضريبة / هدر) — تبديل في أي وقت
- تسجيل وإدارة المصاريف (عربي RTL + إنجليزي)
- **استعادة كلمة المرور** عبر البريد الإلكتروني (SMTP)
- **XP ومستويات** — +20 XP لكل مصروف (وضع الأفراد فقط)
- **سلسلة يومية** — مضاعف ×2 في اليوم السابع+
- **تحديات AI** (OpenRouter) — تحديات أسبوعية باللهجة السعودية
- **لوحة متصدرين** أسبوعية + أصدقاء
- **تسجيل صوتي** — صوت عربي → نص → حفظ (إيراد/مصروف في وضع الأعمال)
- **إيصالات بالصورة** — OCR عبر Gemini Vision
- **قصة أسبوعك (أفراد)** — Weekly Story + مشاركة
- **مشروعك بنظرة (أعمال)** — Business Glance
- **أعمال:** لوحة ربح، صحة المشروع، تقدير VAT، كاشف هدر
- **استيراد/تصدير التقارير (أعمال)** — رفع تقارير مصاريف/إيرادات سابقة (CSV/Excel) مع مطابقة أعمدة تلقائية بالذكاء الاصطناعي، وتصدير بيانات خام أو تقرير ملخّص Excel

## هيكل المشروع

```
RiyalAI/
├── local/           # API (FastAPI + SQLite)
├── frontend/        # React
├── scripts/         # تشغيل محلي / جوال
├── Dockerfile       # نشر Railway / Render
├── LOCAL_DEV.md     # تشغيل على الماك
└── DEPLOY.md        # نشر على الإنترنت + متغيرات Railway
```

## تشغيل محلي (سريع)

```bash
./scripts/dev-local.sh
```

انسخ `local/.env.example` → `local/.env` وأضف `OPENROUTER_API_KEY`.

راجع [LOCAL_DEV.md](LOCAL_DEV.md) للتفاصيل.

## نشر على الإنترنت

راجع [DEPLOY.md](DEPLOY.md) — Railway / Render / Docker.

### متغيرات Railway (أساسية)

| Variable | الغرض |
|----------|--------|
| `JWT_SECRET` | جلسات المستخدم |
| `OPENROUTER_API_KEY` | AI (صوت، إيصالات، تحديات) |
| `OPENROUTER_MODEL` | نص — `anthropic/claude-haiku-4.5` |
| `OPENROUTER_RECEIPT_MODEL` | إيصالات — `google/gemini-2.5-flash-lite` |
| `PUBLIC_URL` | رابط التطبيق (إيصالات + نسيت كلمة المرور) |
| `DATA_DIR` | `/app/data` + Volume |
| `SERVE_FRONTEND` | `1` |
| `RIYAL_ENV` | `production` |

**نسيت كلمة المرور:** أضف `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

**الصوت (اختياري):** `OPENROUTER_TRANSCRIPTION_MODEL` — بدونها يستخدم `google/gemini-2.0-flash-001`.

## API

| Method | Path | الوصف |
|--------|------|--------|
| GET | `/expenses/health` | فحص الصحة + `openrouterModels` |
| POST | `/auth/register` | تسجيل حساب |
| POST | `/auth/login` | تسجيل دخول |
| POST | `/auth/forgot-password` | طلب رابط استعادة كلمة المرور |
| POST | `/auth/reset-password` | تعيين كلمة مرور جديدة |
| GET/POST | `/expenses` | قائمة / إنشاء مصاريف |
| GET | `/profile` | XP ومستوى وسلسلة |
| POST | `/voice/process` | تفريغ صوت + استخراج (لا يحفظ) |
| POST | `/voice/confirm` | حفظ مصروف بعد الصوت |
| POST | `/receipt/process` | OCR إيصال (لا يحفظ) |
| GET | `/challenges` | التحديات |
| GET | `/leaderboard` | المتصدرين |
| GET | `/business/dashboard` | لوحة الأعمال |
| GET | `/story/weekly` | قصة أسبوعك |
| GET | `/business/glance` | نظرة على المشروع |
| POST | `/business/import/preview` | تحليل ملف CSV/Excel + مطابقة أعمدة (AI) |
| POST | `/business/import/confirm` | تأكيد المطابقة واستيراد الحركات |
| GET | `/business/export/expenses` | تصدير الحركات الخام (CSV/Excel) |
| GET | `/business/export/report` | تصدير تقرير ملخّص (Excel) |

Swagger: `/docs`

## License

MIT
