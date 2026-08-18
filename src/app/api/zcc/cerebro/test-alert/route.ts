// ============================================================================
// ZÉLLA — ZCC Endpoint: Test Alert (debug utility)
// ============================================================================
// Permite ao admin Zélla disparar um alerta de teste para validar configuração
// do AlertBus. Útil para confirmar que:
//  - Email está sendo entregue
//  - Slack webhook está funcionando
//  - Modo mock vs live está correto
//
// Auth: verifyZCCAccessOrReject (admin Zélla apenas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, type SecurityContext } from '@/lib/security/api-shield';
import { sendTestAlert } from '@/lib/cerebro/alert-bus';
import { getCerebroMode } from '@/lib/cerebro/types';
import type { Severity } from '@/lib/cerebro/types';

async function postHandler(request: NextRequest, _ctx: SecurityContext): Promise<NextResponse> {
  // (auth já validada pelo withSecurity — V11-P0.7)

  try {
    const body = await request.json().catch(() => ({}));
    const severity = (body.severity as Severity) || 'warning';

    // Valida severity
    const validSeverities: Severity[] = ['info', 'warning', 'critical', 'emergency'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const mode = getCerebroMode();
    const results = await sendTestAlert(severity);

    return NextResponse.json({
      success: true,
      mode,
      severity,
      results,
      summary: {
        total: results.length,
        sent: results.filter(r => r.status === 'sent' || r.status === 'delivered').length,
        queued: results.filter(r => r.status === 'queued').length,
        failed: results.filter(r => r.status === 'failed').length,
      },
      message: mode === 'mock'
        ? 'Alerta de teste criado em MODO MOCK (não envia para canais reais). Verifique o DB AlertDelivery.'
        : `Alerta de teste enviado em MODO LIVE via ${results.length} canal(is).`,
    });
  } catch (error) {
    console.error('[zcc/test-alert] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function getHandler(request: NextRequest, _ctx: SecurityContext): Promise<NextResponse> {
  // (auth já validada pelo withSecurity — V11-P0.7)

  // GET apenas mostra status do AlertBus sem disparar
  const mode = getCerebroMode();

  return NextResponse.json({
    mode,
    config: {
      hasAlertEmails: (process.env.CEREBRO_ALERT_EMAILS || '').split(',').filter(Boolean).length,
      hasSlackWebhook: !!process.env.SLACK_WEBHOOK_URL,
      hasTwilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER),
      hasCustomWebhook: !!process.env.CEREBRO_CUSTOM_WEBHOOK_URL,
      minSeverity: process.env.CEREBRO_MIN_SEVERITY || 'warning',
      liveMode: process.env.CEREBRO_LIVE_MODE === 'true',
    },
    instructions: mode === 'mock'
      ? 'Modo MOCK ativo. Para enviar alertas reais, configure CEREBRO_LIVE_MODE=true + canais (CEREBRO_ALERT_EMAILS, SLACK_WEBHOOK_URL, etc).'
      : 'Modo LIVE ativo. POST com body { "severity": "warning" } para disparar alerta de teste.',
  });
}

// V11-P0.7: exports wrapped com withSecurity + auth zcc-admin
export const POST = withSecurity(postHandler, {
  auth: 'zcc-admin',
  routeLabel: 'zcc-cerebro-test-alert-post',
});

export const GET = withSecurity(getHandler, {
  auth: 'zcc-admin',
  routeLabel: 'zcc-cerebro-test-alert-get',
});
