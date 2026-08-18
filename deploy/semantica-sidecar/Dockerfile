# ============================================================================
# Semantica Sidecar — Dockerfile
# ============================================================================
# Imagem: Python 3.11 slim + semantica[full]
# Tamanho final: ~2.5GB (devido a torch, spacy, transformers)
# ============================================================================

FROM python:3.11-slim

# ── System deps ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python deps (cache layer) ──────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Download spaCy model (português) ───────────────────────────────────
RUN python -m spacy download pt_core_news_sm || true

# ── App code ────────────────────────────────────────────────────────────
COPY . .

# ── Healthcheck ────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:7432/health || exit 1

# ── Run ────────────────────────────────────────────────────────────────
EXPOSE 7432
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7432", "--workers", "2"]
