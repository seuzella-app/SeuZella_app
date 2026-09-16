-- Migration: meta_tables_rls_wave13_pattern
-- ============================================================================
-- HARDENING — onda de correção/hardening (auditoria FASE 4):
-- Habilita RLS nas 3 tabelas Meta com tenantId, seguindo EXATAMENTE o padrão
-- já existente no projeto (migration 20260901000001 — compiled_prompts /
-- policy_audit; fundação wave13 20260902000000 — app.current_tenant_id()):
--
--   RLS ENABLE por tabela + POLICY USING ("tenantId" = current_setting(
--   'app.current_tenant_id', true)) — SEM FORCE (idem padrão v11-P0).
--
-- Por que SEM FORCE (mesma decisão do padrão existente): o pool do Prisma
-- conecta como owner da tabela e faz bypass de RLS sem FORCE — então as
-- queries atuais (isolamento na aplicação via tenant-context.ts) continuam
-- funcionando sem alteração. A policy torna-se ATIVA para qualquer role
-- não-owner que passe a usar a fundação wave13 (SET app.current_tenant_id).
-- A tabela de idempotência global (sem coluna de tenant, unique(eventKey))
-- NÃO recebe RLS: é global por design.
--
-- IDEMPOTENTE: DO $$ com EXISTS + EXCEPTION WHEN OTHERS THEN NULL — falha
-- silenciosa em banco não-PostgreSQL, igual ao padrão v11-P0.
-- Roadmap: docs/antigravity-roadmap/02-isolamento-multitenant.md §5.
-- ============================================================================

DO $$
BEGIN
    -- ── meta_connections ──────────────────────────────────────────────────
    IF current_database() IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_connections' AND schemaname = 'public'
    ) THEN
        BEGIN
            ALTER TABLE "meta_connections" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            DROP POLICY IF EXISTS "meta_connections_tenant_isolation" ON "meta_connections";
            CREATE POLICY "meta_connections_tenant_isolation"
                ON "meta_connections"
                USING ("tenantId" = current_setting('app.current_tenant_id', true));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- ── meta_attribution_events ───────────────────────────────────────────
    IF current_database() IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_attribution_events' AND schemaname = 'public'
    ) THEN
        BEGIN
            ALTER TABLE "meta_attribution_events" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            DROP POLICY IF EXISTS "meta_attribution_events_tenant_isolation" ON "meta_attribution_events";
            CREATE POLICY "meta_attribution_events_tenant_isolation"
                ON "meta_attribution_events"
                USING ("tenantId" = current_setting('app.current_tenant_id', true));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- ── meta_cost_logs ────────────────────────────────────────────────────
    IF current_database() IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_cost_logs' AND schemaname = 'public'
    ) THEN
        BEGIN
            ALTER TABLE "meta_cost_logs" ENABLE ROW LEVEL SECURITY;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            DROP POLICY IF EXISTS "meta_cost_logs_tenant_isolation" ON "meta_cost_logs";
            CREATE POLICY "meta_cost_logs_tenant_isolation"
                ON "meta_cost_logs"
                USING ("tenantId" = current_setting('app.current_tenant_id', true));
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;
