CREATE TABLE "reservation_payments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "gateway" TEXT NOT NULL,
  "gateway_payment_id" TEXT NOT NULL,
  "provider_event_id" TEXT,
  "reference_type" TEXT NOT NULL DEFAULT 'reservation',
  "amount" DOUBLE PRECISION NOT NULL,
  "payment_method" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "checkout_url" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reservation_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reservation_payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reservation_payments_gateway_gateway_payment_id_key" ON "reservation_payments"("gateway", "gateway_payment_id");
CREATE UNIQUE INDEX "reservation_payments_gateway_provider_event_id_key" ON "reservation_payments"("gateway", "provider_event_id");
CREATE INDEX "reservation_payments_tenant_id_status_idx" ON "reservation_payments"("tenant_id", "status");
CREATE INDEX "reservation_payments_reservation_id_created_at_idx" ON "reservation_payments"("reservation_id", "created_at");
