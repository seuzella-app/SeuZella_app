/**
 * ZCC — Device Tracking API (Desktop + Mobile unified)
 * =====================================================
 *
 * POST /api/mobile/devices-tracking
 *   Registra um ping de sessão ativa (chamado pelos hooks useDevicePing
 *   em /ddc/* e /mobile/*). Best-effort, nunca bloqueia UI.
 *
 * GET /api/mobile/devices-tracking
 *   Retorna métricas completas para o painel "Mobile Analytics" no ZCC:
 *     - Dispositivos online agora (mobile vs desktop)
 *     - Comparação Desktop vs Mobile (24h, 7d, 30d)
 *     - Sessões ativas por nicho (pousada vs airbnb)
 *     - Heatmap por horário (24h) — quando os usuários acessam
 *     - Tendência 7 dias (gráfico de linha)
 *     - Top abas mais usadas (engajamento)
 *     - Insights automáticos (sugestões de melhoria)
 *     - Lista de dispositivos ativos (top 20)
 *
 * Requer acesso ZCC admin (verifyZCCAccessOrReject).
 *
 * LGPD: Não coleta dados pessoais.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────────────────────────────────────
// POST — registra um ping
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      tenantName,
      niche,
      route,
      isMobile,
      deviceId,
      viewport,
      userAgent,
      tabName,
      firstSeen,
    } = body;

    if (!tenantId || !niche || !deviceId || !route) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, niche, deviceId, route', code: 'MISSING_FIELDS' },
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
      // Upsert: se deviceId existe, atualiza lastSeen + incrementa pingCount;
      // senão cria novo registro
      const existing = await (db as any).devicePing?.findUnique({
        where: { deviceId },
        select: { id: true, pingCount: true, firstSeen: true },
      });

      if (existing) {
        await (db as any).devicePing?.update({
          where: { deviceId },
          data: {
            lastSeen: now,
            pingCount: (existing.pingCount ?? 0) + 1,
            viewport: viewport ?? undefined,
            userAgent: userAgent ?? undefined,
            tabName: tabName ?? undefined,
            // Não sobrescreve firstSeen — preserva o início da sessão
          },
        });
      } else {
        await (db as any).devicePing?.create({
          data: {
            tenantId,
            tenantName,
            niche,
            route,
            isMobile: Boolean(isMobile),
            deviceId,
            viewport: viewport ?? null,
            userAgent: userAgent ?? null,
            tabName: tabName ?? null,
            firstSeen: firstSeen ? new Date(firstSeen) : now,
            lastSeen: now,
            pingCount: 1,
          },
        });
      }
      return NextResponse.json({ success: true, persisted: true });
    } catch (dbErr) {
      // Tabela não existe — falha silenciosa
      return NextResponse.json({ success: true, persisted: false });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to register ping' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — métricas completas para o ZCC > Mobile Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json(emptyAnalytics());
  }

  try {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── 1. Online agora (visto nos últimos 30min) ──
    let onlineNow: any[] = [];
    let mobileActive = 0;
    let desktopActive = 0;
    let pousadaMobile = 0;
    let airbnbMobile = 0;
    let pousadaDesktop = 0;
    let airbnbDesktop = 0;
    let uniqueTenantsNow = 0;

    try {
      onlineNow = await (db as any).devicePing?.findMany({
        where: { lastSeen: { gte: thirtyMinAgo } },
        orderBy: { lastSeen: 'desc' },
        take: 100,
      }) ?? [];

      mobileActive = onlineNow.filter((p: any) => p.isMobile).length;
      desktopActive = onlineNow.filter((p: any) => !p.isMobile).length;
      pousadaMobile = onlineNow.filter((p: any) => p.isMobile && p.niche === 'pousada').length;
      airbnbMobile = onlineNow.filter((p: any) => p.isMobile && p.niche === 'airbnb').length;
      pousadaDesktop = onlineNow.filter((p: any) => !p.isMobile && p.niche === 'pousada').length;
      airbnbDesktop = onlineNow.filter((p: any) => !p.isMobile && p.niche === 'airbnb').length;
      uniqueTenantsNow = new Set(onlineNow.map((p: any) => p.tenantId)).size;
    } catch (e) {
      // tabela não existe
    }

    // ── 2. Volume 24h / 7d / 30d (total de sessões únicas) ──
    let last24h = 0, last7d = 0, last30d = 0;
    let mobile24h = 0, desktop24h = 0;
    let mobile7d = 0, desktop7d = 0;
    try {
      last24h = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: twentyFourHoursAgo } },
      }) ?? 0;
      last7d = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: sevenDaysAgo } },
      }) ?? 0;
      last30d = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: thirtyDaysAgo } },
      }) ?? 0;

      mobile24h = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: twentyFourHoursAgo }, isMobile: true },
      }) ?? 0;
      desktop24h = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: twentyFourHoursAgo }, isMobile: false },
      }) ?? 0;
      mobile7d = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: sevenDaysAgo }, isMobile: true },
      }) ?? 0;
      desktop7d = await (db as any).devicePing?.count({
        where: { firstSeen: { gte: sevenDaysAgo }, isMobile: false },
      }) ?? 0;
    } catch (e) {}

    // ── 3. Heatmap por horário (24h) — quantos acessos por hora ──
    const hourlyHeatmap: Array<{ hour: number; mobile: number; desktop: number; total: number }> = [];
    try {
      const allPings24h = await (db as any).devicePing?.findMany({
        where: { lastSeen: { gte: twentyFourHoursAgo } },
        select: { lastSeen: true, isMobile: true },
      }) ?? [];
      for (let h = 0; h < 24; h++) {
        const inHour = allPings24h.filter((p: any) => new Date(p.lastSeen).getHours() === h);
        hourlyHeatmap.push({
          hour: h,
          mobile: inHour.filter((p: any) => p.isMobile).length,
          desktop: inHour.filter((p: any) => !p.isMobile).length,
          total: inHour.length,
        });
      }
    } catch (e) {
      // preenche com zeros
      for (let h = 0; h < 24; h++) {
        hourlyHeatmap.push({ hour: h, mobile: 0, desktop: 0, total: 0 });
      }
    }

    // ── 4. Tendência 7 dias (sessões por dia) ──
    const dailyTrend7d: Array<{ date: string; mobile: number; desktop: number; total: number }> = [];
    try {
      const allPings7d = await (db as any).devicePing?.findMany({
        where: { firstSeen: { gte: sevenDaysAgo } },
        select: { firstSeen: true, isMobile: true },
      }) ?? [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const inDay = allPings7d.filter((p: any) => {
          const t = new Date(p.firstSeen).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        });

        dailyTrend7d.push({
          date: dayStart.toISOString().slice(0, 10),
          mobile: inDay.filter((p: any) => p.isMobile).length,
          desktop: inDay.filter((p: any) => !p.isMobile).length,
          total: inDay.length,
        });
      }
    } catch (e) {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dailyTrend7d.push({ date: d.toISOString().slice(0, 10), mobile: 0, desktop: 0, total: 0 });
      }
    }

    // ── 5. Top abas mais usadas (engajamento por aba) ──
    let topTabs: Array<{ tabName: string; count: number; avgSessionSec: number }> = [];
    try {
      const tabsRaw = await (db as any).devicePing?.findMany({
        where: { tabName: { not: null }, lastSeen: { gte: sevenDaysAgo } },
        select: { tabName: true, pingCount: true, firstSeen: true, lastSeen: true },
      }) ?? [];
      const byTab: Record<string, any[]> = {};
      for (const r of tabsRaw) {
        if (!r.tabName) continue;
        if (!byTab[r.tabName]) byTab[r.tabName] = [];
        byTab[r.tabName].push(r);
      }
      topTabs = Object.entries(byTab)
        .map(([tabName, rows]) => {
          const sessions = rows.length;
          const avgPings = rows.reduce((s, r) => s + (r.pingCount ?? 1), 0) / sessions;
          // Estimativa: 5min por ping (PING_INTERVAL_MS)
          const avgSessionSec = Math.round(avgPings * 5 * 60);
          return { tabName, count: sessions, avgSessionSec };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (e) {}

    // ── 6. Tempo médio de sessão (24h) ──
    let avgSessionSec24h = 0;
    let avgSessionSecMobile = 0;
    let avgSessionSecDesktop = 0;
    try {
      const recent = await (db as any).devicePing?.findMany({
        where: { firstSeen: { gte: twentyFourHoursAgo } },
        select: { pingCount: true, isMobile: true },
      }) ?? [];
      if (recent.length > 0) {
        const totalSec = recent.reduce(
          (s: number, r: any) => s + (r.pingCount ?? 1) * 5 * 60, 0
        );
        avgSessionSec24h = Math.round(totalSec / recent.length);

        const mobiles = recent.filter((r: any) => r.isMobile);
        const desktops = recent.filter((r: any) => !r.isMobile);
        if (mobiles.length > 0) {
          avgSessionSecMobile = Math.round(
            mobiles.reduce((s: number, r: any) => s + (r.pingCount ?? 1) * 5 * 60, 0) / mobiles.length
          );
        }
        if (desktops.length > 0) {
          avgSessionSecDesktop = Math.round(
            desktops.reduce((s: number, r: any) => s + (r.pingCount ?? 1) * 5 * 60, 0) / desktops.length
          );
        }
      }
    } catch (e) {}

    // ── 7. Insights automáticos (sugestões de melhoria) ──
    const insights = computeInsights({
      onlineNow: onlineNow.length,
      mobileActive,
      desktopActive,
      last24h,
      last7d,
      mobile24h,
      desktop24h,
      mobile7d,
      desktop7d,
      hourlyHeatmap,
      topTabs,
      avgSessionSec24h,
      avgSessionSecMobile,
      avgSessionSecDesktop,
    });

    // ── 8. Top dispositivos ativos agora ──
    const recentDevices = onlineNow.slice(0, 20).map((p: any) => ({
      id: p.id,
      tenantId: p.tenantId,
      tenantName: p.tenantName,
      niche: p.niche,
      route: p.route,
      isMobile: p.isMobile,
      userAgent: p.userAgent ?? '',
      viewport: p.viewport ?? 'unknown',
      deviceId: p.deviceId,
      tabName: p.tabName ?? null,
      pingCount: p.pingCount ?? 1,
      lastSeen: p.lastSeen?.toISOString?.() ?? p.lastSeen,
      firstSeen: p.firstSeen?.toISOString?.() ?? p.firstSeen,
      sessionDuration: p.lastSeen && p.firstSeen
        ? Math.round((new Date(p.lastSeen).getTime() - new Date(p.firstSeen).getTime()) / 1000)
        : 0,
    }));

    return NextResponse.json({
      // Online agora
      onlineNow: onlineNow.length,
      mobileActive,
      desktopActive,
      pousadaMobile,
      airbnbMobile,
      pousadaDesktop,
      airbnbDesktop,
      uniqueTenantsNow,
      // Volume
      last24h,
      last7d,
      last30d,
      mobile24h,
      desktop24h,
      mobile7d,
      desktop7d,
      // Comparação desktop vs mobile
      mobileShare24h: last24h > 0 ? Math.round((mobile24h / last24h) * 100) : 0,
      desktopShare24h: last24h > 0 ? Math.round((desktop24h / last24h) * 100) : 0,
      mobileShare7d: last7d > 0 ? Math.round((mobile7d / last7d) * 100) : 0,
      desktopShare7d: last7d > 0 ? Math.round((desktop7d / last7d) * 100) : 0,
      // Sessões
      avgSessionSec24h,
      avgSessionSecMobile,
      avgSessionSecDesktop,
      // Charts
      hourlyHeatmap,
      dailyTrend7d,
      topTabs,
      // Insights
      insights,
      // Lista
      recentDevices,
      databaseAvailable: true,
    });
  } catch (error) {
    console.error('[DEVICE_ANALYTICS] Erro:', error);
    return NextResponse.json(emptyAnalytics());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE INSIGHTS AUTOMÁTICOS
// ─────────────────────────────────────────────────────────────────────────────

interface InsightInput {
  onlineNow: number;
  mobileActive: number;
  desktopActive: number;
  last24h: number;
  last7d: number;
  mobile24h: number;
  desktop24h: number;
  mobile7d: number;
  desktop7d: number;
  hourlyHeatmap: Array<{ hour: number; mobile: number; desktop: number; total: number }>;
  topTabs: Array<{ tabName: string; count: number; avgSessionSec: number }>;
  avgSessionSec24h: number;
  avgSessionSecMobile: number;
  avgSessionSecDesktop: number;
}

export interface Insight {
  id: string;
  type: 'success' | 'warning' | 'critical' | 'info';
  category: 'engagement' | 'ux' | 'performance' | 'adoption' | 'peak_hours';
  title: string;
  description: string;
  recommendation: string;
  metric?: string;
}

function computeInsights(data: InsightInput): Insight[] {
  const insights: Insight[] = [];

  // 1. Preferência Desktop vs Mobile (24h)
  if (data.last24h >= 5) {
    const mobilePct = (data.mobile24h / data.last24h) * 100;
    const desktopPct = (data.desktop24h / data.last24h) * 100;
    if (mobilePct >= 70) {
      insights.push({
        id: 'mobile_dominant',
        type: 'info',
        category: 'adoption',
        title: 'Usuários preferem Mobile',
        description: `${Math.round(mobilePct)}% dos acessos nas últimas 24h vieram de dispositivos móveis. Pousadeiros estão usando mais o celular que o desktop.`,
        recommendation: 'Priorize melhorias de UX mobile (touch targets ≥44px, fontes legíveis no sol, performance 3G). Considere enviar pushes pelo WhatsApp ao invés de email.',
        metric: `${Math.round(mobilePct)}% mobile vs ${Math.round(desktopPct)}% desktop`,
      });
    } else if (desktopPct >= 70) {
      insights.push({
        id: 'desktop_dominant',
        type: 'info',
        category: 'adoption',
        title: 'Usuários preferem Desktop',
        description: `${Math.round(desktopPct)}% dos acessos nas últimas 24h vieram de desktop. Pousadeiros ainda usam mais computador que celular para gerenciar reservas.`,
        recommendation: 'Funcionalidades complexas (relatórios, planilha de preços) podem continuar no DDC desktop. Mobile pode ser mais focado em alertas e ações rápidas.',
        metric: `${Math.round(desktopPct)}% desktop vs ${Math.round(mobilePct)}% mobile`,
      });
    } else {
      insights.push({
        id: 'balanced_usage',
        type: 'success',
        category: 'adoption',
        title: 'Uso equilibrado Desktop/Mobile',
        description: `Distribuição saudável: ${Math.round(mobilePct)}% mobile vs ${Math.round(desktopPct)}% desktop nas últimas 24h. Os dois DDCs estão sendo usados.`,
        recommendation: 'Mantenha paridade de features entre Desktop e Mobile. Não deixe o mobile ficar atrás em funcionalidades críticas.',
        metric: `${Math.round(mobilePct)}% / ${Math.round(desktopPct)}%`,
      });
    }
  }

  // 2. Sessões muito curtas (bounce rate suspeita)
  if (data.avgSessionSec24h > 0 && data.avgSessionSec24h < 60) {
    insights.push({
      id: 'short_sessions',
      type: 'critical',
      category: 'engagement',
      title: 'Sessões muito curtas detectadas',
      description: `Tempo médio de sessão: ${Math.round(data.avgSessionSec24h)}s nos últimos 24h. Usuários estão abrindo e fechando o app em menos de 1 minuto — possível problema de UX.`,
      recommendation: 'Investigue onboarding inicial. O usuário encontra o que precisa rapidamente? Considere simplificar a primeira tela e adicionar um tutorial guiado.',
      metric: `${Math.round(data.avgSessionSec24h)}s médios`,
    });
  } else if (data.avgSessionSec24h >= 300) {
    insights.push({
      id: 'long_sessions',
      type: 'success',
      category: 'engagement',
      title: 'Sessões longas e engajadas',
      description: `Tempo médio de sessão: ${Math.round(data.avgSessionSec24h / 60)}min nos últimos 24h. Excelente engajamento — os pousadeiros estão usando a fundo.`,
      recommendation: 'Capitalize: peça reviews públicas, ofereça upsell para plano MAX, use esses pousadeiros como depoimentos.',
      metric: `${Math.round(data.avgSessionSec24h / 60)}min médios`,
    });
  }

  // 3. Mobile tem sessões muito mais curtas que desktop
  if (
    data.avgSessionSecMobile > 0 &&
    data.avgSessionSecDesktop > 0 &&
    data.avgSessionSecMobile < data.avgSessionSecDesktop * 0.5
  ) {
    insights.push({
      id: 'mobile_churn',
      type: 'warning',
      category: 'ux',
      title: 'Mobile tem sessões 50%+ curtas que Desktop',
      description: `Mobile: ${Math.round(data.avgSessionSecMobile / 60)}min vs Desktop: ${Math.round(data.avgSessionSecDesktop / 60)}min. Usuários desistem mais rápido no celular.`,
      recommendation: 'Verifique tempo de carregamento no 3G. Simplifique a aba "Visão Geral" mobile. Considere remover animações pesadas que afetam性能 mobile.',
      metric: `${Math.round(data.avgSessionSecMobile / 60)}min vs ${Math.round(data.avgSessionSecDesktop / 60)}min`,
    });
  }

  // 4. Detecção de horário de pico
  const peakHour = data.hourlyHeatmap.reduce(
    (max, h) => (h.total > max.total ? h : max),
    { hour: 0, total: 0 }
  );
  if (peakHour.total >= 3) {
    insights.push({
      id: 'peak_hour',
      type: 'info',
      category: 'peak_hours',
      title: `Pico de uso às ${String(peakHour.hour).padStart(2, '0')}h`,
      description: `Horário de pico detectado: ${String(peakHour.hour).padStart(2, '0')}h com ${peakHour.total} sessões ativas simultâneas.`,
      recommendation: 'Agende maintenance windows fora desse horário. Prepare auto-scaling da VPS para esse período. Envie campanhas de WhatsApp 30min antes do pico.',
      metric: `${peakHour.total} sessões às ${String(peakHour.hour).padStart(2, '0')}h`,
    });
  }

  // 5. Aba mais popular
  if (data.topTabs.length > 0) {
    const top = data.topTabs[0];
    const totalTabs = data.topTabs.reduce((s, t) => s + t.count, 0);
    const sharePct = totalTabs > 0 ? Math.round((top.count / totalTabs) * 100) : 0;
    insights.push({
      id: 'top_tab',
      type: 'info',
      category: 'engagement',
      title: `Aba "${top.tabName}" é a mais usada`,
      description: `${sharePct}% das sessões começam na aba "${top.tabName}" (${top.count} sessões em 7d). Tempo médio: ${Math.round(top.avgSessionSec / 60)}min.`,
      recommendation: 'Garanta que essa aba carregue instantaneamente (≤1s). Considere movê-la para a posição 0 no bottom nav.',
      metric: `${sharePct}% das sessões`,
    });

    // 6. Aba "fantasma" — menos de 5% de uso
    const bottom = data.topTabs[data.topTabs.length - 1];
    if (totalTabs > 0 && bottom.count / totalTabs < 0.05 && data.topTabs.length > 3) {
      insights.push({
        id: 'ghost_tab',
        type: 'warning',
        category: 'ux',
        title: `Aba "${bottom.tabName}" tem baixíssimo uso`,
        description: `A aba "${bottom.tabName}" representa apenas ${Math.round((bottom.count / totalTabs) * 100)}% das sessões em 7d. Possível feature morta ou mal posicionada.`,
        recommendation: 'Considere remover ou reposicionar essa aba. Verifique se os usuários entendem o que ela faz — pode ser problema de nomenclatura.',
        metric: `${Math.round((bottom.count / totalTabs) * 100)}% das sessões`,
      });
    }
  }

  // 7. Sem dados suficientes
  if (data.last7d < 10) {
    insights.push({
      id: 'low_data',
      type: 'info',
      category: 'adoption',
      title: 'Poucos dados para análise',
      description: `Apenas ${data.last7d} sessões registradas nos últimos 7 dias. Insights ficam mais precisos com mais dados.`,
      recommendation: 'Aguarde mais atividades dos pousadeiros ou incentive o uso via campanhas de WhatsApp.',
      metric: `${data.last7d} sessões / 7d`,
    });
  }

  // 8. Nenhum mobile ativo
  if (data.last7d >= 10 && data.mobile7d === 0) {
    insights.push({
      id: 'no_mobile_usage',
      type: 'warning',
      category: 'adoption',
      title: 'Nenhum acesso mobile em 7 dias',
      description: 'Apesar de termos tráfego desktop, nenhum pousadeiro acessou via mobile nos últimos 7 dias.',
      recommendation: 'Verifique se o link /mobile/pousada está sendo divulgado. Pode ser problema de UX mobile (testar em celular real) ou falta de conscientização dos usuários.',
      metric: `0 mobile vs ${data.desktop7d} desktop`,
    });
  }

  return insights;
}

function emptyAnalytics() {
  const emptyHourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h, mobile: 0, desktop: 0, total: 0,
  }));
  const empty7d = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), mobile: 0, desktop: 0, total: 0 };
  });
  return {
    onlineNow: 0,
    mobileActive: 0,
    desktopActive: 0,
    pousadaMobile: 0,
    airbnbMobile: 0,
    pousadaDesktop: 0,
    airbnbDesktop: 0,
    uniqueTenantsNow: 0,
    last24h: 0,
    last7d: 0,
    last30d: 0,
    mobile24h: 0,
    desktop24h: 0,
    mobile7d: 0,
    desktop7d: 0,
    mobileShare24h: 0,
    desktopShare24h: 0,
    mobileShare7d: 0,
    desktopShare7d: 0,
    avgSessionSec24h: 0,
    avgSessionSecMobile: 0,
    avgSessionSecDesktop: 0,
    hourlyHeatmap: emptyHourly,
    dailyTrend7d: empty7d,
    topTabs: [],
    insights: [],
    recentDevices: [],
    databaseAvailable: false,
  };
}
