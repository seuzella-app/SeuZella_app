-- CreateTable
CREATE TABLE IF NOT EXISTS "billing_idempotency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "response" TEXT NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "billing_idempotency_key_key" ON "billing_idempotency"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "billing_idempotency_provider_eventId_idx" ON "billing_idempotency"("provider", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "billing_idempotency_status_idx" ON "billing_idempotency"("status");
