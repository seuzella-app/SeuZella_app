"""
ZÉLLA — Semantica Sidecar Main App
==================================

FastAPI app exposing Semantica to Next.js via HTTP/mTLS.
"""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_client import make_asgi_app, Counter, Histogram, Gauge

from .core.config import settings
from .core.store import get_store
from .core.models import (
    AddNodeRequest, AddEdgeRequest, UpdateNodeRequest,
    HybridSearchRequest,
    ResolveConflictRequest,
    RecordDecisionRequest, FindSimilarRequest,
    IngestRequest,
    ReasoningRequest,
    ForgetGuestRequest,
)

# ============================================================================
# SENTRY (opcional)
# ============================================================================

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment="production" if settings.require_auth else "development",
    )

# ============================================================================
# RATE LIMITING
# ============================================================================

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

# ============================================================================
# METRICS (Prometheus)
# ============================================================================

REQUEST_COUNT = Counter(
    'semantica_requests_total',
    'Total requests',
    ['method', 'endpoint', 'status']
)
REQUEST_LATENCY = Histogram(
    'semantica_request_latency_seconds',
    'Request latency',
    ['endpoint']
)
NODES_COUNT = Gauge('semantica_nodes_total', 'Total graph nodes')
EDGES_COUNT = Gauge('semantica_edges_total', 'Total graph edges')
DECISIONS_COUNT = Gauge('semantica_decisions_total', 'Total decisions recorded')


# ============================================================================
# AUTH DEPENDENCY
# ============================================================================

async def verify_api_key(request: Request):
    """Verifica header X-Semantica-Key contra SEMANTICA_API_KEY."""
    if not settings.require_auth:
        return  # Dev mode sem auth

    api_key = request.headers.get("X-Semantica-Key")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Semantica-Key header",
        )

    if api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


# ============================================================================
# LIFESPAN
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    print(f"[{datetime.now().isoformat()}] Starting {settings.app_name} v{settings.version}")
    print(f"  Mode: {'MOCK' if settings.mock_mode else 'LIVE'}")
    print(f"  Host: {settings.host}:{settings.port}")
    print(f"  Auth: {'required' if settings.require_auth else 'disabled'}")
    print(f"  mTLS: {'enabled' if settings.mtls_enabled else 'disabled'}")

    # Warm-up store
    store = get_store()
    print(f"  Store initialized with {len(store._nodes)} seed nodes")

    yield

    print(f"[{datetime.now().isoformat()}] Shutdown {settings.app_name}")


# ============================================================================
# APP
# ============================================================================

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="GraphRAG + Decision Intelligence for Seu Zélla",
    lifespan=lifespan,
    docs_url="/docs" if not settings.require_auth else None,
    redoc_url="/redoc" if not settings.require_auth else None,
)

# CORS (apenas localhost em dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://smart-hotel-zehla.vercel.app"] if not settings.mock_mode else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# ============================================================================
# MIDDLEWARE — logging + metrics
# ============================================================================

@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Loga todas as requisições e atualiza métricas Prometheus."""
    start_time = datetime.now()
    response = await call_next(request)
    duration = (datetime.now() - start_time).total_seconds()

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()
    REQUEST_LATENCY.labels(endpoint=request.url.path).observe(duration)

    # Skip log for /health and /metrics
    if request.url.path not in ["/health", "/metrics"]:
        print(
            f"[{start_time.isoformat()}] {request.method} {request.url.path} "
            f"→ {response.status_code} ({duration * 1000:.0f}ms)"
        )

    return response


# ============================================================================
# HEALTH
# ============================================================================

@app.get("/health")
async def health():
    """Healthcheck — não requer auth."""
    store = get_store()
    return await store.get_health()


# ============================================================================
# GRAPH NODES
# ============================================================================

@app.post("/graph/nodes", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def add_node(request: Request, body: AddNodeRequest):
    """Adiciona um nó ao grafo do tenant."""
    store = get_store()
    node = await store.add_node(body.tenantId, body.model_dump(exclude={"tenantId"}))
    NODES_COUNT.inc()
    return node


@app.get("/graph/nodes", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def list_nodes(
    request: Request,
    tenantId: str,
    type: Optional[str] = None,
    limit: int = 100,
):
    """Lista nós do tenant."""
    store = get_store()
    return await store.list_nodes(tenantId, type, limit)


@app.get("/graph/nodes/{node_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def get_node(request: Request, node_id: str, tenantId: str):
    """Busca um nó específico."""
    store = get_store()
    node = await store.get_node(tenantId, node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    return node


@app.patch("/graph/nodes/{node_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def update_node(request: Request, node_id: str, body: UpdateNodeRequest):
    """Atualiza um nó."""
    store = get_store()
    node = await store.update_node(body.tenantId, node_id, body.model_dump(exclude={"tenantId"}, exclude_none=True))
    if not node:
        raise HTTPException(404, "Node not found")
    return node


@app.delete("/graph/nodes/{node_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def delete_node(request: Request, node_id: str, tenantId: str):
    """Remove um nó (e suas arestas)."""
    store = get_store()
    deleted = await store.delete_node(tenantId, node_id)
    if not deleted:
        raise HTTPException(404, "Node not found")
    NODES_COUNT.dec()
    return {"deleted": True}


# ============================================================================
# GRAPH EDGES
# ============================================================================

@app.post("/graph/edges", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def add_edge(request: Request, body: AddEdgeRequest):
    """Adiciona uma aresta ao grafo."""
    store = get_store()
    edge = await store.add_edge(body.tenantId, body.model_dump(exclude={"tenantId"}))
    EDGES_COUNT.inc()
    return edge


@app.get("/graph/edges", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def list_edges(request: Request, tenantId: str, limit: int = 100):
    """Lista arestas do tenant."""
    store = get_store()
    return await store.list_edges(tenantId, limit)


@app.delete("/graph/edges/{edge_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def delete_edge(request: Request, edge_id: str, tenantId: str):
    """Remove uma aresta."""
    store = get_store()
    deleted = await store.delete_edge(tenantId, edge_id)
    if not deleted:
        raise HTTPException(404, "Edge not found")
    EDGES_COUNT.dec()
    return {"deleted": True}


# ============================================================================
# HYBRID SEARCH
# ============================================================================

@app.post("/graph/search", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def hybrid_search(request: Request, body: HybridSearchRequest):
    """Busca híbrida: vetorial + BFS no grafo."""
    store = get_store()
    return await store.hybrid_search(
        body.tenantId, body.query, body.hops, body.maxNodes, body.includeConflicts
    )


# ============================================================================
# CONFLICTS
# ============================================================================

@app.post("/conflicts/detect", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def detect_conflicts(request: Request, body: dict):
    """Detecta conflitos no grafo do tenant."""
    store = get_store()
    return await store.detect_conflicts(body["tenantId"])


@app.get("/conflicts", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def list_conflicts(request: Request, tenantId: str, status_filter: Optional[str] = None):
    """Lista conflitos do tenant."""
    store = get_store()
    return await store.list_conflicts(tenantId, status_filter)


@app.patch("/conflicts/{conflict_id}/resolve", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def resolve_conflict(request: Request, conflict_id: str, body: ResolveConflictRequest):
    """Resolve um conflito criando uma aresta SUPERSEDES."""
    store = get_store()
    conflict = await store.resolve_conflict(conflict_id, body.tenantId, body.model_dump(exclude={"tenantId"}))
    if not conflict:
        raise HTTPException(404, "Conflict not found")
    return conflict


# ============================================================================
# DECISIONS
# ============================================================================

@app.post("/decisions", dependencies=[Depends(verify_api_key)])
@limiter.limit("120/minute")
async def record_decision(request: Request, body: RecordDecisionRequest):
    """Registra uma decisão (async — não bloqueia resposta ao hóspede)."""
    store = get_store()
    decision = await store.record_decision(body.model_dump())
    DECISIONS_COUNT.inc()
    return decision


@app.get("/decisions", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def list_decisions(request: Request, tenantId: str, limit: int = 50, offset: int = 0):
    """Lista decisões do tenant."""
    store = get_store()
    return await store.list_decisions(tenantId, limit, offset)


@app.get("/decisions/{decision_id}", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def get_decision(request: Request, decision_id: str, tenantId: str):
    """Busca uma decisão específica."""
    store = get_store()
    decision = await store.get_decision(tenantId, decision_id)
    if not decision:
        raise HTTPException(404, "Decision not found")
    return decision


@app.get("/decisions/{decision_id}/trace", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def trace_decision_chain(request: Request, decision_id: str, tenantId: str):
    """Traça a cadeia causal completa de uma decisão."""
    store = get_store()
    chain = await store.trace_decision_chain(tenantId, decision_id)
    if not chain:
        raise HTTPException(404, "Decision not found")
    return chain


@app.post("/decisions/similar", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def find_similar_decisions(request: Request, body: FindSimilarRequest):
    """Busca decisões semelhantes por similaridade semântica."""
    store = get_store()
    return await store.find_similar_decisions(body.tenantId, body.query, body.maxResults)


# ============================================================================
# INGESTION
# ============================================================================

@app.post("/ingest", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def ingest(request: Request, body: IngestRequest):
    """Pipeline completo: parse → extract → build graph."""
    store = get_store()
    return await store.ingest(body.tenantId, body.text, body.url, body.sourceType)


# ============================================================================
# ONTOLOGY & REASONING
# ============================================================================

@app.post("/ontology/validate", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def validate_ontology(request: Request, body: dict):
    """Valida grafo do tenant contra ontologia (SHACL)."""
    store = get_store()
    return await store.validate_ontology(body["tenantId"])


@app.post("/reasoning/query", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def reasoning_query(request: Request, body: ReasoningRequest):
    """Executa query de raciocínio (Datalog/SPARQL)."""
    store = get_store()
    return await store.reason(body.tenantId, body.query)


# ============================================================================
# LGPD
# ============================================================================

@app.post("/lgpd/forget-guest", dependencies=[Depends(verify_api_key)])
@limiter.limit("5/minute")
async def forget_guest(request: Request, body: ForgetGuestRequest):
    """Esquecimento LGPD: marca nós como forgotten e anonimiza decisões."""
    store = get_store()
    return await store.forget_guest(body.guestId, body.tenantId)


# ============================================================================
# STATS
# ============================================================================

@app.get("/stats", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def get_stats(request: Request, tenantId: str):
    """Estatísticas do grafo do tenant."""
    store = get_store()
    return await store.get_stats(tenantId)


# ============================================================================
# EXCEPTION HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.detail,
            "statusCode": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"[ERROR] Unhandled exception: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalError",
            "message": str(exc),
            "statusCode": 500,
        },
    )


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.reload,
        ssl_certfile=settings.mtls_cert_path if settings.mtls_enabled else None,
        ssl_keyfile=settings.mtls_key_path if settings.mtls_enabled else None,
        ssl_ca_certs=settings.mtls_ca_path if settings.mtls_enabled else None,
        ssl_cert_reqs=2 if settings.mtls_enabled else 0,  # CERT_REQUIRED=2, CERT_NONE=0
    )
