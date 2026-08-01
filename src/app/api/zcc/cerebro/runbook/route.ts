// ============================================================================
// ZÉLLA — ZCC Endpoint: Cérebro Runbook (Documentação Operacional)
// ============================================================================
// Documentação viva do Cérebro Zélla — expõe status, env vars necessárias,
// troubleshooting e procedimentos de operação.
//
// GET /api/zcc/cerebro/runbook — retorna runbook completo (markdown JSON)
//
// Auth: verifyZCCAccessOrReject (admin Zélla apenas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyZCCAccessOrReject } from '@/lib/zcc-security';
import { getCerebroMode } from '@/lib/cerebro/types';
import { getCerebroSpend } from '@/lib/cerebro/glm-service';
import { errorReporter } from '@/lib/cerebro/error-reporter';
import { getAnomalyDetector } from '@/lib/cerebro/anomaly-detector';
import { getRefactorSuggester } from '@/lib/cerebro/refactor-suggester';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const security = await verifyZCCAccessOrReject(request);
  if (!security.allowed) return security.response!;

  try {
    const mode = getCerebroMode();
    const spend = getCerebroSpend();
    const errorReporterStats = errorReporter.getStats();
    const anomalyDetectorStats = getAnomalyDetector().getStats();

    let refactorStats: Awaited<ReturnType<ReturnType<typeof getRefactorSuggester>['getStats']>> | null = null;
    try {
      refactorStats = await getRefactorSuggester().getStats();
    } catch {
      // ignore
    }

    const runbook = generateRunbook({
      mode,
      spend,
      errorReporterStats,
      anomalyDetectorStats,
      refactorStats,
      envVars: {
        CEREBRO_LIVE_MODE: process.env.CEREBRO_LIVE_MODE || 'false',
        GLM_5_2_API_KEY: process.env.GLM_5_2_API_KEY ? '✓ configured' : '✗ not set',
        ZHIPU_API_KEY: process.env.ZHIPU_API_KEY ? '✓ configured' : '✗ not set',
        UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '✓ configured' : '✗ not set',
        UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '✓ configured' : '✗ not set',
        QSTASH_URL: process.env.QSTASH_URL ? '✓ configured' : '✗ not set',
        QSTASH_TOKEN: process.env.QSTASH_TOKEN ? '✓ configured' : '✗ not set',
        INTERNAL_ENDPOINT_TOKEN: process.env.INTERNAL_ENDPOINT_TOKEN ? '✓ configured' : '✗ not set',
        CEREBRO_ALERT_EMAILS: process.env.CEREBRO_ALERT_EMAILS ? '✓ configured' : '✗ not set',
        SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL ? '✓ configured' : '✗ not set',
        SENTRY_DSN: process.env.SENTRY_DSN ? '✓ configured' : '✗ not set (optional)',
        CRON_SECRET: process.env.CRON_SECRET ? '✓ configured' : '✗ not set (REQUIRED for cron auth)',
      },
    });

    return NextResponse.json({
      success: true,
      data: runbook,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[zcc/cerebro/runbook] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

interface RunbookData {
  mode: 'mock' | 'live';
  spend: { month: number; spendUsd: number; budgetUsd: number };
  errorReporterStats: { configured: boolean; environment: string; release: string | null; rateLimitRemaining: number; dedupCacheSize: number };
  anomalyDetectorStats: { mode: 'mock' | 'live'; config: unknown; cooldownEntries: number; logSinkStats: unknown };
  refactorStats: unknown;
  envVars: Record<string, string>;
}

function generateRunbook(data: RunbookData): string {
  return `# 🧠 Cérebro Zélla — Runbook Operacional

*Gerado automaticamente em ${new Date().toISOString()}*

## 📊 Status Atual

| Componente | Status | Detalhe |
|------------|--------|---------|
| **Modo** | ${data.mode === 'live' ? '🟢 LIVE' : '🟡 MOCK'} | ${data.mode === 'live' ? 'Integrações reais ativas' : 'Apenas DB + console, sem side effects'} |
| **LLM Spend** | $${data.spend.spendUsd.toFixed(4)} / $${data.spend.budgetUsd.toFixed(2)} | ${((data.spend.spendUsd / data.spend.budgetUsd) * 100).toFixed(1)}% do cap mensal |
| **Sentry** | ${data.errorReporterStats.configured ? '🟢 Configurado' : '⚫ Não configurado'} | ${data.errorReporterStats.environment} |
| **Anomaly Detector** | ${data.anomalyDetectorStats.mode === 'live' ? '🟢 LIVE' : '🟡 MOCK'} | ${data.anomalyDetectorStats.cooldownEntries} entradas em cooldown |
| **RefactorSuggester** | ${data.mode === 'live' ? '🟢 LIVE' : '🟡 MOCK'} | ${(data.refactorStats as { totalSuggestions?: number })?.totalSuggestions || 0} sugestões totais |

## 🔧 Variáveis de Ambiente

${Object.entries(data.envVars).map(([key, value]) => `- \`${key}\`: ${value}`).join('\n')}

## 📅 Crons Ativos

| Cron | Schedule | Função |
|------|----------|--------|
| \`/api/cron/budget-reset\` | \`0 0 * * *\` (diário 00:00) | Reset BudgetGuardState |
| \`/api/cron/metrics-snapshot\` | \`0 6 * * *\` (diário 06:00) | Snapshot de performance por tenant |
| \`/api/cron/cerebro-analyze\` | \`*/15 * * * *\` (15 min) | AnomalyDetector + GlmCerebroService.analyzeAnomalies() |
| \`/api/cron/cerebro-budget-forecast\` | \`0 6 * * *\` (diário 06:00) | CFO Virtual — tenants em risco de estourar cota Meta |
| \`/api/cron/cerebro-refactor-check\` | \`0 7 * * *\` (diário 07:00) | Erros recorrentes (5+/24h) → sugestões de refatoração via GLM 5.2 |
| \`/api/cron/weekly-report\` | \`0 8 * * 1\` (segundas 08:00) | Email semanal por tenant + forecast global |

**QStash Schedules** (configurar manualmente no Upstash):
- \`POST /api/cron/cerebro-watchdog\` — todo minuto (\`* * * * *\`) — verifica thresholds hard
  - Header: \`X-Internal-Token: <INTERNAL_ENDPOINT_TOKEN>\`

## 🚦 Ativar MODO LIVE (Production)

**PRÉ-REQUISITOS** (todos obrigatórios):
1. ✅ \`GLM_5_2_API_KEY\` ou \`ZHIPU_API_KEY\` configurado (Chat.z.ai)
2. ✅ \`UPSTASH_REDIS_REST_URL\` + \`UPSTASH_REDIS_REST_TOKEN\` (Upstash Redis)
3. ✅ \`QSTASH_URL\` + \`QSTASH_TOKEN\` + \`NEXT_PUBLIC_APP_URL\` (QStash para watchdog 1min)
4. ✅ \`INTERNAL_ENDPOINT_TOKEN\` (protege /api/internal/flush-buffer e /api/cron/cerebro-watchdog)
5. ✅ \`CRON_SECRET\` (protege Vercel Crons /api/cron/*)
6. ✅ \`META_APP_SECRET\` (webhook WhatsApp)
7. ✅ \`ENCRYPTION_SECRET\` (chaves AES-256-GCM)
8. ✅ \`NEXTAUTH_SECRET\` (autenticação)

**ALERT CHANNELS** (opcional mas recomendado):
- \`CEREBRO_ALERT_EMAILS=admin@seuzella.com\` (CSV)
- \`SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...\`
- \`TWILIO_ACCOUNT_SID\` + \`TWILIO_AUTH_TOKEN\` + \`TWILIO_FROM_NUMBER\` (SMS para emergency)
- \`CEREBRO_EMERGENCY_PHONES=+5511999999999\` (CSV E.164)
- \`SENTRY_DSN=https://<key>@<host>/<project_id>\` (error tracking)

**ATIVAR**:
\`\`\`bash
# No Vercel Dashboard → Settings → Environment Variables:
CEREBRO_LIVE_MODE=true
\`\`\`

## 🚨 Troubleshooting

### Problema: Cérebro não detecta anomalias
**Sintoma**: Dashboard ZCC → Cérebro → 0 anomalias ativas mesmo com erros no console

**Diagnóstico**:
1. Verifique se LogSink está interceptando: logs da Vercel devem mostrar \`[LogSink] Console interception ACTIVE\`
2. Verifique se o watchdog está rodando: chame manualmente \`POST /api/cron/cerebro-watchdog\` com header \`X-Internal-Token\`
3. Verifique se há erros no LogSink buffer: \`GET /api/zcc/cerebro/anomalies\` mostra AnomalyEvents
4. Se modo mock: anomalias são persistidas mas não disparam alertas (esperado)

**Solução**:
- Se LogSink não está interceptando: verifique \`instrumentation.ts\` carregou sem erro
- Se watchdog não roda: configure QStash Schedule (não é Vercel Cron)
- Se nenhum erro chega: talvez \`console.error\` foi removido por \`removeConsole\` — verifique \`next.config.ts\`

### Problema: Análises do GLM 5.2 falham
**Sintoma**: CerebroAnalysis com mode='mock' mesmo com CEREBRO_LIVE_MODE=true

**Diagnóstico**:
1. Verifique \`GLM_5_2_API_KEY\` ou \`ZHIPU_API_KEY\` está setado
2. Verifique se cap mensal não estourou: \`$${data.spend.spendUsd.toFixed(4)} / $${data.spend.budgetUsd.toFixed(2)}\`
3. Verifique logs: \`[glm-cerebro] GLM 5.2 call failed — fallback to mock\`

**Solução**:
- Se key ausente: configurar no Vercel
- Se cap estourado: aumentar \`CEREBRO_MONTHLY_BUDGET_USD\` (default $20)
- Se rate limit: GLM 5.2 pode estar limitando — espere e tente novamente

### Problema: Alertas não chegam
**Sintoma**: Anomalia critical detectada mas nenhum email/Slack recebido

**Diagnóstico**:
1. Verifique \`CEREBRO_LIVE_MODE=true\` (em mock, não envia)
2. Verifique canais: \`CEREBRO_ALERT_EMAILS\`, \`SLACK_WEBHOOK_URL\`
3. Verifique \`CEREBRO_MIN_SEVERITY\` (default 'warning' — info não vai)
4. Verifique tabela \`alert_deliveries\` no DB: \`SELECT * FROM alert_deliveries ORDER BY created_at DESC LIMIT 10;\`

**Solução**:
- Se \`alert_deliveries\` tem entries com status='failed': verifique \`errorMessage\`
- Se não tem entries: AlertBus não está sendo chamado — verifique fluxo do cron

### Problema: Sugestões de refatoração vazias
**Sintoma**: Dashboard ZCC → Refactors → 0 sugestões

**Diagnóstico**:
1. Clique em "Re-indexar código" para popular KnowledgeChunks
2. Verifique se há erros recorrentes (5+ em 24h): \`GET /api/zcc/cerebro/anomalies\`
3. Clique em "Forçar Análise" para rodar manualmente

**Solução**:
- Se index vazio: \`GET /api/zcc/cerebro/refactors?reindex=true\` força re-indexação
- Se sem erros recorrentes: aguarde cron diário (07:00 UTC) ou force manual

## 🔒 Segurança

- **Tokens vazados**: REVOLGUE imediatamente em GitHub Settings + Vercel Settings
- **Audit Log**: persistido em \`zcc_audit_logs\` (retention 30 dias, cleanup automático)
- **Canary Detector**: detecta honeypot records tocados (vazamento de dados)
- **Rate Limiting**: 5 req/IP per 15min para /api/zcc/* (6-layer Security Gate V3)
- **Cron Auth**: CRON_SECRET protege Vercel Crons; INTERNAL_ENDPOINT_TOKEN protege QStash

## 📋 Checklist de Manutenção

**Diário** (automático via cron):
- [x] Watchdog 1min verifica thresholds
- [x] Analyze 15min detecta anomalias
- [x] Budget forecast 06:00 prevê estouro de cota
- [x] Refactor check 07:00 detecta erros recorrentes

**Semanal** (manual):
- [ ] Revisar \`refactor_suggestions\` pendentes (ZCC → Refactors tab)
- [ ] Acknowledge anomalias antigas (ZCC → Cérebro → Anomalias Ativas)
- [ ] Verificar gasto LLM (\`$${data.spend.spendUsd.toFixed(2)}/$${data.spend.budgetUsd.toFixed(2)}\`)
- [ ] Confirmar QStash Schedule ativo (watchdog 1min)

**Mensal** (manual):
- [ ] Cleanup old telemetry events (cron absorve: cleanupOldTelemetryEvents)
- [ ] Revisar alert_deliveries com status='failed'
- [ ] Backup do DB (Vercel Postgres ou Upstash)
- [ ] Atualizar CEREBRO_MONTHLY_BUDGET_USD se necessário

## 📞 Contatos

- **Slack**: configurado via SLACK_WEBHOOK_URL
- **Email**: configurado via CEREBRO_ALERT_EMAILS
- **SMS Emergency**: configurado via CEREBRO_EMERGENCY_PHONES + Twilio

---

*Este runbook é gerado dinamicamente pelo endpoint /api/zcc/cerebro/runbook*
*Última atualização: ${new Date().toISOString()}*
`;
}
