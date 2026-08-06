// ============================================================================
// Behavioral Engine — simulates customer journeys
// ----------------------------------------------------------------------------
// Given a persona and a starting context (source, niche, city), the engine
// generates a sequence of cognitive events that mimic how a real customer
// of that persona would behave.
//
// Events emitted:
//   - lead.created            (always, when journey starts)
//   - funnel.step             (one per step taken, with droppedOff flag)
//   - lead.converted          (if journey reaches conversion)
//   - lead.lost               (if journey drops off before conversion)
//   - sales.objection         (for skeptical / price-only personas)
//   - whatsapp.message        (if persona calls / messages)
//
// The engine is deterministic per-seed: same persona + same seed = same journey.
// ============================================================================

import type { CognitiveEvent, CortexId } from '@/domain/zcc';
import { mulberry32, seedFromString, weightedPick } from '@/adapters/mock';
import { getPersonaById } from './Personas';

export interface JourneyContext {
  personaId: string;
  source: 'google_ads' | 'meta_ads' | 'organic' | 'referral' | 'whatsapp' | 'direct';
  niche: 'pousada' | 'airbnb' | 'hotel' | 'small-hotel';
  city: string;
  stateCode: string;
  /** Optional tenantId this lead will be attributed to. */
  tenantId?: string;
  /** Optional ad campaignId that drove the visit. */
  campaignId?: string;
  /** Seed for reproducibility. */
  seed?: number;
  /** When the journey started. */
  startedAt?: string;
}

const FUNNEL_STEPS = [
  'visit',
  'browse',
  'return',
  'research',
  'compare',
  'readReviews',
  'call',
  'haggle',
  'multiPropertyEval',
  'demo',
  'propose',
  'convert',
] as const;

const OBJECTIONS = [
  'caro demais',
  'preciso pensar',
  'vou comparar com concorrente',
  'tem taxa de setup?',
  'posso pagar mensal?',
  'como funciona o onboarding?',
  'tem multa?',
  'suporte é em português?',
  'integra com Booking?',
  'integra com Airbnb?',
];

export class BehavioralEngine {
  /**
   * Generate a single customer journey as a list of cognitive events.
   * The events are NOT published on the ZCB by this method — the caller
   * decides when / whether to publish them (e.g. in real-time for
   * live simulation, or in batch for Simulation Lab experiments).
   */
  generateJourney(ctx: JourneyContext): CognitiveEvent[] {
    const persona = getPersonaById(ctx.personaId);
    if (!persona) {
      throw new Error(`Unknown persona: ${ctx.personaId}`);
    }
    const seed = ctx.seed ?? seedFromString(`${ctx.personaId}:${ctx.city}:${Date.now()}`);
    const rng = mulberry32(seed);
    const startedAt = ctx.startedAt ?? new Date().toISOString();
    const leadId = `lead_${seed.toString(36)}_${Math.floor(rng() * 1e6).toString(36)}`;
    const events: CognitiveEvent[] = [];
    const correlationId = `journey_${leadId}`;
    let now = Date.parse(startedAt);
    const advance = (minutes: number) => {
      now += minutes * 60_000;
    };

    // 1. Lead created.
    events.push(this.makeEvent({
      source: 'growth',
      type: 'lead.created',
      severity: 'info',
      correlationId,
      occurredAt: new Date(now).toISOString(),
      payload: {
        leadId,
        personaId: ctx.personaId,
        niche: ctx.niche,
        source: ctx.source,
        city: ctx.city,
        stateCode: ctx.stateCode,
        tenantId: ctx.tenantId,
        campaignId: ctx.campaignId,
      },
    }));

    // 2. Walk the funnel steps.
    //
    // Semantics:
    //   - `weight` is the probability of TAKING this step (vs skipping it).
    //     Skipping is NOT dropping off — the customer simply moves to the
    //     next step. This lets personas like "impulsive" skip "return" /
    //     "research" without being marked as lost.
    //   - Drop-off is modelled separately: at each step the customer has a
    //     `dropoffRate` chance of giving up. `dropoffRate` is derived from
    //     the persona's `conversionMultiplier` (lower multiplier → higher
    //     dropoff).
    const dropoffRate = Math.max(0.02, Math.min(0.4, (1 - persona.conversionMultiplier) * 0.3));
    let droppedOff = false;
    for (const step of FUNNEL_STEPS) {
      if (droppedOff) break;
      const weight = persona.journeyWeights[step] ?? 0;
      if (weight <= 0) continue;

      // Roll for drop-off first.
      if (rng() < dropoffRate) {
        events.push(this.makeEvent({
          source: 'growth',
          type: 'funnel.step',
          severity: 'info',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: { leadId, step, droppedOff: true },
        }));
        events.push(this.makeEvent({
          source: 'growth',
          type: 'lead.lost',
          severity: 'signal',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: {
            leadId,
            personaId: ctx.personaId,
            niche: ctx.niche,
            reason: `dropped-off-at-${step}`,
          },
        }));
        droppedOff = true;
        break;
      }

      // Roll for whether the customer takes this step (vs skipping it).
      if (rng() > weight) {
        // Skipped — move to the next step.
        continue;
      }

      // Customer took the step.
      events.push(this.makeEvent({
        source: 'growth',
        type: 'funnel.step',
        severity: 'info',
        correlationId,
        occurredAt: new Date(now).toISOString(),
        payload: { leadId, step, droppedOff: false },
      }));

      // Side-effects of certain steps:
      if (step === 'call') {
        events.push(this.makeEvent({
          source: 'sales',
          type: 'whatsapp.message',
          severity: 'info',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: { leadId, direction: 'inbound', body: 'Olá, quero saber mais' },
        }));
      }
      if (step === 'haggle' || step === 'compare') {
        events.push(this.makeEvent({
          source: 'sales',
          type: 'sales.objection',
          severity: 'signal',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: {
            leadId,
            niche: ctx.niche,
            objection: weightedPick(rng, OBJECTIONS, OBJECTIONS.map(() => 1)),
          },
        }));
      }
      if (step === 'demo') {
        events.push(this.makeEvent({
          source: 'sales',
          type: 'lead.stage.changed',
          severity: 'info',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: { leadId, newStage: 'qualified' },
        }));
      }
      if (step === 'propose') {
        events.push(this.makeEvent({
          source: 'sales',
          type: 'lead.stage.changed',
          severity: 'info',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: { leadId, newStage: 'proposal' },
        }));
      }
      if (step === 'convert') {
        // Final conversion event.
        events.push(this.makeEvent({
          source: 'growth',
          type: 'lead.converted',
          severity: 'signal',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: {
            leadId,
            personaId: ctx.personaId,
            niche: ctx.niche,
            source: ctx.source,
            daysToClose: Math.floor((now - Date.parse(startedAt)) / (24 * 60 * 60 * 1000)),
          },
        }));
        events.push(this.makeEvent({
          source: 'sales',
          type: 'lead.won',
          severity: 'signal',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: {
            leadId,
            niche: ctx.niche,
            daysToClose: Math.floor((now - Date.parse(startedAt)) / (24 * 60 * 60 * 1000)),
          },
        }));
        events.push(this.makeEvent({
          source: 'revenue',
          type: 'subscription.created',
          severity: 'signal',
          correlationId,
          occurredAt: new Date(now).toISOString(),
          payload: {
            leadId,
            niche: ctx.niche,
            plan: this.pickPlan(rng, ctx.niche),
            tenantId: ctx.tenantId ?? `tenant_${leadId}`,
          },
        }));
      }

      // Advance the clock by a fraction of the persona's decision time.
      advance(persona.avgDecisionTimeMin / FUNNEL_STEPS.length);
    }

    return events;
  }

  /**
   * Generate N journeys for a given persona distribution.
   * Returns the concatenated events.
   */
  generateJourneys(
    count: number,
    personaDistribution: { personaId: string; weight: number }[],
    baseCtx: Omit<JourneyContext, 'personaId' | 'seed'>,
    seed = 42
  ): CognitiveEvent[] {
    const rng = mulberry32(seed);
    const personas = personaDistribution.map((p) => p.personaId);
    const weights = personaDistribution.map((p) => p.weight);
    const allEvents: CognitiveEvent[] = [];
    for (let i = 0; i < count; i++) {
      const personaId = weightedPick(rng, personas, weights);
      const journey = this.generateJourney({
        ...baseCtx,
        personaId,
        seed: seed + i,
        startedAt: new Date(Date.now() - (count - i) * 60_000).toISOString(),
      });
      allEvents.push(...journey);
    }
    return allEvents;
  }

  private pickPlan(rng: () => number, niche: string): string {
    if (niche === 'airbnb') return rng() < 0.6 ? 'LITE' : 'PRO';
    if (niche === 'small-hotel') return rng() < 0.5 ? 'MAX' : 'PRO';
    return rng() < 0.4 ? 'LITE' : rng() < 0.8 ? 'PRO' : 'MAX';
  }

  private makeEvent(opts: {
    source: CortexId;
    type: string;
    severity: CognitiveEvent['severity'];
    correlationId: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }): CognitiveEvent {
    return {
      id: `evt_${opts.source}_${opts.type.replace(/\./g, '_')}_${Date.now()}_${Math.floor(Math.random() * 1e6).toString(36)}`,
      ...opts,
    };
  }
}

export const behavioralEngine = new BehavioralEngine();
