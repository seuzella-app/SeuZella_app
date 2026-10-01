-- Migration: Add EXCLUDE constraint on reservations table (parallel to bookings)
-- Objective: Prevent double-reservation at PostgreSQL level for v1/reservations API
-- Risk: MEDIUM (constraint may reject existing overlapping data — pre-check needed)
-- Rollback: ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservation_no_overlap;

-- Step 1: btree_gist already installed in migration 20260901000005

-- Step 2: Pre-check for existing overlapping reservations
-- SELECT r1.id, r2.id, r1.room_id, r1.check_in, r1.check_out
-- FROM reservations r1, reservations r2
-- WHERE r1.id < r2.id
--   AND r1.room_id = r2.room_id
--   AND r1.tenant_id = r2.tenant_id
--   AND r1.status NOT IN ('cancelled', 'canceled', 'rejected')
--   AND r2.status NOT IN ('cancelled', 'canceled', 'rejected')
--   AND tstzrange(r1.check_in, r1.check_out, '[)') && tstzrange(r2.check_in, r2.check_out, '[)');

-- Step 3: Add EXCLUDE constraint
ALTER TABLE "reservations"
DROP CONSTRAINT IF EXISTS "reservation_no_overlap";

ALTER TABLE "reservations"
ADD CONSTRAINT "reservation_no_overlap"
EXCLUDE USING gist (
  "tenantId" WITH =,
  "roomId" WITH =,
  tstzrange("checkIn", "checkOut", '[)') WITH &&
)
WHERE (
  "status" NOT IN ('cancelled', 'canceled', 'rejected', 'CANCELLED')
);
