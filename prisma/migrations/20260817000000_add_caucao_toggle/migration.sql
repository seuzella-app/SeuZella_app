-- AlterTable: adiciona toggle de Caução PIX no Property
-- Permite que o dono/anfitrião habilite ou desabilite caução por hóspede.

ALTER TABLE "properties" ADD COLUMN "caucaoHabilitada" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "properties" ADD COLUMN "caucaoValorPadrao" DOUBLE PRECISION NOT NULL DEFAULT 200;
ALTER TABLE "properties" ADD COLUMN "caucaoJanelaEstornoH" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "properties" ADD COLUMN "caucaoMensagemCustom" TEXT;
