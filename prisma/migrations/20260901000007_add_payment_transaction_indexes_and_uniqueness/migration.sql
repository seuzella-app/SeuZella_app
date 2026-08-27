-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_transactions_subscriptionId_idx" ON "payment_transactions"("subscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_transactions_externalId_idx" ON "payment_transactions"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_paymentMethod_externalId_key" ON "payment_transactions"("paymentMethod", "externalId");
