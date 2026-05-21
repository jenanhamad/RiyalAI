# RiyalAI Setup

## 1. Install dependencies

```bash
cd RiyalAI
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd frontend
npm install
cd ..
```

## 2. Deploy infrastructure

```bash
cdk bootstrap   # first time only
cdk deploy
```

Note the CDK outputs:
- `RiyalAiApiUrl`
- `RiyalAiUserPoolId`
- `RiyalAiUserPoolClientId`
- `RiyalAiFrontendUrl`

## 3. Configure frontend

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```
REACT_APP_API_URL=<RiyalAiApiUrl>
REACT_APP_USER_POOL_ID=<RiyalAiUserPoolId>
REACT_APP_USER_POOL_CLIENT_ID=<RiyalAiUserPoolClientId>
```

## 4. Build and redeploy frontend

```bash
cd frontend
npm run build
cd ..
cdk deploy
```

## 5. Local development

```bash
# Terminal 1 — frontend dev server
cd frontend
npm start

# Terminal 2 — run tests
pytest
```

## Security Notes

- Never commit `frontend/.env`
- AWS credentials belong in `~/.aws/credentials`
- All API endpoints require Cognito auth except `/expenses/health`
