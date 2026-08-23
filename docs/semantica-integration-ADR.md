# Semantica Integration — Architecture Decision Record (ADR)

**Status:** Accepted
**Date:** 2026-08-13
**Deciders:** Tech Lead, Dev Team

---

## Context

O Seu Zélla tem 3 pilares estruturais (graph-rag, knowledge-distiller, neuro-router) que estavam desconectados entre si. Além disso, descobrimos que 4 módulos do `src/lib/ml/` (graph-rag, dpo-collector, brain-health-optimizer, prompt-compiler) estavam **mortos em produção** — nunca chamados no fluxo real de mensagens.

O verdadeiro loop de aprendizado vivo é o `conversation-learner.ts`, que:
1. Analisa conversas resolvidas (via cron diário)
2. Extrai pares Q&A
3. Salva como `KnowledgeEntry` (category='auto_learned')
4. Atualiza `effectiveness` em conversas futuras
5. Promove padrões verificados após 3+ usos bem-sucedidos

## Decision

Integrar o [Semantica](https://github.com/semantica-agi/semantica) como **sidecar Python (FastAPI)** rodando na VPS, exposto via HTTP/mTLS na porta `7432`. O Next.js (Vercel) chama via `SemanticaClient` (TypeScript).

### Princípios

1. **Sem reescrever o cérebro Zélla** — Semantica é uma camada nova *sob* o cérebro, não um substituto. `zaos-neuro-router.ts`, `cognitive-router.ts`, `knowledge-distiller.ts` permanecem intactos na superfície.

2. **Sidecar Python na VPS** — Semantica é Python puro e pesado (~2GB de deps: torch, spacy, transformers). Rodar dentro do Next.js/Vercel Serverless é inviável (limite 250MB). Solução: microserviço Python na VPS exposto via REST interno.

3. **PgVector + Apache AGE** (ambos em PostgreSQL) — em vez de Neo4j ou Qdrant separados. A VPS terá Postgres Neon/Supabase; AGE é uma extensão que adiciona graph queries em SQL puro. Mantém o stack unificado e o backup simples.

### Pontos de integração

#### Ponto 1 — Ingestão (write-path) — `conversation-learner.ts`
Quando `ConversationLearner.analyzeConversation()` identifica novo padrão Q&A, em vez de só salvar em `KnowledgeEntry`:
1. Chama `SemanticaClient.extractEntities(chosenAnswer)` → descobre entidades
2. Chama `SemanticaClient.extractRelations(prompt + chosenAnswer)` → descobre triplas
3. Salva nós + arestas no grafo do tenant (Apache AGE)
4. **Sempre que entidade nova aparece, cria `KnowledgeEntry` E `GraphNode` correspondente** (sync duplo)

#### Ponto 2 — Recuperação (read-path) — `cognitive-router.ts`
Etapa 3b chama **primeiro** `SemanticaClient.hybridSearch()` que retorna:
- Nós relevantes (BFS traversal 2-3 hops)
- Arestas com `SUPERSEDES` aplicado (desempate hierárquico)
- Conflitos detectados a caminho do LLM
- Proveniência (para auditoria)

Se Semantica falhar/timeout → fallback para `retrieveRelevantKnowledge` atual (TF-IDF/Gemini).

#### Ponto 3 — Decisão (audit-path) — `cognitive-router.ts` após resposta
Após `router.generate()`, chama `SemanticaClient.recordDecision()`:
- `category`: classe da intenção
- `scenario`: mensagem do hóspede
- `reasoning`: regra do grafo usada (proveniência)
- `outcome`: resposta dada
- `confidence`: score do LLM
- `metadata`: tenantId, sessionId, provider usado

Em seguida `add_causal_relationship()` liga a decisão ao `GraphNode` que justificou a resposta.

## Consequences

### Positivas
- **Auditabilidade total**: toda resposta da IA tem ID de decisão rastreável
- **Resolução hierárquica de conflitos**: SUPERSEDES > FORBIDS > REQUIRES > OVERLAPS
- **LGPD compliance**: `forgetGuest()` marca nós como `forgotten` e anonimiza decisões
- **Padrões W3C**: PROV-O (provenance), OWL, SHACL
- **Determinístico**: nenhum LLM necessário para construir o grafo ou raciocinar
- **Poliglota em storage**: RDF (Oxigraph) e LPG (Apache AGE), vectors (PgVector)

### Negativas
- **+2GB de deps Python** (torch, spacy, transformers) na VPS
- **Latência extra HTTP** (~25ms em cache hit, ~150ms em cache miss)
- **Risco de deps CVE**: requer `pip-audit` no CI + Renovate bot
- **Backup adicional**: grafo do tenant precisa ser incluído no pg_dump diário

### Trade-offs
- **Cache agressivo (5min)** mitiga latência extra
- **mTLS + IP allowlist** mitiga risco de sidecar exposto
- **Feature flag USE_SEMANTICA_GRAPH** permite desativar instantaneamente

## Implementation

### Fases
- **Fase 0**: Setup VPS + Postgres + AGE + PgVector + Semantica
- **Fase 0.5**: Hardening (mTLS, Sentry, LGPD forget)
- **Fase 1**: Bridge TypeScript (SemanticaClient) + deletar código morto
- **Fase 2**: Plugar no cognitive-router (read-path)
- **Fase 3**: Plugar no conversation-learner (write-path)
- **Fase 4**: Decision Intelligence (audit-path)
- **Fase 5**: Painel Semântica no ZCC + ingestão manual
- **Fase 6**: Ontologia + Reasoning + Observabilidade

### Estrutura de arquivos
```
deploy/semantica-sidecar/
├── Dockerfile
├── requirements.txt
├── init-db.sql
├── start.sh
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app (12 endpoints)
│   └── core/
│       ├── __init__.py
│       ├── config.py        # Settings via env vars
│       ├── models.py        # Pydantic models
│       └── store.py         # MockStore (dev) → AgeStore (prod)

src/lib/semantica/
├── types.ts                 # TypeScript types (espelho models.py)
└── client.ts                # SemanticaClient com retry + cache + fallback

src/app/api/zcc/semantica/
├── graph/route.ts           # GET nós + arestas
├── decisions/route.ts       # GET audit trail
├── conflicts/route.ts       # GET conflitos
└── ingest/route.ts          # POST pipeline

src/app/api/lgpd/forget-guest/route.ts  # LGPD Art. 18

src/components/zcc/panels/semantica-panel.tsx  # 18ª aba do ZCC

docker-compose.semantica.yml  # Dev local (Postgres + Python)
```

## Environment Variables

```bash
# Feature flag
USE_SEMANTICA_GRAPH=false                    # default: desativado

# Sidecar connection
SEMANTICA_BASE_URL=http://127.0.0.1:7432
SEMANTICA_API_KEY=                           # 32 chars random
SEMANTICA_TIMEOUT_MS=3000
SEMANTICA_CACHE_TTL=300
SEMANTICA_MAX_RETRIES=3

# mTLS (produção)
SEMANTICA_MTLS_ENABLED=false
SEMANTICA_MTLS_CERT_PATH=
SEMANTICA_MTLS_KEY_PATH=
SEMANTICA_MTLS_CA_PATH=
```

## Monitoring

- **Prometheus** (`/metrics` no sidecar)
- **Sentry** (`sentry-sdk[fastapi]`)
- **structlog** (structured logging)
- **Health check**: `GET /health` (sem auth)

## Rollback Plan

Se algo quebrar em produção:
1. Setar `USE_SEMANTICA_GRAPH=false` no Vercel env
2. Next.js volta a usar só `retrieveRelevantKnowledge` (TF-IDF/Gemini)
3. Sidecar Python pode ser parado sem impacto
4. Grafo do tenant permanece no Postgres (não é perdido)
