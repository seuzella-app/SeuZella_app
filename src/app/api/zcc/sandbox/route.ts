// ============================================================================
// Z-LAB — ZCC Sandbox Endpoint
// ============================================================================
// API para acionar simulações Z-Lab pelo painel ZCC.
//
// Endpoints:
//  GET  /api/zcc/sandbox                    — lista personas + test tenants
//  POST /api/zcc/sandbox?action=run         — executa simulação única
//  POST /api/zcc/sandbox?action=battery     — executa bateria completa
//  POST /api/zcc/sandbox?action=cleanup     — remove todos test tenants
//  POST /api/zcc/sandbox?action=cleanup-one — remove 1 test tenant específico
//
// Auth: verifyZCCAccessOrReject (admin Zélla apenas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { PERSONAS } from '@/lib/zlab/synthetic-guests';
import {
  runSimulation,
  runFullBattery,
  cleanupAllTestTenants,
  listTestTenants,
  type SimulationConfig,
} from '@/lib/zlab/simulator-service';
import { db } from '@/lib/db';

// ── GET: Lista personas e test tenants ─────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const testTenants = await listTestTenants();

    return NextResponse.json({
      success: true,
      data: {
        personas: PERSONAS.map(p => ({
          id: p.id,
          name: p.name,
          niche: p.niche,
          category: p.category,
          description: p.description,
          expectedBehavior: p.expectedBehavior,
          messagesCount: p.messages.length,
        })),
        testTenants,
        plans: ['gratuito', 'lite', 'pro', 'max', 'parceiro'],
      },
    });
  } catch (error) {
    console.error('[zcc/sandbox GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ── POST: Ações (run, battery, cleanup) ────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const body = await request.json().catch(() => ({}));

    switch (action) {
      case 'run': {
        const { niche, plan, personaId, messageDelayMs, skipCheckout } = body as {
          niche?: 'pousada' | 'airbnb';
          plan?: string;
          personaId?: string;
          messageDelayMs?: number;
          skipCheckout?: boolean;
        };

        if (!niche || !plan || !personaId) {
          return NextResponse.json(
            { error: 'niche, plan, personaId são obrigatórios no body' },
            { status: 400 }
          );
        }

        const config: SimulationConfig = {
          niche,
          plan: plan as SimulationConfig['plan'],
          personaId: personaId as SimulationConfig['personaId'],
          messageDelayMs,
          skipCheckout,
          // Server-side: usa relative path (sem baseUrl)
        };

        const report = await runSimulation(config);

        return NextResponse.json({
          success: true,
          message: `Simulação ${report.passed ? 'APROVADA' : 'REPROVADA'} — ${report.metrics.messagesSent} mensagens, ${report.metrics.totalDurationMs}ms`,
          report,
        });
      }

      case 'battery': {
        // Roda bateria completa com todas as personas
        const result = await runFullBattery();

        return NextResponse.json({
          success: true,
          message: `Bateria completa: ${result.summary.passed}/${result.summary.total} aprovadas`,
          summary: result.summary,
          reports: result.reports.map(r => ({
            personaId: r.config.personaId,
            personaName: r.tenantName,
            passed: r.passed,
            metrics: r.metrics,
            cleanupSuccess: r.cleanupResult.success,
          })),
        });
      }

      case 'cleanup': {
        // Remove todos test tenants
        const result = await cleanupAllTestTenants();

        return NextResponse.json({
          success: true,
          message: `${result.deleted} tenant(s) de teste removido(s)`,
          deleted: result.deleted,
          errors: result.errors,
        });
      }

      case 'cleanup-one': {
        // Remove 1 test tenant específico
        const { tenantId } = body as { tenantId?: string };

        if (!tenantId) {
          return NextResponse.json(
            { error: 'tenantId é obrigatório no body' },
            { status: 400 }
          );
        }

        const { db } = await import('@/lib/db');
        const tenant = await db.tenant.findUnique({
          where: { id: tenantId },
          select: { isTestTenant: true, name: true },
        });

        if (!tenant) {
          return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
        }

        if (!tenant.isTestTenant) {
          return NextResponse.json(
            { error: 'Este tenant NÃO é de teste — remoção bloqueada por segurança' },
            { status: 403 }
          );
        }

        await db.tenant.delete({ where: { id: tenantId } });

        return NextResponse.json({
          success: true,
          message: `Tenant de teste ${tenant.name} removido`,
        });
      }

      // ── RESET COMPLETO: zera os dados de teste (com trava de segurança P0 em produção) ──
      case 'reset': {
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_RESET !== 'true') {
          return NextResponse.json(
            { error: 'Reset bloqueado em ambiente de produção. Defina ALLOW_PROD_RESET=true na Vercel para autorizar.' },
            { status: 403 }
          );
        }

        const { cleanupAllTestTenants } = await import('@/lib/zlab/simulator-service');
        const result = await cleanupAllTestTenants();

        return NextResponse.json({
          success: true,
          message: `RESET CONCLUÍDO — ${result.deleted} tenant(s) limpos.`,
          result,
        });
      }

      // ── POPULATE: cria 10 tenants com fotos HD Unsplash, conversas, reservas e anomalias ──
      case 'populate': {
        const { populateSandboxData } = await import('@/lib/zlab/simulator-service');
        const result = await populateSandboxData();

        return NextResponse.json({
          success: true,
          message: `POPULATE COMPLETO — ${result.summary.totalTenants} tenants (5 pousadas com fotos HD, 5 Airbnbs, ${result.summary.totalConversations} conversas, ${result.summary.totalReservations} reservas e anomalias).`,
          summary: result.summary,
        });
      }

      default:
        return NextResponse.json(
          { error: `Action inválido: "${action}". Use ?action=run|battery|cleanup|cleanup-one|reset|populate` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[zcc/sandbox POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
