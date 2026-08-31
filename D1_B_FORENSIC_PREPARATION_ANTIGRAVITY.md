# D1-B FORENSIC PREPARATION — ANTIGRAVITY INVESTIGATION REPORT

## 1. Environment Snapshot
- **Project Root**: `/Users/marciocau/SeuZella_project`
- **Git Root**: `/Users/marciocau/SeuZella_project`
- **Current Branch**: `wave/8-implementation-v3`
- **Current HEAD**: `4329a48949a607a1e85b1b9bd15817fe763cc0e3`
- **Baseline SHA**: `0d375afa3c122ccbf5449a94d84ff9573527aa45`
- **origin/main**: `0d375afa3c122ccbf5449a94d84ff9573527aa45`
- **Working Tree**: Clean of tracked modifications (0 tracked diffs)
- **Stash**: 0 entries

## 2. Schema Evidence

### 2.1 Model: `PaymentTransaction`
- **Location**:
  - `prisma/schema.prisma`: lines 754–766
  - `prisma/schema_ddc.prisma`: lines 376–389
- **Table mapping**: `@@map("payment_transactions")`
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `subscriptionId`: `String` (Foreign key to `Subscription.id`)
  - `amount`: `Float`
  - `status`: `String` (e.g. `pending`, `approved`, `rejected`, `refunded`)
  - `paymentMethod`: `String` (e.g. `pix`, `cartao`)
  - `type`: `String?`
  - `externalId`: `String?` (Mercado Pago / Stripe transaction ID)
  - `metadata`: `String @default("{}")`
  - `createdAt`: `DateTime @default(now())`
  - `updatedAt`: `DateTime @updatedAt`
- **Direct `tenantId` column**: **NO** (Not present in schema)
- **Parent Relationship**: Belongs to `Subscription` via `subscriptionId`. `Subscription` HAS `tenantId: String` and relation to `Tenant`.

### 2.2 Model: `ConversationMessage`
- **Location**:
  - `prisma/schema.prisma`: lines 852–865
  - `prisma/schema_ddc.prisma`: lines 520–537
- **Table mapping**: `@@map("conversation_messages")`
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `conversationId`: `String` (Foreign key to `ConversationLog.id`)
  - `from`: `String` (e.g. `guest`, `ai`, `human`)
  - `content`: `String`
  - `timestamp`: `DateTime @default(now())`
  - `read`: `Boolean @default(false)`
  - `metadata`: `String @default("{}")`
  - `conversation`: `ConversationLog @relation(fields: [conversationId], references: [id], onDelete: Cascade)`
  - `createdAt`: `DateTime @default(now())`
- **Direct `tenantId` column**: **NO** (Not present in schema)
- **Parent Relationship**: Belongs to `ConversationLog` via `conversationId`. `ConversationLog` HAS `tenantId: String`.

### 2.3 Model: `GuestMessage`
- **Location**:
  - `prisma/schema.prisma`: lines 768–783
  - `prisma/schema_ddc.prisma`: lines 427–445
- **Table mapping**: `@@map("guest_messages")`
- **Fields**:
  - `id`: `String @id @default(cuid())`
  - `guestId`: `String` (Foreign key to `Guest.id`)
  - `from`: `String` (e.g. `guest`, `ai`, `human`)
  - `content`: `String`
  - `timestamp`: `DateTime @default(now())`
  - `type`: `String @default("text")`
  - `sentiment`: `String?`
  - `intent`: `String?`
  - `metadata`: `String @default("{}")`
  - `guest`: `Guest @relation(fields: [guestId], references: [id], onDelete: Cascade)`
  - `createdAt`: `DateTime @default(now())`
- **Direct `tenantId` column**: **NO** (Not present in schema)
- **Parent Relationship**: Belongs to `Guest` via `guestId`. `Guest` HAS `tenantId: String` and relation to `Tenant`.

---

## 3. Migration Evidence
- The underlying tables (`payment_transactions`, `conversation_messages`, `guest_messages`, `subscriptions`, `conversation_logs`, `guests`) were created in the baseline schema definitions.
- Later migrations (e.g. `20260824000010_add_reservation_payments`, `20260901000002_add_lgpd_persistence`) did not add a `tenantId` column to these three child message/transaction tables.

---

## 4. TENANT_MODELS Evidence (`src/lib/db/tenant-prisma.ts`)
In `src/lib/db/tenant-prisma.ts` lines 9–32:
- `'GuestMessage'` is present at index 6 (Line 11).
- `'ConversationMessage'` is present at index 21 (Line 15).
- `'PaymentTransaction'` is present at index 26 (Line 17).

**Key Discovery**: All 3 models are **ALREADY** included in the `TENANT_MODELS` array in `tenant-prisma.ts`.
However, none of these 3 models have a direct `tenantId` column in the Prisma schema (`prisma/schema.prisma`).

---

## 5. Full Reference Map in Codebase

### 5.1 `PaymentTransaction` References
- `src/lib/payments/idempotency.ts`:
  - `db.paymentTransaction.findFirst({ where: { externalId } })` (Read)
  - `tx.paymentTransaction.create({ data: { subscriptionId, amount, status, ... } })` (Create)
- `src/lib/payments/process-webhook.ts`:
  - `tx.paymentTransaction.findFirst({ where: { externalId: payment.id } })` (Read)
  - `tx.paymentTransaction.create({ data: { subscriptionId, amount, ... } })` (Create)
- `src/app/api/webhooks/payment/route.ts`:
  - `db.paymentTransaction.create(...)` and `db.paymentTransaction.update(...)`
- `src/app/api/checkout/pix-status/route.ts`:
  - `db.paymentTransaction.findFirst({ where: { externalId: paymentId } })` (Read)
- `src/app/api/checkout/create/route.ts`, `upgrade/route.ts`, `webhook/route.ts`:
  - Transaction creation and status updates during checkout.
- `src/app/api/cron/payment-overdue/route.ts`:
  - `db.paymentTransaction.findMany({ where: { status: 'pending' } })`
  - Explicit comment: `// Look up tenantId via subscription (PaymentTransaction has no direct tenantId)` followed by `db.subscription.findUnique({ where: { id: tx.subscriptionId } })`.

### 5.2 `ConversationMessage` References
- `src/lib/whatsapp-ai-responder.ts`:
  - Multiple `db.conversationMessage.create({ data: { conversationId, from, content, ... } })` invocations to record inbound/outbound chat history.
  - `db.conversationMessage.findMany({ where: { conversationId } })` to fetch chat context.
- `src/app/api/ddc/conversations/[id]/messages/route.ts`:
  - `db.conversationMessage.findMany({ where: { conversationId: id } })` (Read)
  - `db.conversationMessage.create({ data: { conversationId: id, from: 'human', content } })` (Create)
  - *Isolation*: Route first authenticates session and verifies that the `ConversationLog` belongs to the active tenant via `guard()` and `findFirst({ where: { id, tenantId } })`.
- `src/lib/cerebro/anomaly-detector.ts`:
  - `db.conversationMessage.findMany(...)` for throughput monitoring.
- `src/lib/cerebro/churn-predictor.ts`:
  - Line 250 explicitly documents: `* Usa ConversationLog (que tem tenantId direto) em vez de ConversationMessage.`

### 5.3 `GuestMessage` References
- `src/app/api/lgpd/forget-guest/route.ts`:
  - Scopes by `guest.tenantId` first, then updates: `db.guestMessage.updateMany({ where: { guestId: guest.id }, data: { content: '[REDACTED_LGPD]' } })`.
- `src/app/api/zcc/metrics/route.ts`:
  - `db.guestMessage.count({ where: { from: 'ai' } })` for global system metrics.
- `src/app/api/landing/contact/route.ts`:
  - `db.guestMessage.create({ data: { guestId: guest.id, from: 'contact_form', content } })`.
- `src/app/api/v1/guest/ddc/overview/route.ts`:
  - `prisma.guestMessage.findFirst({ where: { guestId: g.id } })` to obtain last guest message time.

---

## 6. Security Classification

| Model | Direct `tenantId` Column | Parent Scoping Mechanism | Security Rating | Rationale |
|---|:---:|---|:---:|---|
| **`PaymentTransaction`** | ❌ No | Scoped through `Subscription.tenantId` | **YELLOW** | Financial entity without direct `tenantId`; relies on `subscriptionId` or external payment IDs for tenant binding. Presence in `TENANT_MODELS` is technically dormant because caller uses global `db` client. |
| **`ConversationMessage`** | ❌ No | Scoped through `ConversationLog.tenantId` | **YELLOW** | Chat messages scoped by parent conversation ID. All mutation/read APIs authenticate `ConversationLog.tenantId` prior to querying messages. Presence in `TENANT_MODELS` is dormant because caller uses global `db` client. |
| **`GuestMessage`** | ❌ No | Scoped through `Guest.tenantId` | **YELLOW** | CRM messages scoped by parent `guestId`. LGPD and DDC routes bind through `Guest.tenantId`. Presence in `TENANT_MODELS` is dormant because caller uses global `db` client. |

---

## 7. Impact Analysis of Interception by Prisma Extension

If a caller executes `getTenantDb(prisma, tenantId)` directly on any of these 3 models:
- **`findMany`, `findFirst`, `findUnique`, `update`, `delete`, `count`**:
  `getTenantDb` injects `args.where.tenantId = tenantId`.
  Because `PaymentTransaction`, `ConversationMessage`, and `GuestMessage` do NOT have a `tenantId` field in `prisma/schema.prisma`, Prisma Client validation will throw a runtime error:
  `Unknown argument tenantId. Did you mean <foreign_key>?`
- **`create`, `createMany`, `upsert`**:
  `getTenantDb` injects `args.data.tenantId = tenantId`.
  Prisma Client will throw a validation error on mutation because `tenantId` is not in the model's `CreateInput` type.

**Current Runtime Status**:
Currently, NO caller in the codebase invokes `getTenantDb(prisma, tenantId)` on these 3 models directly. All existing queries use the unextended `db` client (`db.paymentTransaction`, `db.conversationMessage`, `db.guestMessage`) and scope through parent IDs (`subscriptionId`, `conversationId`, `guestId`).

---

## 8. Test Coverage
- **`tests/payments/reservation-idempotency-ledger.test.ts`**: Tests reservation idempotency and distinguishes subscription transactions.
- **`tests/security/lgpd-guest-tenant-binding.test.ts`**: Tests that `forget-guest` verifies `guest.tenantId` before updating `guestMessage`.
- **`tests/security/tenant-isolation-matrix.test.ts`**: Validates length of `TENANT_MODELS` (72 models).
- **`tests/security/tenant-idor-routes.test.ts` & `idor-c1-endpoints.test.ts`**: Tests conversation endpoint IDOR protection (`/api/ddc/conversations/[id]`).

---

## 9. Per-Model Recommendation

### 1. `PaymentTransaction`
- **Recommendation**: **REQUIRES DESIGN DECISION**
- **Options**:
  - *Option 1 (Schema Migration)*: Add `tenantId String?` to `payment_transactions` via Prisma migration so that `getTenantDb` can natively isolate it.
  - *Option 2 (Matrix Correction)*: Classify `PaymentTransaction` as a child entity of `Subscription` (similar to how relations work), removing it from direct `TENANT_MODELS` and scoping through `Subscription`.

### 2. `ConversationMessage`
- **Recommendation**: **REQUIRES DESIGN DECISION**
- **Options**:
  - *Option 1 (Schema Migration)*: Add `tenantId String?` to `conversation_messages` via Prisma migration.
  - *Option 2 (Matrix Correction)*: Keep tenant scoping at the `ConversationLog` root boundary, removing `ConversationMessage` from direct `TENANT_MODELS` to prevent invalid query injection.

### 3. `GuestMessage`
- **Recommendation**: **REQUIRES DESIGN DECISION**
- **Options**:
  - *Option 1 (Schema Migration)*: Add `tenantId String?` to `guest_messages` via Prisma migration.
  - *Option 2 (Matrix Correction)*: Keep tenant scoping at the `Guest` root boundary, removing `GuestMessage` from direct `TENANT_MODELS` to prevent invalid query injection.

---

## 10. Open Questions for Supervisor and GLM 5.2
1. Do we want to introduce Prisma database migrations to add `tenantId` columns directly to `payment_transactions`, `conversation_messages`, and `guest_messages`?
2. Or do we establish the architectural boundary that child/relational models (`ConversationMessage -> ConversationLog`, `GuestMessage -> Guest`, `PaymentTransaction -> Subscription`) inherit isolation from their parent models and should NOT be in the direct `TENANT_MODELS` array?

---

## 11. Files Inspected
- `prisma/schema.prisma`
- `prisma/schema_ddc.prisma`
- `src/lib/db/tenant-prisma.ts`
- `src/lib/payments/idempotency.ts`
- `src/lib/payments/process-webhook.ts`
- `src/app/api/cron/payment-overdue/route.ts`
- `src/app/api/webhooks/payment/route.ts`
- `src/app/api/ddc/conversations/[id]/messages/route.ts`
- `src/lib/whatsapp-ai-responder.ts`
- `src/lib/cerebro/anomaly-detector.ts`
- `src/lib/cerebro/churn-predictor.ts`
- `src/app/api/lgpd/forget-guest/route.ts`
- `src/app/api/zcc/metrics/route.ts`
- `tests/security/tenant-isolation-matrix.test.ts`
- `tests/security/lgpd-guest-tenant-binding.test.ts`

## 12. Commands Executed
- `git rev-parse --show-toplevel`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --short --untracked-files=all`
- `git diff --stat`
- `git diff --cached --stat`
- `git stash list`
- `shasum -a 256 D1_B_FORENSIC_PREPARATION_ANTIGRAVITY.md`
