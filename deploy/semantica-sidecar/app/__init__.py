"""
ZÉLLA — Semantica Sidecar
========================

FastAPI app que expõe o Semantica (graph-rag, decision intelligence,
provenance, ontology) para o Next.js via HTTP/mTLS.

Porta: 7432 (default)
Auth: header X-Semantica-Key (env SEMANTICA_API_KEY)
Rate limit: 100 req/min por IP (slowapi)

Recursos:
  - /health                         — healthcheck
  - /graph/nodes (GET/POST/PATCH/DELETE)
  - /graph/edges (GET/POST/DELETE)
  - /graph/search (POST)            — hybrid graph + vector search
  - /conflicts (GET) /detect (POST) /resolve (PATCH)
  - /decisions (GET/POST) + /trace + /similar
  - /ingest (POST)                  — pipeline completo
  - /ontology/validate (POST)
  - /reasoning/query (POST)
  - /lgpd/forget-guest (POST)
  - /stats (GET)
  - /metrics (Prometheus)

Em dev: rodar com uvicorn app.main:app --reload --port 7432
Em prod: systemd service (deploy/semantica-sidecar/semantica.service)
"""

__version__ = '1.0.0'
