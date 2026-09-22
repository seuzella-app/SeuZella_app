// ============================================================================
// JEV — Adapter LOCAL de heurística (baseline determinístico $0) — RUN22-A
// ============================================================================
// Papel no desenho de custo: a heurística local decide "de graça" as decisões
// de sinal alto; o remoto (TypeSafe) só vale a pena onde a heurística é fraca
// — e a comparação shadow é exatamente a evidência que dirá ONDE. Nunca lança;
// nunca usa rede; mesma entrada => mesma saída (testável e reproduzível).
// ============================================================================

import type {
  JevDecisionMode,
  JevDecisionOutcome,
  JevDecisionRequest,
  JevDecisionResponse,
} from '../contracts/JevTypes';
import type { IJevDecisionPort } from '../ports/IJevDecisionPort';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function asText(payload: Record<string, unknown>): string {
  return typeof payload.text === 'string' ? payload.text.toLowerCase() : '';
}

function asNumber(payload: Record<string, unknown>, field: string): number | null {
  const v = payload[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

type Heuristic = (payload: Record<string, unknown>) => JevDecisionOutcome;

const HEURISTICS: Record<JevDecisionMode, Heuristic> = {
  INTENT: (p) => {
    const text = asText(p);
    if (/(reserva|check-?in|hospedagem|booking|di[aá]ria)/.test(text)) {
      return { label: 'RESERVA', confidence: 0.75, rationale: 'palavra-chave de reserva' };
    }
    if (/(cancel)/.test(text)) {
      return { label: 'CANCELAMENTO', confidence: 0.72, rationale: 'palavra-chave de cancelamento' };
    }
    if (/(pre[çc]o|valor|quanto custa|tarifa)/.test(text)) {
      return { label: 'PRECO_INFO', confidence: 0.7, rationale: 'pergunta de tarifa' };
    }
    if (/(problema|erro|ajuda|suporte|n[aã]o funciona)/.test(text)) {
      return { label: 'SUPORTE', confidence: 0.68, rationale: 'sinal de suporte' };
    }
    return { label: 'OUTRO', confidence: 0.4, rationale: 'sem palavra-chave' };
  },
  SENTIMENT: (p) => {
    const text = asText(p);
    const pos = (text.match(/(adorei|[óo]timo|excelente|perfeito|maravilhoso|gostei)/g) || []).length;
    const neg = (text.match(/(p[eé]ssimo|horr[ií]vel|odeio|terr[ií]vel|insatisfeito|sujo|atrasad)/g) || []).length;
    if (pos === 0 && neg === 0) {
      return { label: 'NEUTRO', confidence: 0.5, rationale: 'sem polaridade detectada' };
    }
    if (pos >= neg) {
      return { label: 'POSITIVO', confidence: clamp01(0.55 + 0.15 * (pos - neg)) };
    }
    return { label: 'NEGATIVO', confidence: clamp01(0.55 + 0.15 * (neg - pos)) };
  },
  CHURN: (p) => {
    const recency = asNumber(p, 'recencyDays');
    const nps = asNumber(p, 'npsScore');
    let score = recency === null ? 0.45 : recency >= 60 ? 0.8 : recency >= 30 ? 0.65 : 0.5;
    if (nps !== null && nps <= 6) score = clamp01(score + 0.1);
    const label = score >= 0.75 ? 'ALTO' : score >= 0.6 ? 'MEDIO' : 'BAIXO';
    return { label, confidence: score, rationale: 'recência/NPS' };
  },
  LEAD: (p) => {
    const text = asText(p);
    const hasContact = p.hasContact === true || /@|\+\d{2,3}/.test(text);
    const partySize = asNumber(p, 'partySize');
    if (hasContact && (partySize === null || partySize >= 2)) {
      return { label: 'LEAD_QUALIFICADO', confidence: 0.7, rationale: 'contato presente' };
    }
    return { label: 'NAO_QUALIFICADO', confidence: 0.6, rationale: 'sem contato' };
  },
  ANOMALY: (p) => {
    const dev = Math.abs(asNumber(p, 'deviation') ?? 0);
    if (dev >= 3) return { label: 'CRITICA', confidence: 0.85, rationale: 'z >= 3' };
    if (dev >= 2) return { label: 'ALTA', confidence: 0.7, rationale: 'z >= 2' };
    if (dev >= 1) return { label: 'MEDIA', confidence: 0.55, rationale: 'z >= 1' };
    return { label: 'NORMAL', confidence: 0.5, rationale: 'z < 1' };
  },
  OCCUPANCY: (p) => {
    const rate = asNumber(p, 'rate') ?? 0;
    if (rate >= 0.9) return { label: 'ALTA_OCUPACAO', confidence: 0.8, rationale: 'rate >= 0.9' };
    if (rate >= 0.6) return { label: 'MEDIA_OCUPACAO', confidence: 0.65, rationale: 'rate >= 0.6' };
    return { label: 'BAIXA_OCUPACAO', confidence: 0.55, rationale: 'rate < 0.6' };
  },
  UPSELL: (p) => {
    const party = asNumber(p, 'partySize') ?? 0;
    const nights = asNumber(p, 'nights') ?? 0;
    if (party >= 4 || nights >= 5) {
      return { label: 'OFERECER_UPGRADE', confidence: 0.65, rationale: 'grupo/estadia longa' };
    }
    return { label: 'NAO_OFERECER', confidence: 0.6, rationale: 'sem sinal de upgrade' };
  },
};

export class JevLocalHeuristicAdapter implements IJevDecisionPort {
  readonly source = 'jev-local-heuristic' as const;

  async decide(request: JevDecisionRequest): Promise<JevDecisionResponse> {
    const startedAt = Date.now();
    const heuristic = HEURISTICS[request.mode];
    if (!heuristic) {
      return {
        status: 'rejected',
        mode: request.mode,
        reason: 'JEV_MODE_INVALID',
        shadowOnly: true,
        latencyMs: Date.now() - startedAt,
      };
    }
    try {
      const outcome = heuristic(request.payload);
      return {
        status: 'ok',
        mode: request.mode,
        source: this.source,
        decision: outcome,
        shadowOnly: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      // Heurística NUNCA quebra o chamador — fail-closed explícito.
      return {
        status: 'unavailable',
        mode: request.mode,
        reason: 'JEV_REMOTE_ERROR',
        shadowOnly: true,
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}
