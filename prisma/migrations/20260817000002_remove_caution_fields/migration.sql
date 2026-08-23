-- Migration: Remove campos de Caução PIX do Property
-- Data: 2026-08-17
-- Motivo: Caução removida do sistema Zélla.
--         Decisão: caução é responsabilidade pessoal do dono da pousada,
--         não faz parte do escopo do Seu Zélla.

ALTER TABLE "properties" DROP COLUMN IF EXISTS "caucaoHabilitada";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "caucaoValorPadrao";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "caucaoJanelaEstornoH";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "caucaoMensagemCustom";
