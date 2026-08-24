import { db } from '@/lib/db';

export async function assignLockToRoom(input: { tenantId: string; deviceId: string; roomId: string | null }): Promise<void> {
  const device = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "lock_devices"
    WHERE "id" = ${input.deviceId} AND "tenant_id" = ${input.tenantId}
    LIMIT 1
  `;
  if (!device[0]) throw new Error('LOCK_DEVICE_NOT_FOUND');

  if (input.roomId) {
    const room = await db.room.findFirst({ where: { id: input.roomId, tenantId: input.tenantId }, select: { id: true } });
    if (!room) throw new Error('ROOM_NOT_FOUND');
  }

  await db.$executeRaw`
    UPDATE "lock_devices"
    SET "room_id" = ${input.roomId}
    WHERE "id" = ${input.deviceId} AND "tenant_id" = ${input.tenantId}
  `;
}

export async function getLockForRoom(input: { tenantId: string; roomId: string }): Promise<{ deviceId: string } | null> {
  const result = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "lock_devices"
    WHERE "tenant_id" = ${input.tenantId}
      AND "room_id" = ${input.roomId}
      AND "status" = 'active'
    LIMIT 1
  `;
  return result[0] ? { deviceId: result[0].id } : null;
}
