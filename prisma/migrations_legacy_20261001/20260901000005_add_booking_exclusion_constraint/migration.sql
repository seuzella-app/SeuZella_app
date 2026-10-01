-- CreateExtension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateExclusionConstraint on bookings
-- Ensures PostgreSQL strictly rejects overlapping booking date ranges for the same tenant and room
ALTER TABLE "bookings"
DROP CONSTRAINT IF EXISTS "booking_no_overlap";

ALTER TABLE "bookings"
ADD CONSTRAINT "booking_no_overlap"
EXCLUDE USING gist (
  "tenantId" WITH =,
  "roomName" WITH =,
  tstzrange("checkIn", "checkOut", '[)') WITH &&
)
WHERE (
  "status" NOT IN ('cancelled', 'canceled', 'rejected')
);
