-- Migration: property_metadata_idempotent
-- ============================================================================
-- CORREÇÃO — onda de correção/hardening (auditoria FASE 3/6):
-- O modelo Property no schema.prisma NUNCA teve o campo `metadata`, mas o
-- código de produção lê/escreve nele há meses:
--   - src/app/api/ddc/onboarding-wizard/route.ts   (escreve JSON.stringify)
--   - src/app/api/ddc/personality/route.ts         (lê JSON.parse)
--   - src/app/api/cron/housekeeping-dispatch/route.ts (lê JSON.parse)
--   - src/lib/whatsapp-ai-responder.ts             (lê — bug mascarado por
--     @ts-nocheck, corrigido nesta mesma onda)
-- O contrato do código é SEMPRE string JSON (JSON.parse/JSON.stringify) —
-- por isso a coluna é TEXT, e NÃO JSONB/Json do Prisma.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS é seguro em qualquer ambiente —
-- aplica se a coluna não existir; não faz nada se já existir (ex.: base
-- provisionada por db push de um schema alternativo).
-- ============================================================================

ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "metadata" TEXT;
