-- Migration: v11_p0_policy_audit_and_compiled_prompt
-- Creates the policy_audit and compiled_prompts tables required by the
-- V11-P0 security canaries (tests/security/run-canaries.sh step [2/4]).
--
-- These tables back the models PolicyAudit and CompiledPrompt in
-- prisma/schema.prisma. They were previously only materialized via
-- `prisma db push` (dev mode); this migration promotes them to first-class
-- schema-managed tables so production deployments (which use migrate deploy)
-- also have them.

-- ── compiled_prompts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "compiled_prompts" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "niche"           TEXT,
    "version"         TEXT NOT NULL,
    "compiledJson"    TEXT NOT NULL,
    "promptText"      TEXT,
    "accuracyScore"   DOUBLE PRECISION,
    "successRate"     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "active"          BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compiled_prompts_pkey" PRIMARY KEY ("id")
);

-- Only one active prompt per (tenantId, niche) at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "compiled_prompts_tenant_niche_active_unique"
    ON "compiled_prompts" ("tenantId", "niche")
    WHERE "active" = true;

CREATE INDEX IF NOT EXISTS "compiled_prompts_tenant_version_idx"
    ON "compiled_prompts" ("tenantId", "version");

CREATE INDEX IF NOT EXISTS "compiled_prompts_niche_active_success_idx"
    ON "compiled_prompts" ("niche", "active", "successRate");

-- ── policy_audit ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "policy_audit" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "policyId"        TEXT NOT NULL,
    "policyVersion"   TEXT NOT NULL,
    "severity"        TEXT NOT NULL,
    "action"          TEXT NOT NULL,
    "source"          TEXT NOT NULL,
    "entry_point"     TEXT NOT NULL,
    "input_hash"      TEXT,
    "matched_rule"    TEXT,
    "matched_pattern" TEXT,
    "redacted_output" TEXT,
    "latency_ms"      INTEGER,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_audit_pkey" PRIMARY KEY ("id"),

    -- Severity must be one of the canonical V11-P0 severity levels.
    CONSTRAINT "policy_audit_severity_check"
        CHECK ("severity" IN ('info', 'notice', 'warning', 'error', 'critical', 'emergency')),

    -- Action must be one of the canonical V11-P0 enforcement actions.
    CONSTRAINT "policy_audit_action_check"
        CHECK ("action" IN ('allow', 'deny', 'transform', 'redact', 'escalate', 'block', 'log_only'))
);

CREATE INDEX IF NOT EXISTS "policy_audit_tenant_created_at_idx"
    ON "policy_audit" ("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "policy_audit_policy_severity_idx"
    ON "policy_audit" ("policyId", "severity");

CREATE INDEX IF NOT EXISTS "policy_audit_entry_point_created_at_idx"
    ON "policy_audit" ("entry_point", "createdAt");

-- ── RLS policies (Postgres only) ────────────────────────────────────────
-- Both tables are tenant-scoped. These policies are idempotent and only
-- applied when the current user is a PostgreSQL role with RLS enabled.
-- On SQLite (dev/test), RLS is not supported and these statements are
-- silently skipped by the DO block below.

DO $$
BEGIN
    -- compiled_prompts RLS
    IF current_database() IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'compiled_prompts' AND schemaname = 'public'
    ) THEN
        BEGIN
            ALTER TABLE "compiled_prompts" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            DROP POLICY IF EXISTS "compiled_prompts_tenant_isolation" ON "compiled_prompts";
            CREATE POLICY "compiled_prompts_tenant_isolation"
                ON "compiled_prompts"
                USING ("tenantId" = current_setting('app.current_tenant_id', true));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- policy_audit RLS
    IF current_database() IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'policy_audit' AND schemaname = 'public'
    ) THEN
        BEGIN
            ALTER TABLE "policy_audit" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            DROP POLICY IF EXISTS "policy_audit_tenant_isolation" ON "policy_audit";
            CREATE POLICY "policy_audit_tenant_isolation"
                ON "policy_audit"
                USING ("tenantId" = current_setting('app.current_tenant_id', true));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;
