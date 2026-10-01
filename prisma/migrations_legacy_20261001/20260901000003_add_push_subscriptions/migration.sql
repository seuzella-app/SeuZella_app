-- Migration: add_push_subscriptions
-- Creates push_subscriptions table for web push (VAPID RFC 8030)

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "userId"       TEXT,
    "endpoint"     TEXT NOT NULL,
    "p256dhKey"    TEXT NOT NULL,
    "authKey"      TEXT NOT NULL,
    "userAgent"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "lastSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
    ON "push_subscriptions" ("endpoint");

CREATE INDEX IF NOT EXISTS "push_subscriptions_tenant_active_idx"
    ON "push_subscriptions" ("tenantId", "isActive");

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx"
    ON "push_subscriptions" ("userId");

ALTER TABLE "push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
