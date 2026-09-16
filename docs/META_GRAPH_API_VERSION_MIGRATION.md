# META GRAPH API VERSION MIGRATION (Fase 2)

Onda: `feat/meta-zella-foundation`

## Estado atual

- **Versão ativa centralizada:** `META_GRAPH_API_VERSION` (env.ts, default `v23.0`).
- **Versão alvo controlada:** `v26.0` (mais recente lançada pela Meta).
- **Motivo da urgência:** a `v21.0` hardcoded em `whatsapp-send.ts` tem
  **encerramento pela Meta em janeiro/2027** — corrigida nesta onda.
- Fonte única de URL: `metaGraphUrl()` em `src/lib/meta/meta-config.ts`.
- Registry de versões: `GRAPH_API_VERSION_REGISTRY` (dados de configuração).

## Varredura realizada

| Arquivo | Antes | Depois |
|---|---|---|
| `src/lib/whatsapp-send.ts` | `graph.facebook.com/v21.0` hardcoded | `metaGraphUrl()` com versão centralizada |
| `src/lib/whatsapp/cloud-api.ts` | já centralizado (v23.0 via env) | preservado (referência do padrão) |
| `src/lib/zcc/mock-data.ts` | `v18.0` em payload de mock | preservado (dado de mock, não chamada de produção) |

Guard de regressão: `tests/meta/meta-foundation-certification.test.ts`
(nenhum `graph.facebook.com/vXX.0` hardcoded em `src/lib`/`src/app`).

## Plano de migração controlada v23.0 → v26.0

### Endpoints em uso

| Endpoint | Uso | Risco na troca | Teste necessário | Status |
|---|---|---|---|---|
| `POST /{phone_number_id}/messages` | envio WhatsApp (texto) | BAIXO — payload text é estável entre versões | envio real em staging com credenciais | APROVADO v23.0; v26.0 PENDENTE-DE-CREDENCIAL |
| `GET /debug_token` | health (HEAD leve) | MÍNIMO | reachability | preparado |
| `POST /{phone_number_id}/messages` (templates) | `whatsapp/cloud-api.ts` | BAIXO/MÉDIO — componentes de template variam | certificação de template por versão | MIGRAÇÃO FUTURA |

### Regras da migração

1. **Não trocar versão apenas para trocar.** A versão atual (v23.0) segue
   funcionando durante toda a transição.
2. Trocar = alterar **uma env** (`META_GRAPH_API_VERSION=v26.0`) — nenhum código.
3. Antes de trocar em produção: rodar a suíte `tests/meta/` + envio real de
   template de cada categoria em staging.
4. Se algum endpoint incompatível for descoberto: **NÃO quebrar produção** —
   registrar na tabela acima com `endpoint / versão atual / versão alvo /
   risco / teste necessário / status` e manter versão anterior.
5. Sunset conhecido: `v21.0 → 2027-01-27` (registry em meta-config.ts).

## Compatibilidade de componentes de template

Componentes (`header`/`body`/`button` com parâmetros `text`, `currency`,
`date_time`, `image`, `document`) são os mais sensíveis a mudanças de versão.
Validação obrigatória por versão antes da troca.

## Rollback

Reverter a env para a versão anterior — reversão imediata, sem deploy.
