import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/api-shield';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { PartnerProgramService } from '@/lib/partner-program/partner-service';

async function postHandler(request: NextRequest) {
  try {
    // RUN 6 — tenant authority: ANTES o "check de admin" era um `if` com
    // corpo vazio (no-op) — qualquer usuário de qualquer tenant autenticado
    // reabria o lote GLOBAL do Programa Parceiro (partnerProgramConfig
    // id 'default'). AGORA: gate ZCC canônico (allowlist de e-mails + role).
    const zcc = await verifyZCCAccessOrReject(request);
    if (!zcc.allowed) return zcc.response!;

    const result = await PartnerProgramService.reopenSecondBatch();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Falha ao reabrir 2º lote do Programa Parceiro' }, { status: 500 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'zcc-partner-program-reopen' });
