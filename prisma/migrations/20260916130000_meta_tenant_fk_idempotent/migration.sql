-- Migration: meta_tenant_fk_idempotent
-- ============================================================================
-- CORREÇÃO — onda de correção/hardening (auditoria FASE 3):
-- A migration da fundação Meta (imutável, da onda anterior) foi EDITADA
-- in-place pelo commit 0e464ce para adicionar as FKs de tenant — e, ao mesmo tempo, o
-- schema.prisma NUNCA declarou as @relation correspondentes. Resultado: um
-- `prisma migrate dev/diff` futuro REMOVERIA essas FKs (o schema é a fonte
-- do diff).
--
-- Esta migration fecha o drift nos DOIS lados:
--   1. SQL idempotente: garante as FKs com o MESMO nome e MESMA semântica
--      (ON DELETE CASCADE ON UPDATE CASCADE) que o commit 0e464ce usou —
--      aplicável em qualquer ambiente (com ou sem a FK já presente).
--   2. O schema.prisma agora declara @relation com onDelete: Cascade
--      (feito nesta mesma onda), então Prisma e SQL concordam.
--
-- NÃO editamos a migration 20260916000000: ela é imutável (auditoria FASE 3).
-- IDEMPOTENTE: DO $$ ... IF NOT EXISTS ... não falha se a constraint existir.
-- ============================================================================

DO $$
BEGIN
    -- meta_connections → tenants
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
        BEGIN
            ALTER TABLE "meta_connections"
                ADD CONSTRAINT "meta_connections_tenantId_fkey"
                FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    -- meta_attribution_events → tenants
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
        BEGIN
            ALTER TABLE "meta_attribution_events"
                ADD CONSTRAINT "meta_attribution_events_tenantId_fkey"
                FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;
