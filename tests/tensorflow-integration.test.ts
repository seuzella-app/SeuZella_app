/**
 * Testes do TensorFlow Integration (8 modelos + cliente TS)
 * ==========================================================
 *
 * Mocka o sidecar Python via fetch mock — não precisa do Python rodando.
 * Valida:
 *   1. Cliente TS faz chamadas HTTP corretas
 *   2. Fallback gracioso quando sidecar offline
 *   3. Feature flags ativam/desativam modelos
 *   4. Estrutura do sidecar Python (sintaxe básica)
 *   5. Docker compose config
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Mock do fetch para simular sidecar ───────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock do log-sink
vi.mock('@/lib/cerebro/log-sink', () => ({
  log: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

import {
  classifyIntent,
  predictChurn,
  scoreLead,
  detectAnomaly,
  forecastOccupancy,
  analyzeSentiment,
  optimizePrice,
  recommendUpsell,
  checkHealth,
  getTfFlags,
  isTfEnabled,
} from '../src/lib/ai/tf-client';

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 1: Feature Flags
// ─────────────────────────────────────────────────────────────────────────────

// Import dinâmico para resetar módulo após mudar env vars
async function importTfClient() {
  vi.resetModules();
  return await import('../src/lib/ai/tf-client');
}

// PARTE 1: Feature Flags
describe('PARTE 1: Feature Flags', () => {
  it('getTfFlags() retorna objeto com 8 flags', async () => {
    const tf = await importTfClient();
    const flags = tf.getTfFlags();
    expect(flags).toHaveProperty('intent');
    expect(flags).toHaveProperty('churn');
    expect(flags).toHaveProperty('lead');
    expect(flags).toHaveProperty('anomaly');
    expect(flags).toHaveProperty('occupancy');
    expect(flags).toHaveProperty('sentiment');
    expect(flags).toHaveProperty('price');
    expect(flags).toHaveProperty('upsell');
  });

  it('isTfEnabled() retorna boolean', async () => {
    const tf = await importTfClient();
    expect(typeof tf.isTfEnabled()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 2: Fallback quando feature flag OFF
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 2: Fallback quando feature flag OFF', () => {
  beforeEach(() => {
    // Reset env vars
    delete process.env.USE_TF_INTENT;
    delete process.env.USE_TF_CHURN;
    delete process.env.USE_TF_LEAD;
    delete process.env.USE_TF_ANOMALY;
    delete process.env.USE_TF_OCCUPANCY;
    delete process.env.USE_TF_SENTIMENT;
    delete process.env.USE_TF_PRICE;
    delete process.env.USE_TF_UPSELL;
  });

  it('classifyIntent retorna null quando flag off', async () => {
    const tf = await importTfClient();
    const result = await tf.classifyIntent('qual o preço?');
    expect(result).toBeNull();
  });

  it('predictChurn retorna null quando flag off', async () => {
    const tf = await importTfClient();
    const result = await tf.predictChurn({
      tenantId: 't1', plan: 'pro', daysSinceLogin: 0,
      messages7d: 10, reservations30d: 5, costUsd30d: 1, budgetUsd: 20,
      qtyRooms: 10, uf: 'SP', daysSinceOnboarding: 30, errors7d: 0,
      paymentOverdueDays: 0,
    });
    expect(result).toBeNull();
  });

  it('analyzeSentiment retorna null quando flag off', async () => {
    const tf = await importTfClient();
    const result = await tf.analyzeSentiment('ótimo!');
    expect(result).toBeNull();
  });

  it('optimizePrice retorna null quando flag off', async () => {
    const tf = await importTfClient();
    const result = await tf.optimizePrice({
      baseDailyRate: 500, totalRooms: 10, occupiedRooms: 8,
      targetDate: '2026-12-31', isSpecialHoliday: true,
      uf: 'BA', qtyRooms: 10,
    });
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 3: Integração com sidecar (mock HTTP)
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 3: Integração com sidecar (mock HTTP)', () => {
  beforeEach(async () => {
    // Ativa flags
    process.env.USE_TF_INTENT = 'true';
    process.env.USE_TF_CHURN = 'true';
    process.env.USE_TF_SENTIMENT = 'true';
    process.env.USE_TF_PRICE = 'true';
    process.env.USE_TF_LEAD = 'true';
    process.env.USE_TF_ANOMALY = 'true';
    process.env.USE_TF_OCCUPANCY = 'true';
    process.env.USE_TF_UPSELL = 'true';
    mockFetch.mockReset();
  });

  it('classifyIntent chama sidecar e retorna resultado neural', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        intent: 'cotacao_reserva',
        confidence: 0.95,
        all_scores: { cotacao_reserva: 0.95 },
        source: 'neural',
      }),
    });

    const tf = await importTfClient();
    const result = await tf.classifyIntent('qual o preço?');
    expect(result).not.toBeNull();
    expect(result!.intent).toBe('cotacao_reserva');
    expect(result!.confidence).toBe(0.95);
    expect(result!.source).toBe('neural');
  });

  it('predictChurn retorna risk level corretamente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        churn_score: 0.85,
        risk_level: 'critical',
        top_factors: ['Inativo 20 dias'],
        source: 'neural',
      }),
    });

    const tf = await importTfClient();
    const result = await tf.predictChurn({
      tenantId: 't1', plan: 'pro', daysSinceLogin: 20,
      messages7d: 5, reservations30d: 0, costUsd30d: 0.5, budgetUsd: 20,
      qtyRooms: 10, uf: 'SP', daysSinceOnboarding: 90, errors7d: 8,
      paymentOverdueDays: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.riskLevel).toBe('critical');
    expect(result!.topFactors).toContain('Inativo 20 dias');
  });

  it('analyzeSentiment retorna label positive', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sentiment: 0.8,
        label: 'positive',
        source: 'neural',
      }),
    });

    const tf = await importTfClient();
    const result = await tf.analyzeSentiment('foi ótimo, adorei!');
    expect(result).not.toBeNull();
    expect(result!.label).toBe('positive');
    expect(result!.sentiment).toBeGreaterThan(0);
  });

  it('optimizePrice retorna preço ótimo', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        optimal_price: 1500,
        surge_multiplier: 1.5,
        source: 'neural',
      }),
    });

    const tf = await importTfClient();
    const result = await tf.optimizePrice({
      baseDailyRate: 1000, totalRooms: 10, occupiedRooms: 9,
      targetDate: '2026-12-31', isSpecialHoliday: true,
      uf: 'BA', qtyRooms: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.optimalPrice).toBe(1500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 4: Fallback gracioso quando sidecar offline
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 4: Fallback gracioso quando sidecar offline', () => {
  beforeEach(async () => {
    process.env.USE_TF_INTENT = 'true';
    process.env.USE_TF_CHURN = 'true';
    // Simula sidecar offline (connection refused)
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
  });

  it('classifyIntent retorna null quando sidecar offline', async () => {
    const tf = await importTfClient();
    const result = await tf.classifyIntent('qual o preço?');
    expect(result).toBeNull();
  });

  it('predictChurn retorna null quando sidecar offline', async () => {
    const tf = await importTfClient();
    const result = await tf.predictChurn({
      tenantId: 't1', plan: 'pro', daysSinceLogin: 20,
      messages7d: 5, reservations30d: 0, costUsd30d: 0.5, budgetUsd: 20,
      qtyRooms: 10, uf: 'SP', daysSinceOnboarding: 90, errors7d: 8,
      paymentOverdueDays: 10,
    });
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 5: Health Check
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 5: Health Check', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('checkHealth retorna online=true quando sidecar responde', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        tf_version: '2.22.0',
        models_loaded: ['intent_classifier', 'churn_predictor'],
        models_available: ['intent_classifier.keras'],
      }),
    });

    const tf = await importTfClient();
    const result = await tf.checkHealth();
    expect(result.online).toBe(true);
    expect(result.modelsLoaded).toContain('intent_classifier');
    expect(result.tfVersion).toBe('2.22.0');
  });

  it('checkHealth retorna online=false quando sidecar offline', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const tf = await importTfClient();
    const result = await tf.checkHealth();
    expect(result.online).toBe(false);
    expect(result.modelsLoaded).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 6: Estrutura do Sidecar Python (validação de arquivos)
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 6: Estrutura do Sidecar Python', () => {
  const SIDECAR_DIR = path.resolve(process.cwd(), 'deploy/tensorflow-sidecar');

  it('app.py existe e contém 8 endpoints', () => {
    const appPath = path.join(SIDECAR_DIR, 'app.py');
    expect(fs.existsSync(appPath)).toBe(true);

    const content = fs.readFileSync(appPath, 'utf-8');
    // Verifica os 8 endpoints
    expect(content).toContain('/v1/intent/classify');
    expect(content).toContain('/v1/churn/predict');
    expect(content).toContain('/v1/lead/score');
    expect(content).toContain('/v1/anomaly/detect');
    expect(content).toContain('/v1/occupancy/forecast');
    expect(content).toContain('/v1/sentiment/analyze');
    expect(content).toContain('/v1/price/optimize');
    expect(content).toContain('/v1/upsell/recommend');
  });

  it('requirements.txt contém tensorflow-cpu', () => {
    const reqPath = path.join(SIDECAR_DIR, 'requirements.txt');
    expect(fs.existsSync(reqPath)).toBe(true);

    const content = fs.readFileSync(reqPath, 'utf-8');
    expect(content).toContain('tensorflow-cpu');
    expect(content).toContain('fastapi');
  });

  it('Dockerfile existe', () => {
    const dockerPath = path.join(SIDECAR_DIR, 'Dockerfile');
    expect(fs.existsSync(dockerPath)).toBe(true);
  });

  it('train/train_all.py existe e contém 8 modelos', () => {
    const trainPath = path.join(SIDECAR_DIR, 'train', 'train_all.py');
    expect(fs.existsSync(trainPath)).toBe(true);

    const content = fs.readFileSync(trainPath, 'utf-8');
    expect(content).toContain('intent_classifier');
    expect(content).toContain('churn_predictor');
    expect(content).toContain('lead_scorer');
    expect(content).toContain('anomaly_detector');
    expect(content).toContain('occupancy_forecaster');
    expect(content).toContain('sentiment_analyzer');
    expect(content).toContain('price_optimizer');
    expect(content).toContain('upsell_recommender');
  });

  it('docker-compose.tensorflow.yml existe', () => {
    const composePath = path.resolve(process.cwd(), 'docker-compose.tensorflow.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('tf-sidecar');
    expect(content).toContain('8501');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 7: Cliente TypeScript — estrutura
// ─────────────────────────────────────────────────────────────────────────────

describe('PARTE 7: Cliente TypeScript', () => {
  const CLIENT_PATH = path.resolve(process.cwd(), 'src/lib/ai/tf-client.ts');

  it('tf-client.ts existe', () => {
    expect(fs.existsSync(CLIENT_PATH)).toBe(true);
  });

  it('tf-client.ts contém 8 funções exportadas', () => {
    const content = fs.readFileSync(CLIENT_PATH, 'utf-8');
    expect(content).toContain('export async function classifyIntent');
    expect(content).toContain('export async function predictChurn');
    expect(content).toContain('export async function scoreLead');
    expect(content).toContain('export async function detectAnomaly');
    expect(content).toContain('export async function forecastOccupancy');
    expect(content).toContain('export async function analyzeSentiment');
    expect(content).toContain('export async function optimizePrice');
    expect(content).toContain('export async function recommendUpsell');
  });

  it('tf-client.ts contém feature flags', () => {
    const content = fs.readFileSync(CLIENT_PATH, 'utf-8');
    expect(content).toContain('USE_TF_INTENT');
    expect(content).toContain('USE_TF_CHURN');
    expect(content).toContain('USE_TF_PRICE');
    expect(content).toContain('USE_TF_UPSELL');
  });

  it('tf-client.ts contém fallback gracioso', () => {
    const content = fs.readFileSync(CLIENT_PATH, 'utf-8');
    // Retorna null quando flag off → caller usa heurística
    expect(content).toContain('return null');
    // Retorna null quando fetch falha → caller usa heurística
    expect(content).toContain('catch');
  });
});
