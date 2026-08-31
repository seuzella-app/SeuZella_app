# C4_IMPLEMENTATION_STATE_REPORT
## SEU ZÉLLA — AUDITORIA TÉCNICA E PLANO DE EXECUÇÃO: C4 REFUND & CANCELLATION LIFECYCLE

**Data:** 27 de Agosto de 2026  
**Auditor/Executor:** Antigravity  
**Modo:** **INVESTIGAÇÃO TÉCNICA PRÉ-CODIFICAÇÃO (READ-ONLY)**  
**HEAD Base:** `b1c5b6d3` (`fix(auth): remove insecure magic verify endpoint`)  
**Branch:** `wave/8-implementation-v3`  

---

## 1. ESTADO GIT REAL
- **HEAD:** `b1c5b6d3`
- **Branch:** `wave/8-implementation-v3`
- **Working Tree:** Limpo (apenas arquivos untracked de documentação/patches).
- **Zero Push / Zero Merge / origin/main Intacta.**

---

## 2. MAPA DE ARQUIVOS ENVOLVIDOS NO C4

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| **Ledger de Reservas (Prisma)** | `prisma/schema.prisma` (`model Transaction`, `model Reservation`) | Registro histórico de lançamentos financeiros de reservas. |
| **Ledger de Pagamento de Reserva (SQL)**| `prisma/migrations/20260824000010_add_reservation_payments/migration.sql` (`reservation_payments`) | Tabela relacional de pagamentos de reservas com gateway IDs. |
| **SaaS Ledger (Prisma)** | `prisma/schema.prisma` (`model PaymentTransaction`, `model Subscription`) | Transações de assinaturas SaaS dos tenants. |
| **Efeitos de Pagamento de Reserva** | `src/lib/payments/reservation-payment-effects.ts` | Disparo de notificações e geração/revogação de PINs. |
| **Processador de Webhook de Reserva** | `src/lib/payments/process-reservation-webhook.ts` | Mutação financeira e automações sob lock postgres advisory. |
| **Processador Geral de Webhook** | `src/lib/payments/process-webhook.ts` | Roteador canônico (SaaS Subscription vs. Guest Reservation). |
| **Máquina de Estados Financeira** | `src/lib/finance/payment-state-machine.ts` | Matriz de transições permitidas (`VALID_TRANSITIONS`). |
| **Validador de Transição de Webhook** | `src/lib/payments/webhook-transition.ts` | Helper para normalização e validação de transições. |
| **Bridge de Notificações** | `src/lib/notifications/bridges.ts` | Tradutor de eventos de domínio para o catálogo de notificações. |
| **Produtor de Notificações** | `src/lib/notifications/producer.ts` & `catalog.ts` | Despacho de notificações tipadas no banco e push. |
| **Orquestrador de Fechaduras** | `src/lib/locks/orchestrator.ts` (`revokeReservationPins`) | Revogação de credenciais físicas em fechaduras inteligentes. |
| **Webhooks HTTP** | `src/app/api/webhooks/payment/route.ts` & `src/app/api/checkout/webhook/route.ts` | Endpoints de entrada pública sob assinatura HMAC e Idempotência C6. |

---

## 3. FLUXO FINANCEIRO REAL ATUAL

### 3.1 Assinaturas SaaS (`Subscription` + `PaymentTransaction`)
- `payment.created` / `invoice.paid`: Cria/atualiza `Subscription(status: 'active')` e cria `PaymentTransaction(status: 'approved')`.
- `payment.updated` (`refunded`): Atualiza `PaymentTransaction(status: 'refunded')` e `Subscription(paymentStatus: 'refunded')`.
- `subscription.canceled`: Atualiza `Subscription(status: 'canceled')` e suspende Tenant se confirmado.

### 3.2 Reservas de Hóspedes (`Reservation` + `reservation_payments` + `Transaction`)
- `event.status === 'approved'`:
  1. Insere/atualiza `reservation_payments(status: 'approved')`.
  2. Cria `Transaction` (`type: 'RESERVATION_PAYMENT:gateway'`, `amount: +X`, `status: 'COMPLETED'`).
  3. Dispara `createReservationPaymentConfirmationNotification`.
  4. Dispara `activateReservationAccess` (gera PIN na fechadura).
- `event.status === 'refunded'` / `'cancelled'` / `'rejected'` (**GAPS IDENTIFICADOS**):
  - ⚠️ Apenas atualiza `reservation_payments.status = 'refunded'`.
  - ❌ **NÃO** cria `Transaction` de estorno (`writeReversalTransaction` ausente).
  - ❌ **NÃO** chama `revokeReservationPins`.
  - ❌ **NÃO** dispara notificação de estorno.
  - ❌ **NÃO** valida se uma transição `REFUNDED` $\rightarrow$ `approved` fora de ordem deve ser bloqueada.

---

## 4. FLUXO DE RESERVA REAL E RELAÇÃO DE IDENTIFICADORES

- **Identificador do Evento Externo:** `event.providerEventId` (Asaas `payment.id` ou MP `payment_id`).
- **Identificador do Pagamento Gateway:** `event.gatewayPaymentId`.
- **Identificador de Negócio (Reserva):** `event.referenceId` mapeado para `Reservation.id`.
- **Identificador de Assinatura SaaS:** `event.subscriptionId` mapeado para `Subscription.id`.
- **Relação Contábil:**
  - `Reservation` possui relação 1:N com `Transaction` (`Transaction.reservationId`).
  - Um pagamento gera `Transaction(type: 'RESERVATION_PAYMENT:gateway', amount: +X)`.
  - Um estorno deve gerar `Transaction(type: 'RESERVATION_REFUND:gateway', amount: -X, status: 'REFUNDED')`.
- **Vínculo dos PINs com a Reserva:**
  - Modelo `LockCode` armazena `reservationId` e `tenantId`.
  - Função `revokeReservationPins({ tenantId, reservationId, reason })` busca todos os `LockCode` ativos onde `reservationId = X` e invoca `revokePin(code.id)`.

---

## 5. FLUXO DE NOTIFICAÇÃO REAL

- O catálogo (`src/lib/notifications/catalog.ts`) já define o evento `'payment.refunded'`:
  - `titleTemplate: 'Estorno processado'`
  - `messageTemplate: 'R$ {amount} estornado para {guestName}'`
- `src/lib/notifications/bridges.ts`: O método `bridgePaymentEvent` recebe `event.status: 'received' | 'failed' | 'overdue' | 'refunded'`, mas o `switch(event.status)` **não possui o branch `case 'refunded'`**, caindo em `default` com erro.

---

## 6. DIFERENÇAS ENTRE O RELATÓRIO GLM E O CÓDIGO REAL

1. **Idempotência C6:** O GLM relatava que `idempotency.ts` era "dead code" no baseline antigo `0d375afa`. No código real (`8e09697f`), ele já está implementado e acoplado nos webhooks com 10/10 testes PASS.
2. **P0 Auth `magic-verify`:** O GLM relatava como vulnerável. No código real (`b1c5b6d3`), a rota foi removida e testada (3/3 PASS).
3. **C4 Lifecycle Gaps:** Aqui o diagnóstico do GLM é **100% exato**:
   - `writeReversalTransaction` realmente não existe.
   - `revokeReservationPins` não está conectado aos webhooks de pagamento.
   - `validatePaymentWebhookTransition` existe em `webhook-transition.ts`, mas nunca é invocado em produção.
   - `bridgePaymentEvent` omite o `case 'refunded'`.

---

## 7. ARQUIVOS QUE PRECISAM SER MODIFICADOS

1. [`src/lib/payments/reservation-payment-effects.ts`](file:///Users/marciocau/SeuZella_project/src/lib/payments/reservation-payment-effects.ts):
   - Adicionar helper `writeReversalTransaction(tx, params)`.
   - Adicionar helper `createReservationRefundNotification(params)`.
2. [`src/lib/payments/process-reservation-webhook.ts`](file:///Users/marciocau/SeuZella_project/src/lib/payments/process-reservation-webhook.ts):
   - Acoplar `validatePaymentWebhookTransition` para descartar transições ilegais (`REFUNDED` $\rightarrow$ `approved`).
   - Implementar tratamento de `refunded` / `cancelled` / `chargeback`.
   - Chamar `writeReversalTransaction`.
   - Chamar `revokeReservationPins`.
   - Chamar `createReservationRefundNotification`.
3. [`src/lib/payments/process-webhook.ts`](file:///Users/marciocau/SeuZella_project/src/lib/payments/process-webhook.ts):
   - Integrar `validatePaymentWebhookTransition` para o fluxo de `Subscription`.
   - Tratar `refunded` no ciclo de vida de assinatura SaaS.
4. [`src/lib/notifications/producer.ts`](file:///Users/marciocau/SeuZella_project/src/lib/notifications/producer.ts):
   - Adicionar helper tipado `notifyPaymentRefunded`.
5. [`src/lib/notifications/bridges.ts`](file:///Users/marciocau/SeuZella_project/src/lib/notifications/bridges.ts):
   - Adicionar `case 'refunded'` chamando `notifyPaymentRefunded`.
6. [`tests/security/refund-cancellation-lifecycle.test.ts`](file:///Users/marciocau/SeuZella_project/tests/security/refund-cancellation-lifecycle.test.ts) (NOVO):
   - Suíte de 18 cenários adversariais do ciclo C4.

---

## 8. ARQUIVOS QUE NÃO DEVEM SER MODIFICADOS

- ❌ `src/lib/payments/idempotency.ts` (Motor C6 permanece intacto).
- ❌ `src/lib/auth/*` (Autenticação canônica permanece intacta).
- ❌ `src/lib/security/waf-middleware.ts` (WAF permanece intacto).
- ❌ `prisma/schema.prisma` (Estrutura de `Transaction` e `Reservation` já comporta perfeitamente lançamentos reversivos sem necessidade de breaking migrations).

---

## 9. RISCOS DE REGRESSÃO E MITIGAÇÕES

| Risco de Regressão | Mitigação Arquitetural |
|---|---|
| **Quebra de concorrência / Webhook Duplicate** | Manter `SELECT pg_advisory_xact_lock(...)` e `executeWithBillingIdempotency`. |
| **Eventos fora de ordem (`refunded` antes de `approved`)** | `validatePaymentWebhookTransition` detecta que não há pagamento aprovado prévio e registra o estorno sem criar reversão duplicada se `approved` chegar depois. |
| **Falha em hardware de fechadura impactar rollback financeiro** | Executar `revokeReservationPins` após o commit da transação do banco de dados (dentro de bloco `try/catch` seguro com notificação de fallback se falhar). |
| **Isolamento Multi-Tenant em PINs** | `revokeReservationPins` sempre recebe o `tenantId` autoritativo derivado do registro `Reservation` do banco de dados. |

---

## 10. ESTRATÉGIA DE TESTES

### Testes que devem permanecer 100% Verdes:
- `tests/security/magic-auth-regression.test.ts` (3/3)
- `tests/security/billing-idempotency.test.ts` (10/10)
- `tests/security/wave1-security-p0.test.ts` (16/16)
- `npx tsc --noEmit` (0 erros)
- `git diff --check` (0 erros)

### Novos Testes em `tests/security/refund-cancellation-lifecycle.test.ts`:
1. `approved` $\rightarrow$ `refunded` (cria lançamento de débito reversivo).
2. `refunded` $\rightarrow$ `approved` rejeitado (bloqueio determinístico de reativação).
3. `refunded` duplicado (idempotência via C6 e chave de transação).
4. `refund` com reserva revoga os PINs da respectiva reserva.
5. `refund` com reserva não revoga PINs de outros tenants.
6. `refund` dispara notificação via bridge.
7. `refund` parcial (suporte à reversão proporcional).
8. Tratamento de cancelamento de assinatura SaaS.

---

```text
================================================================================
STATUS:
INVESTIGAÇÃO TÉCNICA CONCLUÍDA / CÓDIGO INTACTO
AGUARDANDO AVALIAÇÃO E AUTORIZAÇÃO FORMAL DO SUPERVISOR PARA CODIFICAÇÃO DO LOTE 1.
================================================================================
```
