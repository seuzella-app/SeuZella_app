# CLAUDE.md — Seu Zélla Repository Guide

> **Versão:** V11 (Harness Engineering)
> **Raiz do projeto:** `/home/z/my-project/zella/`
> **Público:** Engenheiros, agentes de IA (Claude Code, Cursor, Cline), revisores de PR

Este arquivo orienta qualquer agente (humano ou IA) que precisa ler, modificar ou operar o repositório do Seu Zélla. Para detalhes estendidos (contratos de segurança, padrões de código por módulo, ADRs), veja `.claude/AGENTS.md`.

---

## 1. Resumo Arquitetural

O Seu Zélla é uma SaaS de hospitalidade multi-tenant que orquestra conversas de WhatsApp/Airbnb/Webchat com um cérebro de IA distribuído.

**Stack técnica canônica:**

| Camada | Tecnologia | Observações |
|--------|------------|-------------|
| App shell | Next.js 16 (App Router) | TypeScript estrito, sem `any` |
| ORM | Prisma 5 | Schema em `prisma/schema.prisma` (80 modelos, 990 campos) |
| DB dev | SQLite | `file:./dev.db` |
| DB prod | PostgreSQL | RLS multi-tenant obrigatório |
| LLM router | `ZaosNeuroRouter` (custom) | `src/lib/ai/zaos-neuro-router.ts` (1469 LoC, runtime) |
| LLM domain | `ZaosNeuroRouter` (math) | `src/domain/decision/services/ZaosNeuroRouter.ts` (testado) |
| Vector store | SQLite (atual) → Qdrant HNSW (P3) | Busca vetorial hoje é O(n) — gap conhecido |
| ML offline | DSPy MIPROv2, DPO/LoRA Qwen2.5-14B, GraphRAG | `src/lib/ml/*` — **MORTO em runtime, ativação é P1** |
| Observabilidade | Console logs → Langfuse (P1) | Hoje: `console.log`/`logSink.info` espalhados |
| Auth | NextAuth + ZCC admin + M2M EdDSA (P0) | 3 sistemas coexistem |

---

## 2. Ponto de Entrada Canônico do Cérebro

**Há UM entry point de inferência canônico:**

```
src/lib/ai/cognitive-router.ts → executeCognitivePipeline()
```

Chamado por:
- `src/lib/whatsapp-ai-responder.ts:534` (conversas WhatsApp)
- `src/app/api/brain/route.ts:57` (API HTTP direta)

**NUNCA chame LLM diretamente via:**
- ❌ `GlmCerebroService` (bypassa guardrails — migração em P0)
- ❌ `AgentOrchestrator` (100% morto — remoção em P0)
- ❌ LLM SDK direto (OpenAI/Gemini/Anthropic) sem passar pelo router

Se você precisa de inferência LLM em uma nova rota:
1. Importe `executeCognitivePipeline` de `@/lib/ai/cognitive-router`
2. Passe o `tenantId` e o `userMessage`
3. Receba `{ response, tools, traces, cost }`
4. Envolva a rota em `withSecurity({ auth: '...' })` de `@/lib/security/api-shield`

---

## 3. Convenções de Código

### 3.1 TypeScript

- **Estrito**, `noImplicitAny: true`, `strictNullChecks: true`
- ❌ Proibido `any` — use `unknown` + narrowing ou generics
- ✅ Funções fábrica para provedores: `getGlmCerebroService()`, `getCerebroMode()`
- ✅ Result<T, E> para falhas esperadas (ver `src/lib/types/result.ts`)
- ✅ Erros thrown apenas para casos realmente excepcionais (falhas de rede, bugs)

### 3.2 Prisma

- Uma transação por unidade de trabalho atômico: `prisma.$transaction(async (tx) => { ... })`
- Sempre filtre por `tenantId` em queries multi-tenant
- Use `select` em rotas que retornam JSON (evita vazamento de campos sensíveis)
- Schema é fonte da verdade — qualquer mudança exige `prisma migrate`

### 3.3 Estrutura de Diretórios

```
src/
├── app/                      # Next.js App Router (rotas, APIs)
│   ├── api/                  # API routes (REST-like)
│   │   ├── cron/             # Cron jobs (M2M auth obrigatório)
│   │   ├── brain/            # Cérebro Zélla (cognitive-router)
│   │   ├── zcc/              # Zélla Control Center (admin)
│   │   └── ddc/              # Discador / dashboard híbrido
│   └── (auth)/               # Páginas com NextAuth
├── lib/                      # Bibliotecas internas
│   ├── ai/                   # Cérebro runtime (cognitive-router, guardrails, RAG, tools)
│   ├── ml/                   # ML OFFLINE (DSPy, DPO, GraphRAG) — morto em runtime
│   ├── security/             # api-shield, cron-auth, sanitizers
│   ├── cerebro/              # Cérebro observability (anomaly, alert-bus, log-sink)
│   ├── brain/                # Orquestradores legados (agent-orchestrator MORTO)
│   └── db.ts                 # Prisma client singleton
├── domain/                   # Camada de domínio (math, decision, sem I/O)
│   └── decision/services/    # ZaosNeuroRouter matemático (testado)
└── __tests__/                # Testes de integração end-to-end
tests/                        # Testes unitários e de cenário
prisma/                       # Schema + migrations
scripts/                      # Scripts Python (DSPy, DPO, GraphRAG)
docs/                         # Documentação produto/legal/roadmap
```

### 3.4 Commits (Conventional Commits)

Formato obrigatório:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `ci`
**Scopes comuns:** `brain`, `security`, `prisma`, `cron`, `zcc`, `ddc`, `ml`, `harness`

Exemplos:
```
feat(security): adiciona M2M EdDSA para rotas cron (V11-P0)
fix(brain): corrige fallback de CompiledPrompt sem niche
refactor(ml): remove AgentOrchestrator morto (V11-P0)
test(security): canaries de RLS para PolicyAudit
chore(prisma): migration v11_p0_compiled_prompt_and_policy_audit
```

---

## 4. Invariantes de Segurança (Guardrails)

Estas regras **NÃO PODEM SER VIOLADAS** em nenhum PR:

| # | Invariante | Como garantir |
|---|------------|---------------|
| S1 | Nunca trafegar PII (CPF, CNPJ, telefone, email) em texto claro para LLM externo | Sanitize via `src/lib/security/sanitizers.ts` antes de qualquer chamada LLM |
| S2 | Toda rota API deve passar por `withSecurity()` | Import de `@/lib/security/api-shield`; exceções só com aprovação do Founder |
| S3 | Toda rota cron deve usar `verifyCronM2MToken()` | A partir de V11-P0; substitui o CRON_SECRET estático |
| S4 | Os 4 scanners de segurança devem rodar em cadeia em toda inferência | `src/lib/ai/whatsapp-guardrails.ts` (213 LoC) — não bypass |
| S5 | Toda query multi-tenant filtra por `tenantId` | Em Prisma: `where: { tenantId }` obrigatório |
| S6 | Tokens M2M nunca contêm claim `sub` | Verificação em `cron-auth.ts:152` |
| S7 | LoRA adapters nunca carregados em runtime sem feature flag | `USE_LORA_VLLM` env var (P1) |
| S8 | Logs nunca contêm payloads de usuário sem redação | Use `logSink.info({ redactedPayload })` |

---

## 5. Invariantes de Teste

| # | Invariante | Como garantir |
|---|------------|---------------|
| T1 | Testes circulares (assertam sobre dados que o próprio teste fabrica) são proibidos | Importar funções reais de `src/`, nunca redefinir dentro do test |
| T2 | Mocks `vi.fn()`/`jest.fn()` só para dependências externas (HTTP, DB) | Nunca mockar a função sob teste |
| T3 | Cobertura de `src/lib/ai/**` é obrigatória | `vitest.config.ts coverage.include` deve cobrir |
| T4 | Smoke tests que dependem de fallbacks hardcoded devem marcar `it.skipIf(mode === 'mock')` | Evitar falsos verdes |

---

## 6. Localização dos Arquivos Críticos

| Função | Arquivo | Linhas |
|--------|---------|--------|
| Entry point canônico do cérebro | `src/lib/ai/cognitive-router.ts` | 168 |
| Runtime wrapper do router | `src/lib/ai/zaos-neuro-router.ts` | 1469 |
| Guardrails WhatsApp (4 scanners) | `src/lib/ai/whatsapp-guardrails.ts` | 213 |
| RAG semântico (vector search) | `src/lib/ai/semantic-rag.ts` | 360 |
| Tool calling (929 LoC) | `src/lib/ai/tool-calling.ts` | 929 |
| Intent router | `src/lib/ai/intent-router.ts` | 326 |
| api-shield (withSecurity) | `src/lib/security/api-shield.ts` | ~200 |
| M2M cron auth (V11-P0) | `src/lib/security/cron-auth.ts` | novo |
| DSPy prompt compiler (morto) | `src/lib/ml/prompt-compiler.ts` | 60 |
| DPO collector (morto) | `src/lib/ml/dpo-collector.ts` | ~50 |
| GraphRAG (morto) | `src/lib/ml/graph-rag.ts` | 197 |
| Brain health optimizer (morto) | `src/lib/ml/brain-health-optimizer.ts` | 81 |
| Prisma schema | `prisma/schema.prisma` | 2048 |
| Vitest config | `vitest.config.ts` | ~30 |

---

## 7. Modo Mock vs Live

O sistema opera em 2 modos controlados por `getCerebroMode()` de `src/lib/cerebro/types.ts`:

- **`mock`**: não chama LLM, gera respostas sintéticas, não envia alertas. **Padrão em dev e CI.**
- **`live`**: chama LLM real, envia alertas reais. Só em prod com `CEREBRO_MODE=live`.

**Atenção:** qualquer PR que altere o cérebro deve ser testado em ambos os modos. Testes que dependem de LLM real devem marcar `it.skipIf(mode === 'mock')`.

---

## 8. Quando Em Dúvida

1. **Onde colocar X?** Veja a Seção 3.3 (estrutura de diretórios). Se ainda em dúvida, pergunte ao Founder.
2. **Como autenticar uma rota?** `withSecurity({ auth: 'nextauth' | 'zcc-admin' | 'cron-m2m' })`. Nunca invente um novo esquema.
3. **Como logar?** `logSink.info({ module, event, message, context })`. Nunca `console.log` direto em produção (ok em scripts/).
4. **Como testar?** Importe a função real, não mocke. Se a função tem I/O, use DB de teste ou `vi.mock('@/lib/db')`.
5. **Onde está o ML?** `src/lib/ml/*` — offline, morto em runtime. Ativação é Iniciativa P1 do V11.

---

## 9. Referências Rápidas

- **Volume 11 PDF:** `/home/z/my-project/download/Seu_Zella_Volume_11_Harness_Engineering.pdf` — 266 págs, plano P0→P3 completo
- **Migration P0:** `/home/z/my-project/download/v11_p0_staging/01_migration/`
- **Hotfix cron auth:** `/home/z/my-project/download/v11_p0_staging/02_cron_auth_hotfix/`
- **Worklog multi-agente:** `/home/z/my-project/worklog.md`
- **ADR de segurança:** ver Apêndice A do Volume 11 (8 ADRs)
