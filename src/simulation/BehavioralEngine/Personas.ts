// ============================================================================
// Personas — customer archetypes for the Behavioral Engine
// ----------------------------------------------------------------------------
// Six personas covering the major buyer archetypes in Brazilian hospitality:
//
//   1. curious     — kicks the tires, leaves, returns, researches, calls, buys
//   2. impulsive   — sees ad, clicks, buys same day
//   3. skeptical   — needs proof, compares 3 competitors, reads reviews
//   4. price-only  — only wants the cheapest, haggles, leaves if not discounted
//   5. chain       — represents a small hotel chain (3+ properties)
//   6. airbnb      — Airbnb host, not a pousada owner; different pain points
//
// Each persona defines:
//   - journeyWeights: probability of taking each step
//   - conversionMultiplier: vs. baseline (1.0 = average)
//   - avgDecisionTimeMin: how long they take to decide
// ============================================================================

import type { Persona } from '@/domain/zcc';

export const PERSONAS: Persona[] = [
  {
    id: 'curious',
    label: 'Curioso',
    description: 'Explora sem pressa. Vai, volta, pesquisa, liga, decide.',
    journeyWeights: {
      visit: 1.0,
      browse: 0.95,
      return: 0.7,
      research: 0.8,
      call: 0.4,
      demo: 0.5,
      propose: 0.4,
      convert: 0.35,
    },
    conversionMultiplier: 0.7,
    avgDecisionTimeMin: 60 * 24 * 5, // 5 days
  },
  {
    id: 'impulsive',
    label: 'Impulsivo',
    description: 'Vê o anúncio, clica, compra no mesmo dia.',
    journeyWeights: {
      visit: 1.0,
      browse: 0.9,
      return: 0.1,
      research: 0.05,
      call: 0.05,
      demo: 0.2,
      propose: 0.4,
      convert: 0.55,
    },
    conversionMultiplier: 1.8,
    avgDecisionTimeMin: 30,
  },
  {
    id: 'skeptical',
    label: 'Cético',
    description: 'Precisa de prova. Compara 3 concorrentes, lê reviews.',
    journeyWeights: {
      visit: 1.0,
      browse: 0.95,
      return: 0.9,
      research: 1.0,
      compare: 1.0,
      readReviews: 0.95,
      call: 0.6,
      demo: 0.7,
      propose: 0.5,
      convert: 0.25,
    },
    conversionMultiplier: 0.5,
    avgDecisionTimeMin: 60 * 24 * 10, // 10 days
  },
  {
    id: 'price-only',
    label: 'Só-quer-preço',
    description: 'Quer o mais barato. Pechincha, some se não tiver desconto.',
    journeyWeights: {
      visit: 1.0,
      browse: 0.7,
      return: 0.3,
      research: 0.5,
      call: 0.7,
      haggle: 0.9,
      demo: 0.1,
      propose: 0.3,
      convert: 0.15,
    },
    conversionMultiplier: 0.4,
    avgDecisionTimeMin: 60 * 24 * 2,
  },
  {
    id: 'chain',
    label: 'Pequena Rede',
    description: 'Representa uma pequena rede (3+ imóveis). Decisão mais longa.',
    journeyWeights: {
      visit: 1.0,
      browse: 0.95,
      return: 0.8,
      research: 0.9,
      call: 0.85,
      demo: 0.9,
      multiPropertyEval: 0.95,
      propose: 0.7,
      convert: 0.55,
    },
    conversionMultiplier: 1.4,
    avgDecisionTimeMin: 60 * 24 * 14, // 14 days
  },
  {
    id: 'airbnb',
    label: 'Anfitrião Airbnb',
    description: 'Host de Airbnb, não pousada. Dores diferentes (banimento, etc.).',
    journeyWeights: {
      visit: 1.0,
      browse: 0.9,
      return: 0.6,
      research: 0.7,
      call: 0.3,
      demo: 0.4,
      propose: 0.35,
      convert: 0.30,
    },
    conversionMultiplier: 0.8,
    avgDecisionTimeMin: 60 * 24 * 4,
  },
];

export function getPersonaById(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
