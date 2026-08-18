# ============================================================================
# TensorFlow Sidecar — Dockerfile
# ============================================================================

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cria diretório de modelos
RUN mkdir -p /app/models

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8501/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8501", "--workers", "1"]
