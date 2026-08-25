import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/security/cron-auth-unified';
import { runFullSecurityScan } from '@/lib/security/security-scan-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min — security scan can take time

/**
 * CRON — Security Scan de Madrugada
 * ============================================================================
 *
 * Schedule: 0 6 * * * (06:00 UTC = 03:00 BRT — madrugada)
 *
 * Executa scan completo de segurança:
 *   1. Secret scan (regex — hardcoded credentials)
 *   2. SAST scan (GLM 5.2 — análise de código em arquivos críticos)
 *   3. Pentest scan (GLM 5.2 — black-box HTTP)
 *
 * Findings CRÍTICOS/ALTOS → alerta realtime para ZéCode no ZCC
 * ZéCode usa GLM 5.2 para gerar auto-fix
 *
 * Auth: verifyCronAuth('admin:all')
 * LLM: GLM 5.2 embarcado (sem OpenAI/Anthropic)
 */
export async function GET(request: NextRequest) {
  const authOk = await verifyCronAuth(request, 'admin:all');
  if (!authOk.ok) {
    return authOk.response ?? NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const result = await runFullSecurityScan();

    return NextResponse.json({
      success: true,
      summary: {
        total: result.totalFound,
        critical: result.criticalCount,
        high: result.highCount,
        mode: result.mode,
        durationMs: result.scanDurationMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'SECURITY_SCAN_FAILED',
        message: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
