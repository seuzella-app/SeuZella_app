/**
 * CRON — Cérebro Night Audit (diário 03:00 BRT)
 * ==============================================
 *
 * Schedule: "0 6 * * *" (06:00 UTC = 03:00 BRT America/Sao_Paulo)
 *
 * Executa o Night Audit completo:
 *   1. Varredura de código (SAST) — vulnerabilidades e más práticas
 *   2. Coleta de métricas do dia (leads, cliques, conversões, regiões)
 *   3. Análise via GLM 5.2 (gera relatório executivo em PT-BR)
 *
 * Resultado é persistido em NightAuditReport e disponível no card
 * "Relatório Noturno" da Sala de Guerra (ZCC > Visão Geral).
 *
 * Auth: M2M EdDSA JWT via verifyCronM2MToken(scope='cerebro:write')
 * Dev bypass: header X-Zella-M2M-Dev-Bypass: cerebro:write (NODE_ENV=development)
 *
 * Idempotente: se já existe report para hoje, retorna sem re-executar.
 * Force re-run: POST com body { force: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { verifyCronM2MToken } from '@/lib/security/cron-auth';
import { NightAuditService } from '@/lib/cerebro/night-audit-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — Vercel Pro

export async function GET(request: NextRequest) {
  // ── Auth: verifyCronAuth (Onda 5H) ──
  const authResult = await verifyCronAuth(request, 'admin:all');
  if (!authResult.ok) {
    return authResult.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return runAudit(request);
}

export async function POST(request: NextRequest) {
  return runAudit(request);
}

async function runAudit(request: NextRequest) {
  const startTime = Date.now();

  // ── Auth M2M ──
  const auth = await verifyCronM2MToken(request, 'cerebro:write');
  if (!auth.ok) return auth.response;

  // ── Parse body (opcional: force re-run) ──
  let force = false;
  try {
    const body = await request.clone().json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch {}

  try {
    const result = await NightAuditService.run({ force });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      auditDate: result.auditDate,
      status: result.status,
      severity: result.severity,
      mode: result.mode,
      vulnCount: result.vulnFindings.length,
      vulnCounts: result.vulnCounts,
      metrics: {
        leadsCaptured: result.metrics.leadsCaptured,
        leadsConverted: result.metrics.leadsConverted,
        clicks: result.metrics.clicks,
        devicesActive: result.metrics.devicesMobile + result.metrics.devicesDesktop,
      },
      llmCostUsd: result.llmCostUsd,
      durationMs,
      completedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[CRON_NIGHT_AUDIT] Falha:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? String(err),
        durationMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
