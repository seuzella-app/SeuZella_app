-- CreateTable: UpsellRecord
-- Comissão Zélla de 7% sobre valores extras por quarto (UPSELL)
-- Valores normais das diárias (dia a dia) têm ZERO taxa.
-- A Zélla cobra SOMENTE 7% sobre o valor do UPSELL sugerido pela IA.

CREATE TABLE "upsell_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT,
    "reservationId" TEXT,
    "guestId" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "comissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.07,
    "comissionAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "suggestedByZehla" BOOLEAN NOT NULL DEFAULT true,
    "feriado" TEXT,
    "temporada" TEXT,
    "yieldMultiplier" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',
    -- Behavioral Analytics (inspirado em WP Swings Upsell Order Bump)
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "acceptCount" INTEGER NOT NULL DEFAULT 0,
    "removeCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "totalSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- Conditional Triggers
    "triggerCartMin" DOUBLE PRECISION,
    "triggerCartMax" DOUBLE PRECISION,
    "triggerCategories" TEXT,
    "triggerProducts" TEXT,
    "triggerSeasons" TEXT,
    "triggerFeriados" TEXT,
    "triggerWeekdays" TEXT,
    "triggerHourStart" INTEGER,
    "triggerHourEnd" INTEGER,
    "triggerOncePerGuest" BOOLEAN NOT NULL DEFAULT true,
    -- Offer Scheduling
    "offerActive" BOOLEAN NOT NULL DEFAULT true,
    "offerStartAt" TIMESTAMP(3),
    "offerEndAt" TIMESTAMP(3),
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    -- Offer Display
    "offerTitle" TEXT,
    "offerDescription" TEXT,
    "offerImage" TEXT,
    "offerUrgencyText" TEXT,
    "offerBackgroundColor" TEXT DEFAULT '#10b981',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upsell_records_tenantId_idx" ON "upsell_records"("tenantId");
CREATE INDEX "upsell_records_tenantId_status_idx" ON "upsell_records"("tenantId", "status");
CREATE INDEX "upsell_records_tenantId_createdAt_idx" ON "upsell_records"("tenantId", "createdAt");
CREATE INDEX "upsell_records_tenantId_type_idx" ON "upsell_records"("tenantId", "type");
CREATE INDEX "upsell_records_roomId_idx" ON "upsell_records"("roomId");
CREATE INDEX "upsell_records_reservationId_idx" ON "upsell_records"("reservationId");
CREATE INDEX "upsell_records_status_paidAt_idx" ON "upsell_records"("status", "paidAt");
CREATE INDEX "upsell_records_offerActive_idx" ON "upsell_records"("offerActive");
CREATE INDEX "upsell_records_isSandbox_idx" ON "upsell_records"("isSandbox");

-- AddForeignKey
ALTER TABLE "upsell_records" ADD CONSTRAINT "upsell_records_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
