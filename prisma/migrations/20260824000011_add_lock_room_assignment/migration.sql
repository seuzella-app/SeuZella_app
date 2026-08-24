ALTER TABLE "lock_devices"
  ADD COLUMN "room_id" TEXT;

ALTER TABLE "lock_devices"
  ADD CONSTRAINT "lock_devices_room_id_fkey"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "lock_devices_tenant_room_id_key"
  ON "lock_devices"("tenant_id", "room_id");

CREATE INDEX "lock_devices_tenant_room_id_idx"
  ON "lock_devices"("tenant_id", "room_id");
