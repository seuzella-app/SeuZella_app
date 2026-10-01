-- Migration: add_lgpd_persistence
-- Creates lgpd_delete_requests and lgpd_incidents tables backing the
-- LgpdDeleteRequest and LgpdIncident Prisma models.
--
-- Replaces the in-memory stub in src/lib/lgpd/lgpd-service.ts that
-- returned the request object without persisting it (line 79 had the
-- comment "Em produção: salvar no banco — Por enquanto retorna o objeto").

-- ── lgpd_delete_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lgpd_delete_requests" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "guestId"         TEXT,
    "guestName"       TEXT,
    "guestEmail"      TEXT,
    "guestPhone"      TEXT,
    "reason"          TEXT NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "deletedTables"   TEXT[]   DEFAULT ARRAY[]::TEXT[],
    "certificateUrl"  TEXT,
    "dpoNotifiedAt"   TIMESTAMP(3),
    "requestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_delete_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lgpd_delete_requests_status_check"
        CHECK ("status" IN ('pending', 'processing', 'completed', 'refused'))
);

CREATE INDEX IF NOT EXISTS "lgpd_delete_requests_tenant_status_idx"
    ON "lgpd_delete_requests" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "lgpd_delete_requests_guest_email_idx"
    ON "lgpd_delete_requests" ("guestEmail");

CREATE INDEX IF NOT EXISTS "lgpd_delete_requests_status_requested_idx"
    ON "lgpd_delete_requests" ("status", "requestedAt");

-- Foreign key to tenants (deferred to allow tenant deletion cascade)
ALTER TABLE "lgpd_delete_requests"
    ADD CONSTRAINT "lgpd_delete_requests_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── lgpd_incidents ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "lgpd_incidents" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "incidentType"   TEXT NOT NULL,
    "severity"        TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "affectedGuests" INTEGER NOT NULL DEFAULT 0,
    "anpdReportId"   TEXT,
    "anpdNotifiedAt"  TIMESTAMP(3),
    "guestNotifiedAt" TIMESTAMP(3),
    "dpoNotifiedAt"   TIMESTAMP(3),
    "status"          TEXT NOT NULL DEFAULT 'open',
    "resolutionNotes" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_incidents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "lgpd_incidents_incident_type_check"
        CHECK ("incidentType" IN ('data_breach', 'unauthorized_access', 'leak', 'loss', 'other')),
    CONSTRAINT "lgpd_incidents_severity_check"
        CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT "lgpd_incidents_status_check"
        CHECK ("status" IN ('open', 'reported', 'resolved'))
);

CREATE INDEX IF NOT EXISTS "lgpd_incidents_tenant_status_idx"
    ON "lgpd_incidents" ("tenantId", "status");

CREATE INDEX IF NOT EXISTS "lgpd_incidents_severity_status_idx"
    ON "lgpd_incidents" ("severity", "status");

ALTER TABLE "lgpd_incidents"
    ADD CONSTRAINT "lgpd_incidents_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
