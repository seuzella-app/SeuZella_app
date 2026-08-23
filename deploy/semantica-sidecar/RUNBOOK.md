# Semantica Sidecar — Runbook Operacional

**Versão:** 1.0.0
**Última atualização:** 2026-08-13

---

## Visão Geral

O Semantica Sidecar é um microserviço Python (FastAPI) que roda na VPS ao lado do Next.js. Expõe GraphRAG + Decision Intelligence + Provenance via HTTP/mTLS na porta `7432`.

## Arquitetura

```
Next.js (Vercel/VPS) ──HTTPS/mTLS──→ uvicorn :7432 ──→ Semantica (Python)
                                              ↓
                                       PostgreSQL 16
                                       ├─ Apache AGE (graph)
                                       └─ PgVector (vectors)
```

## Comandos Básicos

### Iniciar (dev local)
```bash
./deploy/semantica-sidecar/start.sh
# OU
docker compose -f docker-compose.semantica.yml up -d --build
```

### Parar
```bash
./deploy/semantica-sidecar/start.sh --down
```

### Ver logs
```bash
./deploy/semantica-sidecar/start.sh --logs
# OU
docker compose -f docker-compose.semantica.yml logs -f semantica-sidecar
```

### Status
```bash
./deploy/semantica-sidecar/start.sh --status
```

### Health check
```bash
curl http://127.0.0.1:7432/health | jq
```

### Métricas Prometheus
```bash
curl http://127.0.0.1:7432/metrics
```

## Endpoints Disponíveis

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/health` | Healthcheck (sem auth) |
| GET | `/metrics` | Métricas Prometheus |
| GET | `/docs` | Swagger UI (apenas em dev) |
| POST | `/graph/nodes` | Adiciona nó |
| GET | `/graph/nodes` | Lista nós do tenant |
| GET | `/graph/nodes/{id}` | Busca nó específico |
| PATCH | `/graph/nodes/{id}` | Atualiza nó |
| DELETE | `/graph/nodes/{id}` | Remove nó |
| POST | `/graph/edges` | Adiciona aresta |
| GET | `/graph/edges` | Lista arestas |
| DELETE | `/graph/edges/{id}` | Remove aresta |
| POST | `/graph/search` | Busca híbrida (vetorial + BFS) |
| POST | `/conflicts/detect` | Detecta conflitos |
| GET | `/conflicts` | Lista conflitos |
| PATCH | `/conflicts/{id}/resolve` | Resolve conflito |
| POST | `/decisions` | Registra decisão (async) |
| GET | `/decisions` | Lista decisões |
| GET | `/decisions/{id}` | Busca decisão |
| GET | `/decisions/{id}/trace` | Cadeia causal |
| POST | `/decisions/similar` | Busca similares |
| POST | `/ingest` | Pipeline completo (parse → extract → build) |
| POST | `/ontology/validate` | Valida ontologia (SHACL) |
| POST | `/reasoning/query` | Query Datalog/SPARQL |
| POST | `/lgpd/forget-guest` | Esquecimento LGPD |
| GET | `/stats` | Estatísticas do tenant |

## Variáveis de Ambiente

### Dev (docker-compose.semantica.yml)
```bash
SEMANTICA_MOCK_MODE=true                    # Store em memória (não usa Postgres real)
SEMANTICA_REQUIRE_AUTH=false                # Sem auth para testes
SEMANTICA_API_KEY=dev-key-zella-2026-not-for-production
DATABASE_URL=postgresql://seuzella:seuzella_dev_2026@postgres-semantica:5432/seuzella_semantica
```

### Produção (VPS)
```bash
SEMANTICA_MOCK_MODE=false                   # Usa Apache AGE + PgVector real
SEMANTICA_REQUIRE_AUTH=true                 # Auth obrigatória
SEMANTICA_API_KEY=<32 chars random>         # openssl rand -hex 16
DATABASE_URL=postgresql://seuzella:****@localhost:5432/seuzella_prod
SEMANTICA_MTLS_ENABLED=true                 # mTLS obrigatório
SEMANTICA_MTLS_CERT_PATH=/opt/semantica/certs/server.crt
SEMANTICA_MTLS_KEY_PATH=/opt/semantica/certs/server.key
SEMANTICA_MTLS_CA_PATH=/opt/semantica/certs/ca.crt
SENTRY_DSN=https://****@sentry.io/****
```

## Troubleshooting

### Sidecar não responde
```bash
# 1. Verificar se está rodando
docker compose -f docker-compose.semantica.yml ps

# 2. Verificar logs
docker compose -f docker-compose.semantica.yml logs --tail 100 semantica-sidecar

# 3. Verificar porta
curl -v http://127.0.0.1:7432/health

# 4. Reiniciar
docker compose -f docker-compose.semantica.yml restart semantica-sidecar
```

### Erro 401 (Unauthorized)
- Verificar se `SEMANTICA_API_KEY` está configurada no Next.js e no sidecar
- Verificar se `SEMANTICA_REQUIRE_AUTH=true` em produção

### Erro 503 (Service Unavailable)
- Sidecar pode estar em startup (aguardar 30s)
- Verificar logs para erros de importação Python

### Latência alta (>500ms)
- Verificar cache hit rate em `/health` (deve ser > 40%)
- Verificar índices do Postgres: `psql -c "SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'semantica';"`
- Considerar aumentar `SEMANTICA_WORKERS` (default 2)

### Conflitos não detectados
- Executar manualmente: `POST /conflicts/detect` com `{ "tenantId": "xxx" }`
- Verificar se há nós duplicados: `GET /graph/nodes?tenantId=xxx`
- Em mock mode, conflitos são detectados apenas entre nós do tipo CHECKIN

### LGPD — Esquecimento de hóspede
```bash
curl -X POST http://127.0.0.1:7432/lgpd/forget-guest \
  -H "Content-Type: application/json" \
  -H "X-Semantica-Key: $SEMANTICA_API_KEY" \
  -d '{
    "guestId": "guest_123",
    "tenantId": "tenant_001",
    "reason": "user_request",
    "authorizedBy": "admin@seuzella.com"
  }'
```

## Backup e Restore

### Backup diário (cron na VPS)
```bash
# 02:30 diário
pg_dump --schema=semantica seuzella_prod | gzip > /backup/semantica-$(date +%Y%m%d).sql.gz
```

### Restore
```bash
gunzip < /backup/semantica-20260813.sql.gz | psql seuzella_prod
```

## Atualização do Semantica

### 1. Atualizar versão
```bash
cd /opt/semantica
source venv/bin/activate
pip install --upgrade semantica
```

### 2. Verificar compatibilidade
```bash
semantica doctor
```

### 3. Reiniciar sidecar
```bash
systemctl restart semantica
```

### 4. Validar endpoints
```bash
curl http://127.0.0.1:7432/health
```

## Rollback de Emergência

Se algo quebrar em produção:

### 1. Desativar no Next.js (instantâneo)
```bash
# Vercel env vars
USE_SEMANTICA_GRAPH=false
```
- Próximo deploy do Next.js vai ignorar o Semantica
- Fallback para `retrieveRelevantKnowledge` (TF-IDF/Gemini) é automático

### 2. Parar sidecar Python
```bash
systemctl stop semantica
```

### 3. Restaurar grafo (se corrompido)
```bash
gunzip < /backup/semantica-20260812.sql.gz | psql seuzella_prod
```

## Monitoramento

### Sentry
- Erros do sidecar aparecem em `sentry.io/organizations/seuzella/projects/semantica-sidecar/`
- Alertas para: `INTERNAL_ERROR`, `BAD_GATEWAY`, `GRAPH_INVALID`

### Prometheus + Grafana
- Dashboard "Semantica Sidecar" com:
  - Latência p50/p95/p99 por endpoint
  - Cache hit rate
  - Total de nós/arestas/decisões por tenant
  - Erro rate por status code

### Logs estruturados (structlog)
```bash
journalctl -u semantica -f --output=cat | jq .
```

## Performance

### Latência esperada
- **Health check**: < 5ms
- **Hybrid search (cache hit)**: < 50ms
- **Hybrid search (cache miss)**: 100-200ms
- **Record decision**: 50-100ms (async, não bloqueia)
- **Ingest (PDF 10 páginas)**: 5-15s (offline, cron)

### Capacidade
- **Concurrent requests**: 100/min por IP (rate limit)
- **Max nodes per tenant**: ~10.000 (recomendado)
- **Cache LRU**: 500 entries (Redis em prod)
- **Postgres connections**: 10 (pool)

## Segurança

### mTLS
- Certificados self-signed em `/opt/semantica/certs/`
- Renovação: cron mensal gera novo par
- CA própria: `ca.crt` assina `server.crt` e `client.crt`

### LGPD Compliance
- `forgetGuest()` marca nós como `forgotten=true` (não deleta)
- Decisões têm `scenario` anonimizado (mantém auditoria 5 anos)
- ConsentLog registra toda ação LGPD
- Backup inclui grafo (não pode ser perdido)

### Audit Trail
- Toda decisão tem ID único (UUID)
- Cadeia causal rastreável via `/decisions/{id}/trace`
- Export W3C PROV-O para auditor externo
