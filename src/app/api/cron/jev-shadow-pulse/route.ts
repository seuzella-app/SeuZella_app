// ============================================================================
// JEV — Rota de cron: pulso shadow do Cérebro (RUN27-A — USO REAL NO CRON)
// ============================================================================
// Rota NOVA e ADITIVA (nada existente é editado) que dá o USO REAL ao ciclo
// shadow (RUN26-A) dentro do fluxo de cron da casa — seguindo o padrão das
// rotas irmãs (dynamic force-dynamic + maxDuration curto, ver shapes-2 da
// RUN26-A em 99_AUDITS/JEV_WIRING_*/JEV_WIRING_SHAPES.md).
//
// Auth: requireInternalSecret (internal-secret, RUN19-A) — módulo da casa de
// auth de cron/webhook cuja assinatura veio EXATA nas shapes-2
// ((req: unknown) => Response | null). A resposta de recusa da casa é
// devolvida INTACTA. (verifyCronAuth/verifyCronM2MToken das rotas irmãs não
// vieram nas shapes-2 — NUNCA adivinhar assinatura interna; lição RUN25-A.)
//
// Gates do pulso (ordem fail-closed, ver jev-cerebro-cron-pulse.ts):
//   ?src= ausente => inerte | fonte recusada => inerte | budget => skip |
//   fusível (sonda) indisponível/aberto => skip | ciclo com teto de tempo.
//
// Uso real (decisão do DONO): gerar o export JSONL (docs/JEV_CRON.md) e
// chamar esta rota com ?src=<caminho absoluto do .jsonl> (5 MB / 10k linhas).
// Sem ?src= o pulso é INERTE por construção — nada roda sem opt-in.
// Resposta: SÓ contagens (zero payload/tenant real/segredo). SHADOW_ONLY.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/infra/internal-secret';
import { tenantBudgetGuard } from '@/lib/ai/budget-guard';
import { probeHouseBreaker, runJevShadowPulse } from '@/lib/ai/jev/jev-cerebro-cron-pulse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // ── Auth: mecanismo interno da casa (contrato Response | null) ──
  const denied = requireInternalSecret(request);
  if (denied !== null) return denied;

  const outcome = await runJevShadowPulse({
    src: request.nextUrl.searchParams.get('src'),
    maxSamples: request.nextUrl.searchParams.get('max'),
    budget: tenantBudgetGuard,
    breaker: await probeHouseBreaker(),
  });
  return NextResponse.json(outcome.body, { status: outcome.http });
}
