#!/usr/bin/env bash
# Start RiyalAI locally (API + React)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f local/.env ] && [ -f local/.env.example ]; then
  cp local/.env.example local/.env
  echo "Created local/.env — add your OPENROUTER_API_KEY"
fi

# Backend venv
if [ ! -d local/.venv ]; then
  python3 -m venv local/.venv
  local/.venv/bin/pip install -r local/requirements.txt -q
fi

# Frontend uses frontend/.env.development (committed) → localhost:8000

echo "Starting API on http://localhost:8000"
(cd local && ../local/.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
API_PID=$!

sleep 2
echo "Starting React on http://localhost:3000"
cd frontend && npm start &
FRONT_PID=$!

trap "kill $API_PID $FRONT_PID 2>/dev/null" EXIT
wait
