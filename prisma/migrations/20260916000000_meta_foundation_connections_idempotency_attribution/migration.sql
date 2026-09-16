-- Meta Foundation wave (Fase 3 / 5 / 9 / 23)
-- Additive-only migration.

-- ── 1. meta_connections ─────────────────────────────────────────────────────
CREATE TABLE "meta_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "wabaId" TEXT,
    "businessAccountId" TEXT,
    "phoneNumberId" TEXT,
    "instagramAccountId" TEXT,
    "displayPhoneNumber" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "businessAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastWebhookAt" TIMESTAMP(3),
    "lastDeliveryAt" TIMESTAMP(3),
    "lastHealthCheckAt" TIMESTAMP(3),
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_connections_tenantId_wabaId_phoneNumberId_key"
  ON "meta_connections"("tenantId", "wabaId", "phoneNumberId");
CREATE INDEX "meta_connections_tenantId_idx" ON "meta_connections"("tenantId");
CREATE INDEX "meta_connections_connectionStatus_idx" ON "meta_connections"("connectionStatus");

-- Integridade referencial explícita para impedir registros Meta órfãos.
ALTER TABLE "meta_connections"
  ADD CONSTRAINT "meta_connections_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 2. meta_webhook_events (idempotência) ───────────────────────────────────
CREATE TABLE "meta_webhook_events" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_webhook_events_eventKey_key" ON "meta_webhook_events"("eventKey");
CREATE INDEX "meta_webhook_events_kind_externalEventId_idx"
  ON "meta_webhook_events"("kind", "externalEventId");
CREATE INDEX "meta_webhook_events_status_idx" ON "meta_webhook_events"("status");

-- ── 3. meta_attribution_events (Click-to-WhatsApp) ──────────────────────────
CREATE TABLE "meta_attribution_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT,
    "guestPhone" TEXT,
    "messageId" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "adId" TEXT,
    "entryPointType" TEXT NOT NULL DEFAULT 'unknown',
    "entryPointSource" TEXT,
    "entryPointSourceUrl" TEXT,
    "entryPointStartedAt" TIMESTAMP(3) NOT NULL,
    "entryPointExpiresAt" TIMESTAMP(3) NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNATTRIBUTED',
    "leadId" TEXT,
    "reservationId" TEXT,
    "reservationValue" DOUBLE PRECISION,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_attribution_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meta_attribution_events_tenantId_createdAt_idx"
  ON "meta_attribution_events"("tenantId", "createdAt");
CREATE INDEX "meta_attribution_events_conversationId_idx"
  ON "meta_attribution_events"("conversationId");
CREATE INDEX "meta_attribution_events_campaignId_idx"
  ON "meta_attribution_events"("campaignId");
CREATE INDEX "meta_attribution_events_entryPointExpiresAt_idx"
  ON "meta_attribution_events"("entryPointExpiresAt");

ALTER TABLE "meta_attribution_events"
  ADD CONSTRAINT "meta_attribution_events_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. meta_cost_logs — colunas aditivas Meta Pricing 2026 ─────────────────
ALTER TABLE "meta_cost_logs"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "billable" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "rate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'send_accepted';

CREATE INDEX IF NOT EXISTS "meta_cost_logs_messageId_idx" ON "meta_cost_logs"("messageId");
CREATE INDEX IF NOT EXISTS "meta_cost_logs_source_idx" ON "meta_cost_logs"("source");
