/**
 * Helpdesk Integration — Crisp + BetterUptime
 * ============================================================================
 *
 * Crisp: chat de suporte no canto inferior direito (DCC e ZCC)
 * BetterUptime: status page público + alertas 24/7
 * ============================================================================
 */

import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID || '';
const BETTERUPTIME_STATUS_PAGE_URL = process.env.BETTERUPTIME_STATUS_PAGE_URL || 'https://status.seuzella.com';

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT CRISP — para incluir no <head> das páginas
// ─────────────────────────────────────────────────────────────────────────────
export function getCrispScript(): string {
  if (!CRISP_WEBSITE_ID) return '';

  return `
    <script type="text/javascript">
      window.$crisp = [];
      window.CRISP_WEBSITE_ID = "${CRISP_WEBSITE_ID}";
      (function(){
        d = document;
        s = d.createElement("script");
        s.src = "https://client.crisp.chat/l.js";
        s.async = 1;
        d.getElementsByTagName("head")[0].appendChild(s);
      })();
    </script>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// INJECT CRISP — helper para NextResponse
// ─────────────────────────────────────────────────────────────────────────────
export function injectHelpdesk(response: NextResponse): NextResponse {
  if (!CRISP_WEBSITE_ID) return response;
  // Crisp é injetado client-side via Script component, não via header HTTP
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS PAGE — redirect ou iframe
// ─────────────────────────────────────────────────────────────────────────────
export function getStatusPageUrl(): string {
  return BETTERUPTIME_STATUS_PAGE_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLA / SLO DEFINIDOS
// ─────────────────────────────────────────────────────────────────────────────
export const SLA = {
  AVAILABILITY_TARGET: 99.5, // % uptime mensal
  RESPONSE_TIME_P95_MS: 2000, // 95% das reqs < 2s
  RESPONSE_TIME_P99_MS: 5000, // 99% das reqs < 5s
  ERROR_RATE_MAX: 1.0, // <1% de erros 5xx
  WHATSAPP_RESPONSE_TIME_TARGET_S: 30, // <30s resposta ao hóspede
  LLM_FALLBACK_TRIGGER: 3, // 3 falhas em 30s → circuit breaker
};

export const SUPPORT_HOURS = {
  BUSINESS: {
    WEEKDAYS: 'seg-sex 09h-18h',
    RESPONSE_SLA: '4 horas',
    CHANNELS: ['whatsapp', 'email', 'crisp-chat'],
  },
  CRITICAL_24_7: {
    SCOPE: 'incidentes de produção (sistema fora do ar, vazamento de dados)',
    RESPONSE_SLA: '30 minutos',
    CHANNELS: ['pagerduty', 'sms', 'telefone'],
  },
  SELF_SERVICE: {
    KNOWLEDGE_BASE: 'https://docs.seuzella.com',
    VIDEO_TUTORIALS: 'https://www.youtube.com/@seuzella',
    STATUS_PAGE: BETTERUPTIME_STATUS_PAGE_URL,
  },
};
