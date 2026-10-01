-- Migration: meta_tables_rls_wave13_pattern
-- ============================================================================
-- HARDENING — RLS para tabelas Meta tenant-scoped seguindo o padrão wave13.
--
-- Importante: a migration é idempotente quanto a tabelas/policies, mas NÃO
-- engole erros de DDL. Se RLS não puder ser criada em um PostgreSQL real,
-- a migration deve falhar para não deixar uma falsa sensação de isolamento.
-- Sem FORCE: preserva o padrão existente do projeto e o comportamento do
-- owner do pool Prisma.
-- MetaWebhookEvent permanece global por design e não recebe RLS.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_connections' AND schemaname = 'public'
    ) THEN
        ALTER TABLE "meta_connections" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "meta_connections_tenant_isolation" ON "meta_connections";
        CREATE POLICY "meta_connections_tenant_isolation"
            ON "meta_connections"
            USING ("tenantId" = current_setting('app.current_tenant_id', true));
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_attribution_events' AND schemaname = 'public'
    ) THEN
        ALTER TABLE "meta_attribution_events" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "meta_attribution_events_tenant_isolation" ON "meta_attribution_events";
        CREATE POLICY "meta_attribution_events_tenant_isolation"
            ON "meta_attribution_events"
            USING ("tenantId" = current_setting('app.current_tenant_id', true));
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_cost_logs' AND schemaname = 'public'
    ) THEN
        ALTER TABLE "meta_cost_logs" ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "meta_cost_logs_tenant_isolation" ON "meta_cost_logs";
        CREATE POLICY "meta_cost_logs_tenant_isolation"
            ON "meta_cost_logs"
            USING ("tenantId" = current_setting('app.current_tenant_id', true));
    END IF;
END $$;
