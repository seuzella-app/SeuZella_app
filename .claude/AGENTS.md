# AGENTS.md — Playbook Estendido de Engenharia

> **Versão:** V11 (Harness Engineering)
> **Localização alvo:** `.claude/AGENTS.md` (relativo à raiz do repo `/home/z/my-project/zella/`)
> **Público:** Agentes de IA (Claude Code, Cursor, Cline) + engenheiros onboarding

Este playbook é a referência profunda para codificação no Seu Zélla. O `CLAUDE.md` é o resumo; este é o detalhamento. Use-o para responder perguntas como "como implemento uma nova rota cron segura?" ou "como adiciono uma ferramenta ao cérebro?".

---

## 1. Padrões de Codificação por Módulo

### 1.1 Rotas API (`src/app/api/**`)

Toda rota API deve:

```typescript
// Padrão canônico
import { withSecurity } from '@/lib/security/api-shield';
import { NextRequest, NextResponse } from 'next/server';

export const GET = withSecurity(
  async (req: NextRequest, ctx: { tenantId: string; userId: string }) => {
    // ctx.tenantId e ctx.userId já resolvidos pelo withSecurity
    const data = await db.someModel.findMany({
      where: { tenantId: ctx.tenantId }, // FILTRO OBRIGATÓRIO
      select: { id: true, name: true },  // SELECT EXPLÍCITO
    });
    return NextResponse.json({ ok: true, data });
  },
  { auth: 'nextauth', rateLimit: { window: 60, max: 100 } }
);
```

**Regras:**
- `withSecurity` é obrigatório. Sem ele, a rota recebe tráfego sem auth, sem rate limit, sem payload scanner.
- `tenantId` sempre vem do `ctx` (extraído do token JWT), nunca do body.
- `select` é obrigatório em queries que retornam JSON — evita vazamento de campos.
- Rotas que modificam dados exigem `mutation: true` no config do `withSecurity`.

### 1.2 Rotas Cron (`src/app/api/cron/**`)

A partir de V11-P0, toda rota cron usa M2M EdDSA:

```typescript
import { verifyCronM2MToken, auditCronExecution } from '@/lib/security/cron-auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await verifyCronM2MToken(req, 'reports:read'); // scope obrigatório
  if (!auth.ok) return auth.response;
  const principal = auth.principal;

  const startTime = Date.now();
  try {
    // ... lógica do cron ...

    await auditCronExecution({
      prisma: db,
      tenantId: 'system',
      principal,
      entryPoint: 'glm_cerebro',
      policyId: 'cron:meu-job',
      severity: 'info',
      action: 'allow',
      latencyMs: Date.now() - startTime,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    await auditCronExecution({
      prisma: db,
      tenantId: 'system',
      principal,
      entryPoint: 'glm_cerebro',
      policyId: 'cron:meu-job',
      severity: 'critical',
      action: 'reject',
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
```

**Regras:**
- Scope deve ser o **mínimo necessário**: `cerebro:read`, `billing:read`, `reports:read`, `cerebro:write`
- Audit em PolicyAudit é obrigatório (sucesso E falha)
- TTL do token: 5 min — rotas que rodam mais que isso devem renovar
- Em dev, bypass via header `X-Zella-M2M-Dev-Bypass: <scope>` (apenas com `NODE_ENV=development` e sem chave configurada)

### 1.3 Bibliotecas de IA (`src/lib/ai/**`)

Toda função que chama LLM deve:

1. Passar pelo `executeCognitivePipeline` (entry point canônico)
2. Ou, se for uma ferramenta específica, registrar em `src/lib/ai/tool-calling.ts`
3. Aplicar os 4 scanners de `whatsapp-guardrails.ts` em cadeia
4. Logar em `logSink` com `module`, `event`, `latencyMs`, `costUsd`

**Anti-patterns:**
- ❌ Chamar `openai.chat.completions.create()` direto
- ❌ Chamar `GlmCerebroService` de fora do `cerebro/` ou `cron/`
- ❌ Construir prompts sem passar pelo `PromptBuilderV2` (que a partir de V11-P0 lerá de `CompiledPrompt`)

### 1.4 Bibliotecas ML (`src/lib/ml/**`)

- Hoje (V11-P0): mortas em runtime. Apenas scripts e testes.
- A partir de V11-P1: ativação gradual com feature flags:
  - `USE_DSPY_COMPILED_PROMPTS=true` → `PromptBuilderV2` lê de `CompiledPrompt`
  - `USE_LORA_VLLM=true` → `ZaosNeuroRouter` carrega adapter LoRA
  - `USE_GRAPHRAG=true` → `retrieveRelevantKnowledge` consulta `hybridGraphSearch`

**Regras:**
- Toda ativação de ML deve ter feature flag + fallback para caminho legado
- Logs de ML devem incluir `compiledVersion`, `accuracyScore`, `successRate` para rastreabilidade
- Falhas de ML NUNCA derrubam o request — sempre fallback

### 1.5 Bibliotecas de Segurança (`src/lib/security/**`)

- `api-shield.ts`: `withSecurity` HOF para rotas API
- `sanitizers.ts`: redação de PII (CPF, CNPJ, telefone, email, cartão)
- `cron-auth.ts` (V11-P0): M2M EdDSA para rotas cron
- `audit.ts`: log em `PolicyAudit` (a partir de V11-P0)

**Regras:**
- Novo scanner deve implementar interface `Scanner { scan(input): ScanResult }`
- Scanners rodam em cadeia, ordem definida em `whatsapp-guardrails.ts`
- Qualquer nova política deve ter YAML declarativo (P2 — `PolicyRegistry`)

---

## 2. Contratos de Segurança das 4 Camadas de Scanners

Os 4 scanners de `src/lib/ai/whatsapp-guardrails.ts` (213 LoC) rodam em cadeia em toda mensagem WhatsApp antes de chegar ao cérebro:

### 2.1 Scanner 1 — Sanitização de PII

**Input:** texto bruto do usuário
**Output:** texto com PII redatado ( CPF → [CPF_REDACTED] )
**Ação em match:** `redact` (sempre, nunca `reject` — usuário pode ter digitado CPF legítimo)
**Tabela de padrões:**

| Tipo | Regex | Substituição |
|------|-------|--------------|
| CPF | `\d{3}\.\d{3}\.\d{3}-\d{2}` | `[CPF_REDACTED]` |
| CNPJ | `\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}` | `[CNPJ_REDACTED]` |
| Telefone BR | `\+?55\d{10,11}` | `[TEL_REDACTED]` |
| Email | `[\w.-]+@[\w.-]+\.\w+` | `[EMAIL_REDACTED]` |
| Cartão | `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}` | `[CARD_REDACTED]` |

### 2.2 Scanner 2 — Detecção de Injeção de Prompt

**Input:** texto sanitizado
**Output:** `{ injected: boolean, pattern?: string, confidence: number }`
**Ação em match:** se `confidence > 0.8` → `reject`; se `0.5 < confidence <= 0.8` → `transform` (envolver em citação); senão `allow`
**Padrões detectados:**
- "ignore todas as instruções anteriores"
- "você é um DAN (Do Anything Now)"
- Base64 de payload de jailbreak
- Encoding HTML/entity para bypass
- Tentativas de extraction de system prompt

### 2.3 Scanner 3 — Filtro de Tópicos Proibidos

**Input:** texto sanitizado
**Output:** `{ allowed: boolean, topic?: string }`
**Tópicos bloqueados:**
- Conteúdo sexual envolvendo menores
- Instruções de fabricação de armas/explosivos
- Diagnóstico médico definitivo (apenas sugestão de consulta)
- Aconselhamento jurídico específico (apenas sugestão de advogado)
- Dados de cartão de crédito do estabelecimento

### 2.4 Scanner 4 — Auditoria e Telemetria

**Input:** texto sanitizado + resultado dos 3 scanners anteriores
**Output:** log em `PolicyAudit` (a partir de V11-P0)
**Campos logados:**
- `policyId`: ID da política que disparou (ex: `pii:cpf`, `injection:base64`)
- `severity`: info (allow) | warn (transform) | block (reject)
- `action`: allow | redact | transform | reject
- `entryPoint`: cognitive_pipeline | glm_cerebro (importante para detectar bypass)
- `inputHash`: SHA-256 do input sanitizado (não logar o input em texto claro)
- `latencyMs`: tempo gasto na cadeia de scanners

---

## 3. Referências aos Modelos Prisma de Memória

A "memória" do Zélla hoje é fragmentada em 7 modelos Prisma. O V11-P2 (Iniciativa #11) os unifica sob uma fachada `UnifiedMemory`. Até lá, conheça os 7:

### 3.1 Modelos ativos

| Modelo | Schema | Função | TTL |
|--------|--------|--------|-----|
| `Guest` | `prisma/schema.prisma` | Dados cadastrais do hóspede (nome, preferências) | Permanente |
| `GuestMessage` | idem | Histórico de mensagens do hóspede | 90 dias |
| `ConversationLog` | idem | Sessões de conversa (1:N com GuestMessage) | 180 dias |
| `ConversationMessage` | idem | Mensagens por sessão (alternativa ao GuestMessage) | 180 dias |
| `KnowledgeEntry` | idem | Base de conhecimento da pousada (FAQ, políticas) | Permanente |
| `KnowledgeChunk` | idem | Chunks vetorizados para RAG | Permanente |
| `Message` | idem | Mensagens genéricas (WhatsApp, webchat) | 90 dias |

### 3.2 Modelos ML (mortos em runtime, ativos em schema)

| Modelo | Schema | Função |
|--------|--------|--------|
| `CompiledPrompt` | `prisma/schema.prisma:2037` | Prompts otimizados pelo DSPy (V11-P0 extende com `niche`, `active`, `successRate`, `promptText`) |
| `DpoPreferencePair` | idem | Pares de preferência para treinar LoRA via `train_dpo.py` |
| `GraphNode` | idem | Nós do GraphRAG |
| `GraphEdge` | idem | Arestas do GraphRAG (SUPERSEDES, FORBIDS, REQUIRES, OVERLAPS) |
| `BrainHealthLog` | idem | Logs de saúde do cérebro para o `brain-health-optimizer` |

### 3.3 Modelos V11-P0 (novos)

| Modelo | Schema | Função |
|--------|--------|--------|
| `PolicyAudit` | novo | Auditoria dos 4 scanners + M2M auth (criado em V11-P0 migration) |

### 3.4 Padrão de acesso

```typescript
// SEMPRE filtre por tenantId em queries multi-tenant
const guests = await db.guest.findMany({
  where: { tenantId: ctx.tenantId },
  select: { id: true, name: true, preferences: true },
});

// NUNCA faça:
const allGuests = await db.guest.findMany(); // ❌ vaza dados cross-tenant
```

Em PostgreSQL prod (P2+), RLS deve reforçar isso no nível do banco:

```sql
SET app.current_tenant_id = '<tenant-uuid>';
-- Todas as queries subsequentes são automaticamente filtradas
```

---

## 4. Padrões de Teste

### 4.1 Estrutura de Teste

```
tests/
├── unit/                    # Testes de função isolada (sem DB, sem rede)
│   ├── sanitizers.test.ts
│   └── prompt-builder.test.ts
├── integration/             # Testes com DB de teste
│   ├── cognitive-router.test.ts
│   └── compiled-prompt.test.ts
├── scenario/                # Cenários end-to-end (mock mode)
│   ├── e2e-whatsapp-flow.test.ts
│   └── e2e-booking-reservation.test.ts
└── security/                # Testes de segurança (red team)
    ├── prompt-injection.test.ts
    ├── tenant-isolation.test.ts
    └── rls-canaries.test.ts
```

### 4.2 Anti-patterns (proibidos em V11+)

```typescript
// ❌ TESTE CIRCULAR — proibido
it('testa router', () => {
  const mockQueries = [...];  // fabrica dados
  let tier1 = 0;
  mockQueries.forEach(q => { if (q.type === 'X') tier1++; });
  expect(tier1).toBe(75);  // tautologia — 75 entradas X → 75
});

// ❌ SMOKE TEST INÚTIL — proibido
it('testa optimizer', async () => {
  const res = await checkAndOptimizePrompts('tenant_test');
  // Como brainHealthLog está vazia em dev, retorna hardcoded { optimizationTriggered: false }
  expect(res.optimizationTriggered).toBe(false); // sempre passa
});

// ✅ TESTE REAL — obrigatório
it('testa router com classe real', async () => {
  const router = new ZaosNeuroRouter({
    adapter: new InMemoryRouterStateAdapter(),
    budget: new BudgetGuard({ monthlyLimitUsd: 100 }),
    prng: seededLcg(42), // determinístico
  });
  const decision = await router.route({ tenantId: 't1', query: 'FAQ_REPETITIVA' });
  expect(decision.tier).toBe(1);
  expect(decision.provider).toBe('groq');
});
```

### 4.3 Cobertura

`vitest.config.ts` deve cobrir (a partir de V11-P0):

```typescript
coverage: {
  provider: 'v8',
  include: [
    'src/lib/ai/**',         // cérebro runtime
    'src/lib/security/**',   // api-shield, cron-auth, sanitizers
    'src/lib/cerebro/**',    // observability
    'src/lib/ml/**',         // ML (quando ativado)
    'src/lib/zcc-security.ts',
    'src/lib/message-bundler.ts',
  ],
  exclude: ['**/*.test.ts', '**/__mocks__/**'],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
  },
}
```

### 4.4 Canários pós-deploy

Toda migration de banco deve ter canários em `tests/security/rls-canaries.test.ts` (ver V11-P0 staging):

- Tenant A não pode ler dados do Tenant B
- Tenant A não pode escrever dados como Tenant B
- Query sem `tenantId` em filtro deve retornar 0 linhas (em modo RLS)

---

## 5. Padrões de Commit e PR

### 5.1 Tamanho de PR

- **Máximo 400 linhas** de diff (excluindo tests e migrations)
- Acima disso, quebrar em PRs menores
- Exceção: migrations Prisma podem ser maiores

### 5.2 Título do PR

```
[V11-P0] <type>(<scope>): <subject>
```

Exemplos:
- `[V11-P0] feat(security): M2M EdDSA para 3 rotas cron`
- `[V11-P0] chore(prisma): migration CompiledPrompt + PolicyAudit`
- `[V11-P0] docs(harness): CLAUDE.md + AGENTS.md`

### 5.3 Checklist de PR

- [ ] Tipagem estrita, sem `any`
- [ ] `withSecurity` em todas rotas API novas
- [ ] `verifyCronM2MToken` em todas rotas cron novas
- [ ] Queries multi-tenant filtram por `tenantId`
- [ ] Sem PII em texto claro em logs
- [ ] Testes importam funções reais (sem mocks de função sob teste)
- [ ] `npx tsc --noEmit` limpo
- [ ] `npx prisma validate` limpo
- [ ] `npm test` verde
- [ ] Worklog atualizado em `/home/z/my-project/worklog.md`

---

## 6. Roadmap V11 (resumo executivo)

| Fase | Período | Iniciativas | Status |
|------|---------|-------------|--------|
| P0 | Sem 1-2 | 1. User Harness (este arquivo) 2. Migration Prisma 3. Cron auth M2M 4. Remover AgentOrchestrator morto 5. Wire DSPy loader | ⏳ staging pronto |
| P1 | Mês 1-3 | 4. LoRA vLLM serving 5. GraphRAG integration 6. LLM-as-Judge CI 7. Langfuse observability | 🔜 após P0 merge |
| P2 | Mês 3-5 | 8. PolicyRegistry unificado 9. ReAct agent loop 10. MCP tool registry 11. UnifiedMemory facade | 🔜 após P1 |
| P3 | Mês 5-6 | 12. Qdrant HNSW 13. Prod trace replay 14. Meta-orchestrator | 🔜 após P2 |

Detalhes completos: `Seu_Zella_Volume_11_Harness_Engineering.pdf` (266 págs).

---

## 7. Glossário

| Termo | Definição |
|-------|-----------|
| **Cérebro Zélla** | O conjunto de serviços de IA conversacional do Seu Zélla |
| **Cognitive Router** | Entry point canônico do cérebro (`executeCognitivePipeline`) |
| **ZaosNeuroRouter** | Roteador de provedores LLM com Thompson Sampling multi-objetivo |
| **User Harness** | Camada declarativa configurável pelo dev (CLAUDE.md, AGENTS.md, playbooks) |
| **Tool Harness** | Camada interna da plataforma (context assembly, agent loop, guardrails) |
| **ML Decorativo** | Código ML implementado mas nunca chamado em runtime (DSPy, DPO, GraphRAG) |
| **Canário** | Teste automatizado que roda pós-deploy para validar invariantes em prod |
| **M2M** | Machine-to-Machine auth (sem usuário humano, via Client Credentials) |
| **EdDSA** | Algoritmo de assinatura Ed25519 (alternativa moderna a RSA/ECDSA) |
| **RLS** | Row-Level Security (PostgreSQL) — isolação multi-tenant no nível do banco |

---

## 8. Quando esse playbook muda

Este arquivo é versionado em git. Mudanças exigem:

1. PR com `[V11-Px] docs(harness): ...`
2. Aprovação do Founder
3. Atualização da versão no topo do arquivo
4. Worklog entry em `/home/z/my-project/worklog.md`

**Última atualização:** V11-P0 (criação inicial, baseada em auditoria forense do codebase)
