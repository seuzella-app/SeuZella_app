-- Migration: meta_tenant_fk_idempotent
-- ============================================================================
-- Fecha o drift entre schema.prisma e as FKs tenant das tabelas Meta.
-- Idempotente quanto à existência das tabelas/constraints, mas sem engolir
-- erros de DDL: se uma FK não puder ser criada, a migration deve falhar.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_connections' AND schemaname = 'public'
    ) AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'tenants' AND schemaname = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'meta_connections_tenantId_fkey'
    ) THEN
        ALTER TABLE "meta_connections"
            ADD CONSTRAINT "meta_connections_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'meta_attribution_events' AND schemaname = 'public'
    ) AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_tables
        WHERE tablename = 'tenants' AND schemaname = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'meta_attribution_events_tenantId_fkey'
    ) THEN
        ALTER TABLE "meta_attribution_events"
            ADD CONSTRAINT "meta_attribution_events_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
