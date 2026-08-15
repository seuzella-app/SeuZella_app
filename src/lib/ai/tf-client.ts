/**
 * TF Client — Cliente TypeScript para o TensorFlow Sidecar
 * =================================================================
 *
 * Comunica com o Python sidecar (FastAPI porta 8501) que serve 8 modelos
 * neurais TensorFlow para o Cérebro Zélla.
 *
 * PRINCÍPIO: NUNCA bloqueia o fluxo principal. Se o sidecar estiver offline
 * ou um modelo não estiver carregado, retorna fallback estatístico.
 *
 * FEATURE FLAGS: cada modelo tem sua feature flag (env var):
 *   USE_TF_INTENT=true/false    (default: false)
 *   USE_TF_CHURN=true/false
 *   USE_TF_LEAD=true/false
 *   USE_TF_ANOMALY=true/false
 *   USE_TF_OCCUPANCY=true/false
 *   USE_TF_SENTIMENT=true/false
 *   USE_TF_PRICE=true/false
 *   USE_TF_UPSELL=true/false
 *
 * Quando flag=false → retorna null (caller usa heurística atual).
 * Quando flag=true → chama sidecar. Se offline → fallback estatístico.
 */

// Logger simples (evita dependência circular com log-sink)
const log = {
  warn: (...args: any[]) => console.warn('[TF_CLIENT]', ...args),
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.debug('[TF_CLIENT]', ...args);
  },
  info: (...args: any[]) => console.info('[TF_CLIENT]', ...args),
  error: (...args: any[]) => console.error('[TF_CLIENT]', ...args),
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TF_SIDECAR_URL = process.env.TF_SIDECAR_URL || 'http://127.0.0.1:8501';
const TF_API_KEY = process.env.TF_API_KEY || '';
const TF_TIMEOUT_MS = parseInt(process.env.TF_TIMEOUT_MS || '3000', 10);

// Feature flags (default: false — ativa gradualmente)
const FLAGS = {
  intent: process.env.USE_TF_INTENT === 'true',
  churn: process.env.USE_TF_CHURN === 'true',
  lead: process.env.USE_TF_LEAD === 'true',
  anomaly: process.env.USE_TF_ANOMALY === 'true',
  occupancy: process.env.USE_TF_OCCUPANCY === 'true',
  sentiment: process.env.USE_TF_SENTIMENT === 'true',
  price: process.env.USE_TF_PRICE === 'true',
  upsell: process.env.USE_TF_UPSELL === 'true',
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

export interface IntentResult {
  intent: string;
  confidence: number;
  allScores?: Record<string, number>;
  source: 'neural' | 'heuristic_fallback';
}

export interface ChurnResult {
  churnScore: number;
  riskLevel: 'nominal' | 'warning' | 'critical';
  topFactors: string[];
  source: 'neural' | 'heuristic_fallback';
}

export interface LeadScoreResult {
  conversionProbability: number;
  tierRecommended: string;
  source: 'neural' | 'heuristic_fallback';
}

export interface AnomalyResult {
  isAnomaly: boolean;
  reconstructionError: number;
  threshold: number;
  source: 'neural' | 'heuristic_3sigma' | 'insufficient_data' | 'empty_input';
}

export interface OccupancyForecastResult {
  forecast: number[];
  confidence: number;
  source: 'neural' | 'heuristic_moving_average' | 'insufficient_data';
  message?: string;
}

export interface SentimentResult {
  sentiment: number; // -1 to +1
  label: 'positive' | 'negative' | 'neutral';
  source: 'neural' | 'heuristic_fallback';
}

export interface PriceOptimizeResult {
  optimalPrice: number;
  surgeMultiplier?: number;
  tier?: string;
  source: 'neural' | 'heuristic_fallback';
}

export interface UpsellResult {
  recommendations: Array<{
    id: string;
    name: string;
    price: number;
    description: string;
    score: number;
  }>;
  source: 'neural' | 'heuristic_fallback';
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP CLIENT
// ─────────────────────────────────────────────────────────────────────────────

async function tfFetch<T>(
  path: string,
  body: any,
  timeoutMs = TF_TIMEOUT_MS
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${TF_SIDECAR_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(TF_API_KEY ? { 'X-TF-API-Key': TF_API_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn('[TF_CLIENT]', `Sidecar returned ${res.status} for ${path}`);
      return null;
    }

    return await res.json() as T;
  } catch (err: any) {
    // Timeout, connection refused, etc. — silencioso (fallback)
    log.debug('[TF_CLIENT]', `Sidecar unreachable for ${path}: ${err?.message ?? 'unknown'}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<{
  online: boolean;
  modelsLoaded: string[];
  tfVersion?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${TF_SIDECAR_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return { online: false, modelsLoaded: [] };

    const data = await res.json();
    return {
      online: true,
      modelsLoaded: data.models_loaded || [],
      tfVersion: data.tf_version,
    };
  } catch {
    return { online: false, modelsLoaded: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INTENT CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

export async function classifyIntent(
  message: string,
  tenantId?: string
): Promise<IntentResult | null> {
  if (!FLAGS.intent) return null;

  const result: any = await tfFetch<any>('/v1/intent/classify', {
    message,
    tenant_id: tenantId,
  });

  if (!result) return null;

  return {
    intent: result.intent,
    confidence: result.confidence,
    allScores: result.allScores,
    source: result.source,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHURN PREDICTOR
// ─────────────────────────────────────────────────────────────────────────────

export async function predictChurn(params: {
  tenantId: string;
  plan: string;
  daysSinceLogin: number;
  messages7d: number;
  reservations30d: number;
  costUsd30d: number;
  budgetUsd: number;
  npsScore?: number;
  qtyRooms: number;
  uf: string;
  daysSinceOnboarding: number;
  errors7d: number;
  paymentOverdueDays: number;
}): Promise<ChurnResult | null> {
  if (!FLAGS.churn) return null;

  const result: any = await tfFetch<any>('/v1/churn/predict', {
    tenant_id: params.tenantId,
    plan: params.plan,
    days_since_login: params.daysSinceLogin,
    messages_7d: params.messages7d,
    reservations_30d: params.reservations30d,
    cost_usd_30d: params.costUsd30d,
    budget_usd: params.budgetUsd,
    nps_score: params.npsScore,
    qty_rooms: params.qtyRooms,
    uf: params.uf,
    days_since_onboarding: params.daysSinceOnboarding,
    errors_7d: params.errors7d,
    payment_overdue_days: params.paymentOverdueDays,
  });

  if (!result) return null;

  return {
    churnScore: result.churn_score ?? result.churnScore,
    riskLevel: (result.risk_level ?? result.riskLevel) as ChurnResult['riskLevel'],
    topFactors: result.top_factors ?? result.topFactors ?? [],
    source: result.source as ChurnResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LEAD SCORER
// ─────────────────────────────────────────────────────────────────────────────

export async function scoreLead(params: {
  qtyRooms: number;
  city: string;
  uf: string;
  valoresEstimados: string;
  tier: string;
  funnel: string;
  scoreQualificacao: number;
  scoreValidacao: number;
}): Promise<LeadScoreResult | null> {
  if (!FLAGS.lead) return null;

  const result: any = await tfFetch<any>('/v1/lead/score', {
    qty_rooms: params.qtyRooms,
    city: params.city,
    uf: params.uf,
    valores_estimados: params.valoresEstimados,
    tier: params.tier,
    funnel: params.funnel,
    score_qualificacao: params.scoreQualificacao,
    score_validacao: params.scoreValidacao,
  });

  if (!result) return null;

  return {
    conversionProbability: result.conversion_probability ?? result.conversionProbability,
    tierRecommended: result.tier_recommended ?? result.tierRecommended,
    source: result.source as LeadScoreResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ANOMALY DETECTOR
// ─────────────────────────────────────────────────────────────────────────────

export async function detectAnomaly(
  metrics: number[],
  metricNames?: string[]
): Promise<AnomalyResult | null> {
  if (!FLAGS.anomaly) return null;

  const result: any = await tfFetch<any>('/v1/anomaly/detect', {
    metrics,
    metric_names: metricNames,
  });

  if (!result) return null;

  return {
    isAnomaly: result.is_anomaly ?? result.isAnomaly,
    reconstructionError: result.reconstruction_error ?? result.reconstructionError,
    threshold: result.threshold,
    source: result.source as AnomalyResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. OCCUPANCY FORECASTER
// ─────────────────────────────────────────────────────────────────────────────

export async function forecastOccupancy(
  tenantId: string,
  historyDays: number[],
  forecastDays = 30
): Promise<OccupancyForecastResult | null> {
  if (!FLAGS.occupancy) return null;

  const result: any = await tfFetch<any>('/v1/occupancy/forecast', {
    tenant_id: tenantId,
    history_days: historyDays,
    forecast_days: forecastDays,
  });

  if (!result) return null;

  return {
    forecast: result.forecast,
    confidence: result.confidence,
    source: result.source as OccupancyForecastResult['source'],
    message: result.message,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SENTIMENT ANALYZER
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeSentiment(
  message: string,
  language = 'pt-BR'
): Promise<SentimentResult | null> {
  if (!FLAGS.sentiment) return null;

  const result: any = await tfFetch<any>('/v1/sentiment/analyze', {
    message,
    language,
  });

  if (!result) return null;

  return {
    sentiment: result.sentiment,
    label: result.label as SentimentResult['label'],
    source: result.source as SentimentResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PRICE OPTIMIZER
// ─────────────────────────────────────────────────────────────────────────────

export async function optimizePrice(params: {
  baseDailyRate: number;
  totalRooms: number;
  occupiedRooms: number;
  targetDate: string;
  isSpecialHoliday: boolean;
  uf: string;
  qtyRooms: number;
  forecastOccupancy?: number;
}): Promise<PriceOptimizeResult | null> {
  if (!FLAGS.price) return null;

  const result: any = await tfFetch<any>('/v1/price/optimize', {
    base_daily_rate: params.baseDailyRate,
    total_rooms: params.totalRooms,
    occupied_rooms: params.occupiedRooms,
    target_date: params.targetDate,
    is_special_holiday: params.isSpecialHoliday,
    uf: params.uf,
    qty_rooms: params.qtyRooms,
    forecast_occupancy: params.forecastOccupancy,
  });

  if (!result) return null;

  return {
    optimalPrice: result.optimal_price ?? result.optimalPrice,
    surgeMultiplier: result.surge_multiplier ?? result.surgeMultiplier,
    tier: result.tier,
    source: result.source as PriceOptimizeResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. UPSELL RECOMMENDER
// ─────────────────────────────────────────────────────────────────────────────

export async function recommendUpsell(
  guestProfile: Record<string, any>,
  plan = 'PRO',
  history: Array<Record<string, any>> = []
): Promise<UpsellResult | null> {
  if (!FLAGS.upsell) return null;

  const result: any = await tfFetch<any>('/v1/upsell/recommend', {
    guest_profile: guestProfile,
    plan,
    history,
  });

  if (!result) return null;

  return {
    recommendations: result.recommendations,
    source: result.source as UpsellResult['source'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS (para ZCC)
// ─────────────────────────────────────────────────────────────────────────────

export function getTfFlags() {
  return { ...FLAGS };
}

export function isTfEnabled(): boolean {
  return Object.values(FLAGS).some(v => v === true);
}
