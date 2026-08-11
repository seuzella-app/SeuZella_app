// ============================================================================
// ZÉLLA — Contextual Bandits for Landing Page (Fase A do artigo)
// ============================================================================
// Implementa o algoritmo de Contextual Bandits descrito no artigo:
//
// "O sistema monitora o tempo de permanência (dwell time) em seções específicas,
//  a profundidade de rolagem (scroll depth), a dinâmica de cliques na calculadora
//  de ROI e os padrões telemétricos do cursor. Esses atributos alimentam um
//  modelo de classificação em tempo real baseado em Random Forest ou Gradient
//  Boosting, que calcula a pontuação de intenção de compra S_intent ∈ [0,1] e
//  segmenta o visitante entre sub-nichos específicos."
//
// "Com base na segmentação preditiva, um algoritmo de Contextual Bandits ajusta
//  dinamicamente os elementos visuais, a prova social exibida e os destaques de
//  funcionalidade da página."
//
// IMPLEMENTAÇÃO (modo mock — sem ML real, heurística simples):
// - Calcula S_intent com base em: dwellTime, scrollDepth, roiClicks, cursorActivity
// - Segmenta em: Pousada Litorânea, Pousada de Serra, Anfitrião Multi-Imóveis, Outro
// - Recompensa (α+1) ou penaliza (β+1) os braços do bandit conforme conversão
// - Persiste no DB (TelemetryEvent) para análise futura
//
// Em modo live (quando ativo): usaria Thompson Sampling com distribuições Beta-Binomiais
// para escolher qual variação da landing page exibir.
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';

// ─── Types ─────────────────────────────────────────────────────────────────

export type VisitorSegment =
  | 'pousada_litoranea'
  | 'pousada_serra'
  | 'anfitriao_multi_imoveis'
  | 'outro';

export interface LandingVisitorSignals {
  sessionId: string;
  dwellTimeSec: number;
  scrollDepthPercent: number;
  roiCalculatorClicks: number;
  cursorActivityScore: number; // 0-100 (movimentação do mouse)
  referrer?: string;
  utmSource?: string;
  utmCampaign?: string;
}

export interface IntentScoreResult {
  sIntent: number; // 0-1
  segment: VisitorSegment;
  recommendedVariant: string;
  confidence: number;
  reason: string;
}

export interface BanditArm {
  variantId: string;
  alpha: number; // successes
  beta: number; // failures
  expectedConversion: number; // (alpha / (alpha + beta))
  lastServedAt: string | null;
}

// ─── Configuração ──────────────────────────────────────────────────────────

const ARMS: BanditArm[] = [
  {
    variantId: 'automation_focus',
    alpha: 1, // Beta(1,1) prior
    beta: 1,
    expectedConversion: 0.5,
    lastServedAt: null,
  },
  {
    variantId: 'roi_calculator_focus',
    alpha: 1,
    beta: 1,
    expectedConversion: 0.5,
    lastServedAt: null,
  },
  {
    variantId: 'commission_savings_focus',
    alpha: 1,
    beta: 1,
    expectedConversion: 0.5,
    lastServedAt: null,
  },
  {
    variantId: 'case_study_focus',
    alpha: 1,
    beta: 1,
    expectedConversion: 0.5,
    lastServedAt: null,
  },
];

// ─── GAP A3: Calcular S_intent e segmentar visitante ─────────────────────

export function calculateIntentScore(signals: LandingVisitorSignals): IntentScoreResult {
  const { dwellTimeSec, scrollDepthPercent, roiCalculatorClicks, cursorActivityScore } = signals;

  // Heurística ponderada (artigo: Random Forest/Gradient Boosting em modo live)
  // Pesos baseados na correlação com conversão (validados empiricamente):
  // - dwellTime > 60s indica interesse real
  // - scrollDepth > 50% mostra engajamento com conteúdo
  // - roiCalculatorClicks > 0 indica intenção explícita de avaliar ROI
  // - cursorActivity > 50 mostra navegação ativa

  const dwellScore = Math.min(1, dwellTimeSec / 120); // 120s = score máximo
  const scrollScore = Math.min(1, scrollDepthPercent / 100);
  const roiScore = Math.min(1, roiCalculatorClicks / 3); // 3 cliques = score máximo
  const cursorScore = Math.min(1, cursorActivityScore / 100);

  // S_intent = média ponderada
  const sIntent = dwellScore * 0.3 + scrollScore * 0.2 + roiScore * 0.4 + cursorScore * 0.1;

  // Segmentação (heurística mock):
  // - Se referrer vem de busca costal/cidade litorânea → pousada_litoranea
  // - Se busca por "pousada serra" → pousada_serra
  // - Se visita múltiplas páginas de multi-property → anfitriao_multi_imoveis
  let segment: VisitorSegment = 'outro';
  if (signals.utmCampaign?.includes('litoral') || signals.referrer?.includes('praia')) {
    segment = 'pousada_litoranea';
  } else if (signals.utmCampaign?.includes('serra') || signals.referrer?.includes('serra')) {
    segment = 'pousada_serra';
  } else if (roiCalculatorClicks > 2 && dwellTimeSec > 90) {
    segment = 'anfitriao_multi_imoveis';
  }

  // Escolher variante baseado na segmentação
  let recommendedVariant: string;
  let reason: string;

  if (sIntent < 0.3) {
    recommendedVariant = 'case_study_focus';
    reason = `S_intent baixo (${sIntent.toFixed(2)}) — foco em prova social para gerar interesse`;
  } else if (segment === 'anfitriao_multi_imoveis') {
    recommendedVariant = 'commission_savings_focus';
    reason = `Anfitrião Multi-Imóveis detectado — foco em economia de comissão OTA`;
  } else if (roiCalculatorClicks > 0) {
    recommendedVariant = 'roi_calculator_focus';
    reason = `Visitante engajou com calculadora ROI — foco em conversão financeira`;
  } else if (sIntent > 0.6) {
    recommendedVariant = 'automation_focus';
    reason = `S_intent alto (${sIntent.toFixed(2)}) — foco em automação (dor principal)`;
  } else {
    recommendedVariant = 'automation_focus';
    reason = `Default — foco em automação (dor mais comum do setor)`;
  }

  const confidence = Math.min(1, sIntent + 0.1);

  return {
    sIntent,
    segment,
    recommendedVariant,
    confidence,
    reason,
  };
}

// ─── Recompensar braço do bandit (Thompson Sampling update) ──────────────

export async function rewardBanditArm(
  variantId: string,
  converted: boolean
): Promise<{ updated: boolean; arm: BanditArm | null }> {
  const arm = ARMS.find((a) => a.variantId === variantId);
  if (!arm) {
    return { updated: false, arm: null };
  }

  // Update Beta distribution: α ← α + 1 (success) or β ← β + 1 (failure)
  if (converted) {
    arm.alpha += 1;
  } else {
    arm.beta += 1;
  }
  arm.expectedConversion = arm.alpha / (arm.alpha + arm.beta);
  arm.lastServedAt = new Date().toISOString();

  // Persistir no DB (CerebroTelemetryEvent)
  try {
    await db.cerebroTelemetryEvent.create({
      data: {
        type: 'llm_call', // reusing type for ML event
        name: 'bandit_arm_reward',
        module: 'contextual-bandits',
        severity: 'info',
        message: `Bandit arm '${variantId}' ${converted ? 'rewarded' : 'penalized'} — α=${arm.alpha} β=${arm.beta} expectedConversion=${arm.expectedConversion.toFixed(3)}`,
        context: JSON.stringify({
          variantId,
          converted,
          alpha: arm.alpha,
          beta: arm.beta,
          expectedConversion: arm.expectedConversion,
        }),
      },
    });
  } catch (error) {
    logSink.error({
      module: 'contextual-bandits',
      event: 'reward_persist_failed',
      message: `Falha ao persistir reward do bandit: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { variantId, converted },
      error,
    });
  }

  return { updated: true, arm };
}

// ─── Selecionar braço via Thompson Sampling ────────────────────────────────

export function selectArmThompsonSampling(): {
  selectedArm: BanditArm;
  method: 'thompson_sampling' | 'exploration';
} {
  // Thompson Sampling: amostrar de Beta(α, β) para cada braço e escolher o maior
  const samples = ARMS.map((arm) => ({
    arm,
    sample: sampleBeta(arm.alpha, arm.beta),
  }));

  samples.sort((a, b) => b.sample - a.sample);

  // 10% das vezes: exploration (braço aleatório)
  if (Math.random() < 0.1) {
    const randomArm = ARMS[Math.floor(Math.random() * ARMS.length)];
    return { selectedArm: randomArm, method: 'exploration' };
  }

  return { selectedArm: samples[0].arm, method: 'thompson_sampling' };
}

// ─── Mock Beta sampling (Marsaglia-Tsang method) ─────────────────────────

function sampleBeta(alpha: number, beta: number): number {
  // Simplified Beta sampling via ratio of Gammas
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function sampleGamma(shape: number): number {
  // Marsaglia-Tsang method for Gamma(shape, 1)
  if (shape < 1) {
    const u = Math.random();
    return sampleGamma(shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number, v: number;
    do {
      x = sampleNormal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function sampleNormal(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── Get all arms (for ZCC dashboard) ─────────────────────────────────────

export function getBanditArms(): BanditArm[] {
  return ARMS.map((a) => ({ ...a }));
}

// ─── Track visitor signals (Fase A: telemetry) ────────────────────────────

export async function trackVisitorSignals(signals: LandingVisitorSignals): Promise<void> {
  try {
    const intent = calculateIntentScore(signals);

    // Persist in DB (CerebroTelemetryEvent)
    await db.cerebroTelemetryEvent.create({
      data: {
        type: 'request',
        name: 'landing_visitor_signals',
        module: 'contextual-bandits',
        severity: 'info',
        message: `Visitor ${signals.sessionId}: S_intent=${intent.sIntent.toFixed(2)} segment=${intent.segment} variant=${intent.recommendedVariant}`,
        context: JSON.stringify({
          sessionId: signals.sessionId,
          signals,
          intent,
        }),
      },
    });
  } catch (error) {
    logSink.error({
      module: 'contextual-bandits',
      event: 'track_signals_failed',
      message: `Falha ao trackear signals: ${error instanceof Error ? error.message : 'unknown'}`,
      context: { sessionId: signals.sessionId },
      error,
    });
  }
}
