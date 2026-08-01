// ============================================================================
// ZÉLLA — AlertBus Dispatcher (Cérebro Voice)
// ============================================================================
// Canal único de saída para alertas. Roteia para Email, Slack, SMS, Dashboard
// ou Webhook baseado em severity.
//
// MODO MOCK (padrão):
//  - Todos os alertas são salvos no DB (AlertDelivery) com mode="mock"
//  - NENHUM envio real para email/Slack/SMS
//  - Apenas loga no console para debug
//  - Dashboard ZCC pode mostrar os alertas mock (para validar UI/UX)
//
// MODO LIVE (CEREBRO_LIVE_MODE=true + canais configurados):
//  - AlertDelivery mode="live"
//  - Email: nodemailer (já existe em src/lib/email-sender.ts)
//  - Slack: webhook URL (fetch HTTP)
//  - SMS: Twilio (novo dep, adicionar depois)
//  - Dashboard: SSE push para ZCC conectado
//  - Webhook: HTTP POST para URL custom
//
// ROTEAMENTO POR SEVERITY:
//  - info: Dashboard only (assíncrono)
//  - warning: Dashboard + Email (digest diário)
//  - critical: Dashboard + Email imediato + Slack
//  - emergency: Tudo acima + SMS para diretoria
// ============================================================================

import { db } from '@/lib/db';
import {
  type AlertPayload,
  type AlertChannel,
  type AlertDeliveryResult,
  type Severity,
  SEVERITY_ORDER,
  getCerebroMode,
} from './types';
import { logSink } from './log-sink';

// ── Cross-channel deduplication ─────────────────────────────────────────────
// Evita que o mesmo alerta (subject + scope + severity) seja disparado
// múltiplas vezes em janela curta. Reduz alert fatigue em cascata de anomalias.
//
// Hash: subject + scope + severity (ignora body, que pode variar)
// Janela: 5 minutos (configurável via CEREBRO_ALERT_DEDUP_WINDOW_MS)
// Máximo de entradas no tracker: 1000 (LRU eviction)

const DEDUP_WINDOW_MS = parseInt(
  process.env.CEREBRO_ALERT_DEDUP_WINDOW_MS || String(5 * 60 * 1000),
  10
);
const MAX_DEDUP_ENTRIES = 1000;

const dedupTracker = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();

function hashAlert(payload: AlertPayload): string {
  // FNV-1a hash sobre (subject + scope + severity)
  const key = `${payload.subject}|${payload.scope}|${payload.severity}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function shouldDedupAlert(payload: AlertPayload): { dedup: boolean; count: number } {
  const hash = hashAlert(payload);
  const now = Date.now();
  const existing = dedupTracker.get(hash);

  if (existing) {
    if (now - existing.firstSeen < DEDUP_WINDOW_MS) {
      // Ainda dentro da janela — dedup
      existing.count++;
      existing.lastSeen = now;
      return { dedup: true, count: existing.count };
    }
    // Janela expirou — reset
    dedupTracker.set(hash, { count: 1, firstSeen: now, lastSeen: now });
    return { dedup: false, count: 1 };
  }

  // Novo hash
  dedupTracker.set(hash, { count: 1, firstSeen: now, lastSeen: now });

  // LRU eviction: se tracker crescer demais, remove entradas antigas
  if (dedupTracker.size > MAX_DEDUP_ENTRIES) {
    const cutoff = now - DEDUP_WINDOW_MS * 2;
    for (const [k, v] of dedupTracker.entries()) {
      if (v.lastSeen < cutoff) dedupTracker.delete(k);
    }
  }

  return { dedup: false, count: 1 };
}

/**
 * Retorna estatísticas de deduplicação (para dashboard).
 */
export function getAlertDedupStats(): {
  uniqueAlertsTracked: number;
  dedupWindowMs: number;
  topDedupedAlerts: Array<{ hash: string; count: number }>;
} {
  const topDeduped = Array.from(dedupTracker.entries())
    .map(([hash, info]) => ({ hash, count: info.count }))
    .filter(e => e.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    uniqueAlertsTracked: dedupTracker.size,
    dedupWindowMs: DEDUP_WINDOW_MS,
    topDedupedAlerts: topDeduped,
  };
}

// ── Configuração de canais (env vars) ───────────────────────────────────────

interface AlertBusConfig {
  /** Emails que recebem alertas (CSV) */
  alertEmails: string[];
  /** Slack webhook URL */
  slackWebhookUrl: string | null;
  /** SMS config (Twilio) — futuro */
  twilioAccountSid: string | null;
  twilioFromNumber: string | null;
  /** Phone numbers para SMS emergency (CSV) */
  emergencyPhones: string[];
  /** Webhook URL genérico para integrações custom */
  customWebhookUrl: string | null;
  /** Severity mínima para enviar (default: warning) */
  minSeverity: Severity;
}

function loadConfig(): AlertBusConfig {
  return {
    alertEmails: (process.env.CEREBRO_ALERT_EMAILS || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean),
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || null,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || null,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER || null,
    emergencyPhones: (process.env.CEREBRO_EMERGENCY_PHONES || '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean),
    customWebhookUrl: process.env.CEREBRO_CUSTOM_WEBHOOK_URL || null,
    minSeverity: (process.env.CEREBRO_MIN_SEVERITY as Severity) || 'warning',
  };
}

// ── Roteamento por severity ─────────────────────────────────────────────────

interface RoutingDecision {
  channels: AlertChannel[];
  recipients: { channel: AlertChannel; recipient: string }[];
  /** Latência esperada de entrega */
  expectedLatency: 'immediate' | 'batch' | 'async';
}

function routeBySeverity(payload: AlertPayload, config: AlertBusConfig): RoutingDecision {
  const channels: AlertChannel[] = ['dashboard'];
  const recipients: { channel: AlertChannel; recipient: string }[] = [];

  // Dashboard sempre (independente de severity)
  recipients.push({ channel: 'dashboard', recipient: 'zcc-dashboard' });

  // Filtro de severity mínima
  if (SEVERITY_ORDER[payload.severity] < SEVERITY_ORDER[config.minSeverity]) {
    return { channels, recipients, expectedLatency: 'async' };
  }

  // warning → Dashboard + Email (digest diário, batch)
  if (payload.severity === 'warning') {
    if (config.alertEmails.length > 0) {
      channels.push('email');
      for (const email of config.alertEmails) {
        recipients.push({ channel: 'email', recipient: email });
      }
    }
    return { channels, recipients, expectedLatency: 'batch' };
  }

  // critical → Dashboard + Email imediato + Slack
  if (payload.severity === 'critical') {
    if (config.alertEmails.length > 0) {
      channels.push('email');
      for (const email of config.alertEmails) {
        recipients.push({ channel: 'email', recipient: email });
      }
    }
    if (config.slackWebhookUrl) {
      channels.push('slack');
      recipients.push({ channel: 'slack', recipient: config.slackWebhookUrl });
    }
    if (config.customWebhookUrl) {
      channels.push('webhook');
      recipients.push({ channel: 'webhook', recipient: config.customWebhookUrl });
    }
    return { channels, recipients, expectedLatency: 'immediate' };
  }

  // emergency → Tudo acima + SMS
  if (payload.severity === 'emergency') {
    if (config.alertEmails.length > 0) {
      channels.push('email');
      for (const email of config.alertEmails) {
        recipients.push({ channel: 'email', recipient: email });
      }
    }
    if (config.slackWebhookUrl) {
      channels.push('slack');
      recipients.push({ channel: 'slack', recipient: config.slackWebhookUrl });
    }
    if (config.customWebhookUrl) {
      channels.push('webhook');
      recipients.push({ channel: 'webhook', recipient: config.customWebhookUrl });
    }
    // SMS apenas se Twilio configurado
    if (config.twilioAccountSid && config.twilioFromNumber && config.emergencyPhones.length > 0) {
      channels.push('sms');
      for (const phone of config.emergencyPhones) {
        recipients.push({ channel: 'sms', recipient: phone });
      }
    }
    return { channels, recipients, expectedLatency: 'immediate' };
  }

  // info → só dashboard
  return { channels, recipients, expectedLatency: 'async' };
}

// ── Dispatcher principal ────────────────────────────────────────────────────

/**
 * Envia um alerta para todos os canais apropriados baseado em severity.
 *
 * Em MODO MOCK: salva no DB (AlertDelivery com mode="mock") mas NÃO envia.
 * Em MODO LIVE: salva no DB E envia via canal real.
 *
 * Retorna array de AlertDeliveryResult (1 por canal/destinatário).
 */
export async function dispatchAlert(payload: AlertPayload): Promise<AlertDeliveryResult[]> {
  const config = loadConfig();
  const mode = getCerebroMode();
  const routing = routeBySeverity(payload, config);

  // ── Cross-channel deduplication ──
  // Se mesmo (subject + scope + severity) já foi dispatchado nos últimos 5 min,
  // skipamos o envio mas atualizamos o count (para observabilidade no dashboard).
  const dedupCheck = shouldDedupAlert(payload);
  if (dedupCheck.dedup) {
    logSink.info({
      module: 'alert-bus',
      event: 'alert_deduplicated',
      message: `Alerta "${payload.subject}" suprimido (já enviado ${dedupCheck.count - 1}x em ${DEDUP_WINDOW_MS / 1000}s)`,
      context: {
        subject: payload.subject,
        scope: payload.scope,
        severity: payload.severity,
        dedupCount: dedupCheck.count,
      },
    });

    // Retorna empty result — caller vê que nada foi enviado
    return [{
      channel: 'dashboard',
      recipient: 'zcc-dashboard',
      status: 'queued',
      mode,
      errorMessage: `Deduplicated (${dedupCheck.count} occurrences in window)`,
    }];
  }

  const results: AlertDeliveryResult[] = [];

  for (const { channel, recipient } of routing.recipients) {
    try {
      // 1. Sempre persiste no DB (mesmo em mock mode — para dashboard ver)
      const delivery = await db.alertDelivery.create({
        data: {
          analysisId: payload.sourceType === 'cerebro_analysis' ? payload.sourceId : null,
          channel,
          recipient,
          subject: payload.subject,
          body: payload.body,
          status: 'queued',
          mode,
        },
      });

      // 2. Em mock mode, NÃO envia — apenas marca como "queued" para revisão
      if (mode === 'mock') {
        results.push({
          channel,
          recipient,
          status: 'queued',
          mode: 'mock',
          deliveryId: delivery.id,
        });
        continue;
      }

      // 3. Em live mode, envia via canal real
      const sendResult = await sendToChannel(channel, recipient, payload, config);

      // 4. Atualiza registro no DB
      await db.alertDelivery.update({
        where: { id: delivery.id },
        data: {
          status: sendResult.status,
          sentAt: sendResult.sentAt,
          deliveredAt: sendResult.status === 'delivered' ? new Date() : null,
          errorMessage: sendResult.errorMessage,
        },
      });

      results.push({
        channel,
        recipient,
        status: sendResult.status,
        sentAt: sendResult.sentAt,
        errorMessage: sendResult.errorMessage,
        deliveryId: delivery.id,
        mode: 'live',
      });
    } catch (error) {
      // Erro no envio de um canal não deve impedir os outros
      logSink.error({
        module: 'alert-bus',
        event: 'dispatch_channel_error',
        message: `Erro ao enviar alerta via ${channel} para ${recipient}`,
        error,
        context: { channel, recipient, severity: payload.severity },
      });

      results.push({
        channel,
        recipient,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        mode,
      });
    }
  }

  // Log de telemetria do próprio Cérebro
  logSink.info({
    module: 'alert-bus',
    event: 'alert_dispatched',
    message: `Alerta "${payload.subject}" dispatchado para ${results.length} canal(is)`,
    context: {
      severity: payload.severity,
      scope: payload.scope,
      mode,
      channels: results.map(r => ({ channel: r.channel, status: r.status })),
    },
  });

  return results;
}

// ── Senders específicos por canal ───────────────────────────────────────────

interface ChannelSendResult {
  status: 'sent' | 'failed' | 'delivered';
  sentAt?: Date;
  errorMessage?: string;
}

async function sendToChannel(
  channel: AlertChannel,
  recipient: string,
  payload: AlertPayload,
  config: AlertBusConfig
): Promise<ChannelSendResult> {
  switch (channel) {
    case 'email':
      return sendEmail(recipient, payload);
    case 'slack':
      return sendSlack(recipient, payload);
    case 'sms':
      return sendSms(recipient, payload, config);
    case 'webhook':
      return sendWebhook(recipient, payload);
    case 'dashboard':
      // Dashboard não envia — apenas persiste no DB (já feito)
      return { status: 'delivered', sentAt: new Date() };
    default:
      return { status: 'failed', errorMessage: `Unknown channel: ${channel}` };
  }
}

async function sendEmail(recipient: string, payload: AlertPayload): Promise<ChannelSendResult> {
  try {
    // Reusa o email-sender.ts existente (assinatura: sendEmail(to, subject, html))
    const { sendEmail } = await import('@/lib/email-sender');

    const subject = `[ZÉLLA Cérebro] ${payload.severity.toUpperCase()} — ${payload.subject}`;
    const body = formatAlertEmailBody(payload);

    await sendEmail(recipient, subject, body);

    return { status: 'sent', sentAt: new Date() };
  } catch (error) {
    return {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}

async function sendSlack(webhookUrl: string, payload: AlertPayload): Promise<ChannelSendResult> {
  try {
    const emoji = severityEmoji(payload.severity);
    const slackPayload = {
      text: `${emoji} *ZÉLLA Cérebro — ${payload.severity.toUpperCase()}*`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} ${payload.subject}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:* ${payload.severity}` },
            { type: 'mrkdwn', text: `*Scope:* ${payload.scope}` },
            { type: 'mrkdwn', text: `*Time:* ${new Date().toISOString()}` },
            { type: 'mrkdwn', text: `*Source:* ${payload.sourceType || 'unknown'}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: payload.body },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        status: 'failed',
        errorMessage: `Slack HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`,
      };
    }

    return { status: 'delivered', sentAt: new Date() };
  } catch (error) {
    return {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Slack send failed',
    };
  }
}

async function sendSms(
  recipient: string,
  payload: AlertPayload,
  config: AlertBusConfig
): Promise<ChannelSendResult> {
  // SMS via Twilio — placeholder para implementação futura
  // Por enquanto, em mock mode, apenas loga
  if (!config.twilioAccountSid || !config.twilioFromNumber) {
    return {
      status: 'failed',
      errorMessage: 'Twilio not configured (TWILIO_ACCOUNT_SID or TWILIO_FROM_NUMBER missing)',
    };
  }

  // TODO: implementar chamada Twilio quando添加 dependência
  // const client = twilio(config.twilioAccountSid, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ ... });

  logSink.warn({
    module: 'alert-bus',
    event: 'sms_not_implemented',
    message: `SMS para ${recipient} não enviado (Twilio adapter não implementado)`,
    context: { recipient, severity: payload.severity },
  });

  return { status: 'failed', errorMessage: 'Twilio adapter not yet implemented' };
}

async function sendWebhook(url: string, payload: AlertPayload): Promise<ChannelSendResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'zella-cerebro',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        status: 'failed',
        errorMessage: `Webhook HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`,
      };
    }

    return { status: 'delivered', sentAt: new Date() };
  } catch (error) {
    return {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Webhook send failed',
    };
  }
}

// ── Helpers de formatação ───────────────────────────────────────────────────

function severityEmoji(severity: Severity): string {
  const map: Record<Severity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🔴',
    emergency: '🚨',
  };
  return map[severity] || '❓';
}

function formatAlertEmailBody(payload: AlertPayload): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #0A0F1C; padding: 24px; border-radius: 8px; border-left: 4px solid ${severityColor(payload.severity)};">
        <h2 style="color: #d4a843; margin: 0 0 16px 0;">${severityEmoji(payload.severity)} Cérebro Zélla — Alerta</h2>
        <table style="width: 100%; color: #e0e0e0; font-size: 14px;">
          <tr><td style="padding: 4px 0; color: #888; width: 100px;">Severity:</td><td style="padding: 4px 0;"><strong style="color: ${severityColor(payload.severity)};">${payload.severity.toUpperCase()}</strong></td></tr>
          <tr><td style="padding: 4px 0; color: #888;">Scope:</td><td style="padding: 4px 0;">${payload.scope}</td></tr>
          <tr><td style="padding: 4px 0; color: #888;">Subject:</td><td style="padding: 4px 0;">${payload.subject}</td></tr>
          <tr><td style="padding: 4px 0; color: #888;">Time:</td><td style="padding: 4px 0;">${new Date().toISOString()}</td></tr>
          <tr><td style="padding: 4px 0; color: #888;">Source:</td><td style="padding: 4px 0;">${payload.sourceType || 'unknown'} ${payload.sourceId ? `(${payload.sourceId})` : ''}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;" />
        <div style="color: #e0e0e0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(payload.body)}</div>
        ${payload.metadata ? `
          <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;" />
          <details style="color: #888; font-size: 12px;">
            <summary style="cursor: pointer;">Metadata</summary>
            <pre style="background: #111; padding: 12px; border-radius: 4px; overflow-x: auto;">${escapeHtml(JSON.stringify(payload.metadata, null, 2))}</pre>
          </details>
        ` : ''}
        <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;" />
        <p style="color: #555; font-size: 11px; margin: 0;">
          Este alerta foi gerado pelo Cérebro Zélla em modo <strong>${getCerebroMode()}</strong>.
          Acesse o <a href="https://smart-hotel-zehla.vercel.app/lzcc" style="color: #d4a843;">ZCC</a> para mais detalhes.
        </p>
      </div>
    </div>
  `;
}

function severityColor(severity: Severity): string {
  const map: Record<Severity, string> = {
    info: '#3b82f6',
    warning: '#f59e0b',
    critical: '#ef4444',
    emergency: '#dc2626',
  };
  return map[severity] || '#888';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Helpers para testes e debug ─────────────────────────────────────────────

/**
 * Cria um alerta de teste (usado por /api/zcc/cerebro/test-alert endpoint).
 * Útil para validar configuração de canais.
 */
export async function sendTestAlert(severity: Severity = 'warning'): Promise<AlertDeliveryResult[]> {
  return dispatchAlert({
    subject: `[TESTE] Alerta de ${severity}`,
    body: `Este é um alerta de teste do Cérebro Zélla em modo ${getCerebroMode()}.
Gerado em ${new Date().toISOString()}.

Se você recebeu este alerta via email/Slack, a integração está funcionando.
Se esperava receber mas não recebeu, verifique:
- CEREBRO_LIVE_MODE=true
- CEREBRO_ALERT_EMAILS configurado (para email)
- SLACK_WEBHOOK_URL configurado (para Slack)
- CEREBRO_MIN_SEVERITY compatível com "${severity}"`,
    severity,
    scope: 'test:alert-bus',
    sourceType: 'manual',
    metadata: { test: true, timestamp: new Date().toISOString() },
  });
}
