# Production image (used by Railway). Two stages: build the frontend, then run FastAPI.

# --- 1. Frontend build -------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
# npm 10 (bundled with Node 22) crashes on this dependency tree; npm 11 is fine.
RUN npm install -g npm@11
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# --- 2. Backend --------------------------------------------------------------------
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.6.9 /uv /usr/local/bin/uv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev
COPY backend/ ./
COPY stimuli /app/stimuli
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV PATH="/app/backend/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT_TYPE=production
# Railway sets $PORT.
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 4 --bind 0.0.0.0:${PORT:-8000}"]
