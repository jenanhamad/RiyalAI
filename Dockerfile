# ريـال — single container: API + React
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ ./
ENV REACT_APP_API_URL=
ENV NODE_ENV=production
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

COPY local/requirements.txt ./local/
RUN pip install --no-cache-dir -r local/requirements.txt

COPY local/ ./local/
COPY functions/openrouter.py ./functions/openrouter.py
COPY --from=frontend-build /build/frontend/build ./frontend/build

ENV RIYAL_ENV=production
ENV SERVE_FRONTEND=1
ENV DATA_DIR=/app/data
ENV PYTHONUNBUFFERED=1

RUN mkdir -p /app/data/uploads

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/expenses/health')" || exit 1

CMD sh -c "cd local && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"
