# RiyalAI

AI-powered personal expense tracking built with AWS CDK and React.

RiyalAI is a clean, standalone expense tracker extracted from a larger project. It lets authenticated users create, view, filter, and manage expenses, upload receipt images, and track recurring monthly costs.

## Features

- Expense CRUD with Cognito authentication
- Dashboard with spending stats, filters, and sorting (Arabic RTL + English)
- **XP & leveling** — +20 XP per expense, level up every 500 XP (levels 1–20)
- **Daily streaks** — 7-day streak row, ×2 XP multiplier on day 7+
- **AI challenges** (OpenRouter / Claude) — personalized weekly challenges in Saudi Arabic
- **Weekly leaderboard** — XP rankings, resets Monday 00:00
- **Voice expense logging** — Arabic audio → transcription → auto-save
- Receipt upload to S3 with presigned URLs
- Recurring expense tracking
- CloudFront-hosted React frontend

## Project Structure

```
RiyalAI/
├── app.py                  # CDK entry point
├── riyalai/
│   └── riyalai_stack.py    # AWS infrastructure
├── functions/
│   ├── expense_app.py      # Main API Lambda
│   ├── receipt_ocr/        # Textract OCR
│   ├── receipt_processor/  # AI receipt analysis (stub)
│   ├── receipt_image_processor/
│   └── spending_analysis/
├── frontend/               # React app
└── tests/
```

## Prerequisites

- Python 3.12+
- Node.js 16+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

## Quick Start

```bash
cd RiyalAI

# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..

# Deploy (set OpenRouter key for AI features)
export OPENROUTER_API_KEY=sk-or-v1-your-key-here
cdk bootstrap
cdk deploy

# After deploy, copy outputs into frontend/.env
cp frontend/.env.example frontend/.env
# Set REACT_APP_API_URL, REACT_APP_USER_POOL_ID, REACT_APP_USER_POOL_CLIENT_ID

cd frontend && npm run build && cd ..
cdk deploy   # redeploy to push frontend build
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/expenses/health` | No | Health check |
| GET | `/expenses` | Yes | List user expenses |
| POST | `/expenses` | Yes | Create expense |
| GET | `/expenses/{id}` | Yes | Get expense |
| PUT | `/expenses/{id}` | Yes | Update expense |
| DELETE | `/expenses/{id}` | Yes | Delete expense |
| GET | `/expenses/recurring` | Yes | List recurring expenses |
| POST | `/expenses/{id}/recurring` | Yes | Toggle recurring |
| GET | `/expenses/analytics` | Yes | Spending analytics |
| POST | `/upload` | Yes | Get presigned S3 upload URL |
| GET | `/profile` | Yes | XP, level, streak, 7-day row |
| GET | `/challenges` | Yes | List AI challenges with progress |
| POST | `/challenges/generate` | Yes | Manually generate challenges (dev) |
| POST | `/challenges/{id}/claim` | Yes | Claim challenge XP reward |
| GET | `/leaderboard` | Yes | Weekly XP leaderboard |
| POST | `/voice/expense` | Yes | Voice → transcribe → create expense |

## Database (DynamoDB)

| Table | Key | Fields |
|-------|-----|--------|
| ExpensesTable | expenseId | userId, amount, category, date, … |
| UsersTable | userId | xp, level, streak, lastLogDate, weeklyXp, weekStart |
| ChallengesTable | challengeId (GSI: userId) | title, description, category, targetReductionPercent, xpReward, status, expiresAt |

Weekly challenges are auto-generated **every Sunday** via EventBridge → `ChallengeGeneratorFunction`.

## Testing

```bash
pytest
```

## License

MIT
