-- ============================================================================
-- ZÉLLA — Semantica Postgres Init Script
-- ============================================================================
-- Executado automaticamente na primeira inicialização do container Postgres.
-- Cria extensões necessárias: pgvector + apache_age + pg_trgm
-- ============================================================================

-- ── Extensões ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "vector";        -- PgVector
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram fuzzy search
-- Apache AGE: requires compilation, will be added when VPS is provisioned
-- CREATE EXTENSION IF NOT EXISTS age;

-- ── Schema isolado para Semantica (não conflita com schema public do Prisma) ──
CREATE SCHEMA IF NOT EXISTS semantica;

-- ── Tabelas do Semantica (em mock mode, não usadas, mas definidas para prod) ──
SET search_path TO semantica;

-- Nodes
CREATE TABLE IF NOT EXISTS nodes (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    name        TEXT NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(768),
    provenance  JSONB,
    confidence  FLOAT DEFAULT 0.5,
    forgotten   BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nodes_tenant ON nodes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nodes_tenant_type ON nodes(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_nodes_embedding ON nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Edges
CREATE TABLE IF NOT EXISTS edges (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    source_node_id  TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id  TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation_type   TEXT NOT NULL,
    priority_weight INT DEFAULT 1,
    condition       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edges_tenant ON edges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);

-- Conflicts
CREATE TABLE IF NOT EXISTS conflicts (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    node_ids            TEXT[] NOT NULL,
    description         TEXT NOT NULL,
    severity            TEXT DEFAULT 'medium',
    status              TEXT DEFAULT 'detected',
    suggested_resolution JSONB,
    resolved_by         TEXT,
    resolved_at         TIMESTAMPTZ,
    detected_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_tenant ON conflicts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(tenant_id, status);

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
    id                  TEXT PRIMARY KEY,
    tenant_id           TEXT NOT NULL,
    category            TEXT NOT NULL,
    scenario            TEXT NOT NULL,
    reasoning           TEXT NOT NULL,
    outcome             TEXT NOT NULL,
    response            TEXT,
    confidence          FLOAT NOT NULL,
    metadata            JSONB,
    graph_node_ids      TEXT[],
    parent_decision_id  TEXT REFERENCES decisions(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_tenant_created ON decisions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_category ON decisions(tenant_id, category);

-- ── Reset search_path ────────────────────────────────────────────────
RESET search_path;

-- ── Log de criação ───────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Semantica schema initialized successfully';
    RAISE NOTICE 'Extensions: pgvector, pg_trgm';
    RAISE NOTICE 'Tables: semantica.nodes, semantica.edges, semantica.conflicts, semantica.decisions';
END $$;
