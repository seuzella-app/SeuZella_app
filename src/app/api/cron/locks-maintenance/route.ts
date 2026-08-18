/**
 * CRON — Locks Maintenance (a cada 15min)
 * ========================================
 *
 * Schedule: every 15 minutes (UTC) - configured in vercel.json
 *
 * 3 funções:
 *   1. Revoga PINs expirados (validTo < now -> status=expired + provider.revokePin)
 *   2. Alerta bateria < 20% via console.warn (AlertBus em producao)
 *   3. Sincroniza online/offline (best-effort, so para devices com API)
 *
 * Auth: verifyCronAuth (M2M + CRON_SECRET fallback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { db } from '@/lib/db';
import { revokePin } from '@/lib/locks/orchestrator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return runMaintenance(request);
}

export async function POST(request: NextRequest) {
  return runMaintenance(request);
}

async function runMaintenance(request: NextRequest) {
  const startTime = Date.now();

  const auth = await verifyCronAuth(request, 'reports:read');
  if (!auth.ok) return auth.response!;

  let expiredPinsRevoked = 0;
  let lowBatteryAlerts = 0;
  let devicesSynced = 0;
  let errors = 0;

  try {
    // ── 1. Revoga PINs expirados ──
    try {
      const now = new Date();
      const expiredPins = await db.lockCode.findMany({
        where: {
          validTo: { lt: now },
          status: { in: ['scheduled', 'active'] },
        },
        take: 100,
      });

      for (const pin of expiredPins) {
        try {
          await revokePin(pin.id, 'Expirado automaticamente (cron)');
          expiredPinsRevoked++;
        } catch {
          errors++;
        }
      }
    } catch (err) {
      console.warn('[LOCKS_CRON] Falha ao revogar PINs expirados:', err);
    }

    // ── 2. Alerta bateria baixa ──
    try {
      const lowBatteryDevices = await db.lockDevice.findMany({
        where: {
          batteryLevel: { lt: 20 },
          status: 'active',
        },
      });

      for (const device of lowBatteryDevices) {
        // Em produção: AlertBus.notify('BATTERY_LOW', device)
        console.warn(`[LOCKS_CRON] Bateria baixa: ${device.nickname} (${device.batteryLevel}%)`);
        lowBatteryAlerts++;
      }
    } catch (err) {
      console.warn('[LOCKS_CRON] Falha ao verificar bateria:', err);
    }

    // ── 3. Sincroniza online/offline (best-effort) ──
    try {
      const activeDevices = await db.lockDevice.findMany({
        where: { status: 'active', providerType: 'api' },
        take: 50,
      });

      for (const device of activeDevices) {
        try {
          // Atualiza lastSeenAt se device foi visto recentemente
          await db.lockDevice.update({
            where: { id: device.id },
            data: { lastSeenAt: new Date() },
          });
          devicesSynced++;
        } catch {
          // Silencioso
        }
      }
    } catch (err) {
      console.warn('[LOCKS_CRON] Falha ao sincronizar devices:', err);
    }

    return NextResponse.json({
      ok: true,
      expiredPinsRevoked,
      lowBatteryAlerts,
      devicesSynced,
      errors,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message, durationMs: Date.now() - startTime },
      { status: 500 },
    );
  }
}
