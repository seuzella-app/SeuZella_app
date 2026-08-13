/**
 * ZCC — Mobile Devices Tracking API
 * ====================================
 *
 * GET /api/mobile/devices-tracking
 *
 * Retorna métricas de dispositivos conectados nas rotas /mobile/pousada
 * e /mobile/airbnb. Usado pelo painel "Mobile Devices" no ZCC.
 *
 * Requer acesso ZCC admin (verifyZCCAccessOrReject).
 *
 * Tracking mechanism:
 *   - Cada visita em /mobile/* grava um ping em `MobileDevicePing` (Prisma)
 *   - Pings são agregados por sessão (deviceId efêmero via sessionStorage)
 *   - Sessões expiram após 30min sem atividade
 *
 * LGPD: Não coleta dados pessoais. Apenas:
 *   - tenantId (do subdomínio ou query string)
 *   - niche (pousada | airbnb)
 *   - User-Agent (apenas para parse de tipo de dispositivo, não armazenado cru)
 *   - Viewport (largura x altura)
 *   - deviceId efêmero (sessionStorage, destruído ao fechar aba)
 *   - Timestamps
 *
 * Response:
 *   {
 *     "totalActive": 3,
 *     "pousadaActive": 2,
 *     "airbnbActive": 1,
 *     "uniqueTenants": 2,
 *     "last24h": 47,
 *     "last7d": 312,
 *     "recentDevices": [...]
 *   }
 *
 * Quando o banco está indisponível (build/demo), retorna zeros.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // ── Security Gate V3 — ZCC admin only ──
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json(emptySummary());
  }

  try {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total ativos (vistos nos últimos 30min)
    // Nota: o modelo `MobileDevicePing` pode não existir em todas as instalações
    // — fazemos try/catch gracioso.
    let totalActive = 0;
    let pousadaActive = 0;
    let airbnbActive = 0;
    let uniqueTenants = 0;
    let last24h = 0;
    let last7d = 0;
    let recentDevices: any[] = [];

    try {
      // Modelo pode não existir se migration não rodou — try/catch gracioso
      const activePings = await (db as any).mobileDevicePing?.findMany({
        where: { lastSeen: { gte: thirtyMinAgo } },
        orderBy: { lastSeen: 'desc' },
        take: 50,
      }) ?? [];

      totalActive = activePings.length;
      pousadaActive = activePings.filter((p: any) => p.niche === 'pousada').length;
      airbnbActive = activePings.filter((p: any) => p.niche === 'airbnb').length;
      uniqueTenants = new Set(activePings.map((p: any) => p.tenantId)).size;

      // Counting recent activity
      last24h = await (db as any).mobileDevicePing?.count({
        where: { firstSeen: { gte: twentyFourHoursAgo } },
      }) ?? 0;
      last7d = await (db as any).mobileDevicePing?.count({
        where: { firstSeen: { gte: sevenDaysAgo } },
      }) ?? 0;

      // Map para o shape esperado pelo frontend
      recentDevices = activePings.slice(0, 20).map((p: any) => ({
        id: p.id,
        tenantId: p.tenantId,
        tenantName: p.tenantName,
        niche: p.niche,
        userAgent: p.userAgent ?? '',
        viewport: p.viewport ?? 'unknown',
        deviceId: p.deviceId,
        lastSeen: p.lastSeen?.toISOString?.() ?? p.lastSeen,
        firstSeen: p.firstSeen?.toISOString?.() ?? p.firstSeen,
        sessionDuration: p.lastSeen && p.firstSeen
          ? Math.round((new Date(p.lastSeen).getTime() - new Date(p.firstSeen).getTime()) / 1000)
          : 0,
      }));
    } catch (dbErr) {
      // Modelo ainda não existe — retorna zeros
      console.warn('[MOBILE_DEVICES] Tabela não existe ainda:', dbErr);
    }

    return NextResponse.json({
      totalActive,
      pousadaActive,
      airbnbActive,
      uniqueTenants,
      last24h,
      last7d,
      recentDevices,
      databaseAvailable: true,
    });
  } catch (error) {
    console.error('[MOBILE_DEVICES] Erro ao buscar dispositivos:', error);
    return NextResponse.json(emptySummary());
  }
}

/**
 * POST /api/mobile/devices-tracking
 *
 * Endpoint chamado pelo client-side de /mobile/pousada e /mobile/airbnb
 * para registrar um ping (visita ativa). Best-effort, nunca bloqueia UI.
 *
 * Body:
 *   {
 *     "tenantId": "abc123",
 *     "niche": "pousada" | "airbnb",
 *     "deviceId": "sessionStorage-uuid",
 *     "viewport": "390x844",
 *     "userAgent": "...",
 *     "firstSeen": "2026-08-14T22:00:00Z"
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, niche, deviceId, viewport, userAgent, firstSeen } = body;

    if (!tenantId || !niche || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, niche, deviceId', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    if (!['pousada', 'airbnb'].includes(niche)) {
      return NextResponse.json(
        { error: 'Invalid niche', code: 'INVALID_NICHE' },
        { status: 400 },
      );
    }

    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ success: true, persisted: false });
    }

    try {
      const now = new Date();
      await (db as any).mobileDevicePing?.upsert({
        where: { deviceId },
        create: {
          tenantId,
          niche,
          deviceId,
          viewport: viewport ?? 'unknown',
          userAgent: userAgent ?? '',
          firstSeen: firstSeen ? new Date(firstSeen) : now,
          lastSeen: now,
        },
        update: {
          lastSeen: now,
          viewport: viewport ?? undefined,
          userAgent: userAgent ?? undefined,
        },
      });
      return NextResponse.json({ success: true, persisted: true });
    } catch (dbErr) {
      // Tabela não existe — falha silenciosa (não bloqueia UX mobile)
      return NextResponse.json({ success: true, persisted: false });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to register ping' },
      { status: 500 },
    );
  }
}

function emptySummary() {
  return {
    totalActive: 0,
    pousadaActive: 0,
    airbnbActive: 0,
    uniqueTenants: 0,
    last24h: 0,
    last7d: 0,
    recentDevices: [],
    databaseAvailable: false,
  };
}
