#!/usr/bin/env bash
# Run ريـال so your phone can open it on the same Wi‑Fi
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Mac local IP (Wi‑Fi)
IP="${RIYAL_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)}"
if [ -z "$IP" ]; then
  echo "ما لقينا IP. حطّه يدوي:"
  echo "  RIYAL_IP=192.168.1.x ./scripts/start-mobile.sh"
  exit 1
fi

echo "📱 عنوان الجوال: http://${IP}:3000"
echo "🔌 API: http://${IP}:8000"
echo ""
echo "تأكد الجوال والماك على نفس الواي فاي"
echo ""

# Frontend يتصل بالـ API عبر IP الماك (مو localhost)
cat > frontend/.env.local <<EOF
REACT_APP_API_URL=http://${IP}:8000
EOF

# روابط رفع الإيصالات
if [ -f local/.env ]; then
  grep -q '^LOCAL_API_URL=' local/.env && \
    sed -i '' "s|^LOCAL_API_URL=.*|LOCAL_API_URL=http://${IP}:8000|" local/.env 2>/dev/null || \
    sed -i "s|^LOCAL_API_URL=.*|LOCAL_API_URL=http://${IP}:8000|" local/.env
else
  cp local/.env.example local/.env 2>/dev/null || true
  echo "LOCAL_API_URL=http://${IP}:8000" >> local/.env
fi

if [ ! -d local/.venv ]; then
  python3 -m venv local/.venv
  local/.venv/bin/pip install -r local/requirements.txt -q
fi

echo "Starting API on 0.0.0.0:8000 ..."
(cd local && ../local/.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000) &
API_PID=$!

sleep 2
echo "Starting React on 0.0.0.0:3000 ..."
(cd frontend && HOST=0.0.0.0 npm start) &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null" EXIT
echo ""
echo "افتح من الجوال: http://${IP}:3000"
echo "لإضافته للشاشة الرئيسية: Safari → مشاركة → «إضافة إلى الشاشة الرئيسية»"
wait
