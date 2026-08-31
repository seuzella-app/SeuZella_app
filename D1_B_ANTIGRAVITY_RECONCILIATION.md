# D1-B ANTIGRAVITY RECONCILIATION REPORT

## 1. Contexto e Proveniência
- **Project Root**: `/Users/marciocau/SeuZella_project` [VERIFIED]
- **Git Root**: `/Users/marciocau/SeuZella_project` [VERIFIED]
- **Current Branch**: `wave/8-implementation-v3` [VERIFIED]
- **Current HEAD**: `4329a48949a607a1e85b1b9bd15817fe763cc0e3` [VERIFIED]
- **Baseline SHA**: `0d375afa3c122ccbf5449a94d84ff9573527aa45` [VERIFIED]
- **origin/main**: `0d375afa3c122ccbf5449a94d84ff9573527aa45` [VERIFIED]
- **Working Tree**: Limpa de modificações em arquivos rastreados [VERIFIED]

---

## 2. Reconciliação das Conclusões do GLM 5.2

| Conclusão Preliminar GLM 5.2 | Avaliação Antigravity | Evidência Concreta no Código |
|---|:---:|---|
| **`PaymentTransaction` não tem `tenantId` e é consultada via `db` global** | **VERIFIED** | `prisma/schema.prisma:754` e `src/app/api/checkout/pix-status/route.ts:24`. O modelo possui `subscriptionId String` sem `@relation` formal e sem coluna `tenantId`. |
| **`ConversationMessage` possui attack path em `/api/ddc/conversations/[id]/messages`** | **VERIFIED** *(e expandido)* | `src/app/api/ddc/conversations/[id]/messages/route.ts:23`: `findMany({ where: { conversationId } })` não valida se `conversationId` pertence ao `tenantId` autenticado. Em `POST` (L48), permite injeção arbitrária de mensagens. |
| **`ConversationMessage` possui vazamento cross-tenant em `/api/ddc/live-feed`** | **VERIFIED** *(NOVO ACHADO)* | `src/app/api/ddc/live-feed/route.ts:121`: o loop de SSE consulta `db.conversationMessage.findMany({ where: { createdAt: { gt: lastCheck } } })` e emite updates via SSE para o cliente sem filtrar `tenantId`. |
| **`GuestMessage` é scoped via `Guest.tenantId` sem attack path direto** | **VERIFIED** | Em `src/app/api/lgpd/forget-guest/route.ts:38`, `guestId` é validado previamente com `where: { id: guestId, tenantId: requestedTenantId }`. Não há endpoint público expondo `GuestMessage` por ID arbitrário. |

---

## 3. Classificação Forense dos Achados

### 3.1 [VERIFIED]
1. **`PaymentTransaction` (`schema.prisma:754`)**:
   - Tabela: `payment_transactions`
   - Campos: `id`, `subscriptionId`, `amount`, `status`, `paymentMethod`, `type`, `externalId`, `metadata`, `createdAt`, `updatedAt`.
   - Índices: Chave primária `id`. Não possui índice em `subscriptionId` ou `externalId`.
   - Relação: Possui chave estrangeira lógica `subscriptionId`, mas sem diretiva `@relation` com `Subscription`.
   - `TENANT_MODELS`: Presente no array em `src/lib/db/tenant-prisma.ts:17`.

2. **`ConversationMessage` (`schema.prisma:852`)**:
   - Tabela: `conversation_messages`
   - Campos: `id`, `conversationId`, `from`, `content`, `timestamp`, `read`, `metadata`, `createdAt`.
   - Relação: `conversation ConversationLog @relation(fields: [conversationId], references: [id], onDelete: Cascade)`.
   - Índices: `@@index([conversationId])`, `@@index([timestamp])`.
   - `TENANT_MODELS`: Presente no array em `src/lib/db/tenant-prisma.ts:15`.

3. **`GuestMessage` (`schema.prisma:768`)**:
   - Tabela: `guest_messages`
   - Campos: `id`, `guestId`, `from`, `content`, `timestamp`, `type`, `sentiment`, `intent`, `metadata`, `createdAt`.
   - Relação: `guest Guest @relation(fields: [guestId], references: [id], onDelete: Cascade)`.
   - Índices: `@@index([guestId])`, `@@index([timestamp])`.
   - `TENANT_MODELS`: Presente no array em `src/lib/db/tenant-prisma.ts:11`.

### 3.2 [CONTRADICTED]
- **Nenhum**. As premissas fundamentais do GLM 5.2 foram integralmente confirmadas no código físico.

### 3.3 [UNKNOWN]
- **Histórico de dados em produção**: Não é possível determinar sem acesso ao banco PostgreSQL de produção se existem linhas órfãs em `payment_transactions` (onde `subscriptionId` aponta para assinatura já deletada) antes de aplicar restrições de chave estrangeira.

---

## 4. Análise de Risco (RISK)

1. **Risco Crítico (IDOR/BOLA em Chat)**:
   - `/api/ddc/conversations/[id]/messages` (GET e POST) e `/api/ddc/live-feed` (POST e loop SSE) permitem leitura e injeção de mensagens entre tenants caso o atacante forneça um `conversationId` de outro tenant.
2. **Risco Médio (Inconsistência da Matriz Prisma)**:
   - Como `PaymentTransaction`, `ConversationMessage` e `GuestMessage` estão listados em `TENANT_MODELS`, se qualquer serviço tentar invocar `getTenantDb(prisma, tenantId)` nestes modelos, o Prisma lançará exceção em tempo de execução por inexistência da coluna `tenantId`.

---

## 5. Decisão Recomendada por Modelo

### 1. `ConversationMessage`
- **Decisão**: **ADD TENANT_ID VIA MIGRATION & BLINDAGEM DE ENDPOINTS**
- **Justificativa**:
  1. Adicionar `tenantId String` (ou `String?` com backfill seguro) no `prisma/schema.prisma` e `prisma/schema_ddc.prisma` com `@@index([tenantId])`.
  2. Blindar `/api/ddc/conversations/[id]/messages/route.ts` para verificar `where: { id: conversationId, tenantId }` no `ConversationLog` antes de listar ou criar mensagens.
  3. Blindar `/api/ddc/live-feed/route.ts` no `POST` (validando ownership) e no loop SSE (filtrando `conversation.tenantId === tenantId`).

### 2. `PaymentTransaction`
- **Decisão**: **ADD TENANT_ID VIA MIGRATION & FORMALIZAR @relation**
- **Justificativa**:
  1. Adicionar `tenantId String` em `payment_transactions` com `@@index([tenantId])` e `@@index([externalId])`.
  2. Adicionar `@relation(fields: [subscriptionId], references: [id], onDelete: Cascade)` para integridade referencial com `Subscription`.
  3. Simplificar `/api/checkout/pix-status/route.ts` para buscar diretamente por `where: { externalId: paymentId, tenantId }`.

### 3. `GuestMessage`
- **Decisão**: **MANTER INTOCADO NO D1-B (SEM ALTERAÇÃO DE SCHEMA)**
- **Justificativa**:
  1. O modelo é estritamente subordinado a `Guest` (`guestId`), onde todos os acessos já passam pela validação de `Guest.tenantId`.
  2. Não há attack path ativo identificado.
  3. Remove-se de `TENANT_MODELS` apenas se o objetivo for alinhar estritamente a matriz aos modelos com coluna `tenantId` nativa, ou adiciona-se `tenantId` em fase futura se houver necessidade de queries diretas desaninhadas.

---

## 6. Plano de Execução D1-B (Para Quando Autorizado)

### 6.1 Arquivos a Modificar
1. `prisma/schema.prisma` (Adicionar `tenantId` e índices em `PaymentTransaction` e `ConversationMessage`)
2. `prisma/schema_ddc.prisma` (Sincronizar schema DDC)
3. `src/app/api/ddc/conversations/[id]/messages/route.ts` (Validação de ownership de tenant)
4. `src/app/api/ddc/live-feed/route.ts` (Validação de tenant no POST e filtro no loop SSE)
5. `src/app/api/checkout/pix-status/route.ts` (Otimização da busca com tenant scoping direto)
6. `src/lib/whatsapp-ai-responder.ts` (Injeção de `tenantId` ao criar `ConversationMessage`)
7. `src/lib/payments/idempotency.ts` & `src/lib/payments/process-webhook.ts` (Injeção de `tenantId` ao criar `PaymentTransaction`)

### 6.2 Migrations Necessárias
- `20260901000005_add_tenant_id_to_messages_and_payments`

### 6.3 Testes a Criar/Modificar
1. `tests/security/conversation-messages-idor.test.ts` (Testar bloqueio cross-tenant em GET/POST de mensagens e live-feed)
2. `tests/security/payment-transaction-tenant.test.ts` (Testar isolamento de transações e pix-status)
3. `tests/security/tenant-isolation-matrix.test.ts` (Atualizar asserções da matriz de modelos)

---

## 7. Status da Sessão
- **Modo**: Read-Only / Zero Code Changes
- **Commits**: 0
- **Pushes**: 0
- **Documento gerado**: `/Users/marciocau/SeuZella_project/D1_B_ANTIGRAVITY_RECONCILIATION.md`
