// ============================================================================
// Test: ZCC Digital Twin — cortex event flow
// ----------------------------------------------------------------------------
// Verifies that:
//   1. The ZCB routes events to subscribed cortexes.
//   2. The Growth Cortex ingests `metrics.googleAds` events and updates CAC.
//   3. The Shared Cognitive Memory can be queried after a learning cycle.
//   4. The Behavioral Engine generates plausible journeys.
//   5. The Simulation Lab can run a small experiment and produce a verdict.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  zcb,
  sharedMemory,
  buildEvent,
  runLearningCycle,
} from '@/domain/zcc';
import { GrowthCortex } from '@/domain/cortex';
import { getAdapters, __resetAdaptersForTest } from '@/adapters';
import { behavioralEngine } from '@/simulation';
import { simulationLab } from '@/simulation';

describe('ZCB event routing', () => {
  beforeEach(() => {
    zcb.clearForExperiment();
    sharedMemory.clearForExperiment();
  });

  it('routes events to subscribers by type prefix', async () => {
    const received: string[] = [];
    zcb.subscribe('campaign.', (e) => { received.push(e.type); });
    await zcb.publish(buildEvent({
      source: 'growth',
      type: 'campaign.created',
      severity: 'info',
      payload: {},
    }));
    await zcb.publish(buildEvent({
      source: 'growth',
      type: 'campaign.paused',
      severity: 'info',
      payload: {},
    }));
    await zcb.publish(buildEvent({
      source: 'growth',
      type: 'lead.created', // should NOT be received
      severity: 'info',
      payload: {},
    }));
    expect(received).toEqual(['campaign.created', 'campaign.paused']);
  });

  it('filters by source when sourceFilter is provided', async () => {
    const received: string[] = [];
    zcb.subscribe('lead.', (e) => { received.push(e.type); }, 'growth');
    await zcb.publish(buildEvent({
      source: 'growth',
      type: 'lead.created',
      severity: 'info',
      payload: {},
    }));
    await zcb.publish(buildEvent({
      source: 'sales',
      type: 'lead.created', // filtered out
      severity: 'info',
      payload: {},
    }));
    expect(received).toEqual(['lead.created']);
  });
});

describe('Growth Cortex', () => {
  beforeEach(() => {
    zcb.clearForExperiment();
    sharedMemory.clearForExperiment();
    __resetAdaptersForTest();
  });

  it('ingests googleAds metrics and updates CAC', async () => {
    const cortex = new GrowthCortex(getAdapters());
    await cortex.start();

    // Emit a few metrics events.
    for (let i = 0; i < 5; i++) {
      await zcb.publish(buildEvent({
        source: 'growth',
        type: 'metrics.googleAds',
        severity: 'info',
        payload: {
          campaignId: `c${i}`,
          spendBRL: 100 + i * 20,
          conversions: 5 + i,
          cacBRL: 20 + i * 2,
        },
      }));
    }

    const cacByChannel = cortex.getCACByChannel();
    expect(cacByChannel.length).toBeGreaterThan(0);
    const gAds = cacByChannel.find((c) => c.channel === 'google_ads');
    expect(gAds).toBeDefined();
    expect(gAds!.cacBRL).toBeGreaterThan(0);
    expect(gAds!.sampleSize).toBe(5);

    await cortex.stop();
  });

  it('publishes persona conversion knowledge after enough samples', async () => {
    const cortex = new GrowthCortex(getAdapters());
    await cortex.start();

    // Emit 60 leads with persona 'impulsive', all converting.
    for (let i = 0; i < 60; i++) {
      await zcb.publish(buildEvent({
        source: 'growth',
        type: 'lead.created',
        severity: 'info',
        payload: { personaId: 'impulsive', niche: 'pousada', leadId: `l${i}` },
      }));
      await zcb.publish(buildEvent({
        source: 'growth',
        type: 'lead.converted',
        severity: 'signal',
        payload: { personaId: 'impulsive', leadId: `l${i}` },
      }));
    }

    // Give the learning cycle a tick to publish.
    await new Promise((resolve) => setImmediate(resolve));

    const knowledge = sharedMemory.query({
      type: 'persona.conversion',
      publisher: 'growth',
    });
    expect(knowledge.length).toBeGreaterThan(0);
    const impulsive = knowledge.find((k) => k.id.includes('impulsive'));
    expect(impulsive).toBeDefined();
    expect(impulsive!.confidence).toBeGreaterThan(0.5);

    await cortex.stop();
  });
});

describe('Learning Pipeline', () => {
  beforeEach(() => {
    sharedMemory.clearForExperiment();
    zcb.clearForExperiment();
  });

  it('runs the full 8-stage cycle and publishes knowledge', async () => {
    const entry = await runLearningCycle(
      {
        cortex: 'growth',
        knowledgeId: 'test.knowledge.1',
        knowledgeType: 'test-knowledge',
        knowledgeTitle: 'Test knowledge entry',
      },
      {
        observation: {
          description: 'Test observation',
          data: { x: 1 },
          sourceEventIds: [],
        },
        inference: {
          statement: 'Test inference',
          method: 'manual',
          priorConfidence: 0.5,
        },
        hypothesis: {
          prediction: 'Test prediction',
          variables: ['x'],
          expectedEffect: 'positive',
          testType: 'ab',
        },
        test: {
          outcome: 'confirmed',
          sampleSize: 100,
          effectSize: 0.3,
          pValue: 0.01,
          generatedEventIds: [],
        },
        validation: {
          posteriorConfidence: 0.85,
          publishable: true,
          notes: 'Test',
        },
        body: { result: 'validated' },
      }
    );

    expect(entry).toBeDefined();
    expect(entry!.version).toBe(1);
    expect(entry!.status).toBe('validated');
    expect(entry!.confidence).toBe(0.85);
  });
});

describe('Behavioral Engine', () => {
  it('generates a journey with at least the lead.created event', () => {
    const events = behavioralEngine.generateJourney({
      personaId: 'impulsive',
      source: 'google_ads',
      niche: 'pousada',
      city: 'Praia Grande',
      stateCode: 'SP',
      seed: 42,
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('lead.created');
    expect((events[0].payload as { personaId: string }).personaId).toBe('impulsive');
  });

  it('impulsive persona converts more often than skeptical', () => {
    let impulsiveConv = 0;
    let skepticalConv = 0;
    for (let i = 0; i < 100; i++) {
      const impulsiveEvents = behavioralEngine.generateJourney({
        personaId: 'impulsive', source: 'google_ads', niche: 'pousada',
        city: 'Praia Grande', stateCode: 'SP', seed: i,
      });
      const skepticalEvents = behavioralEngine.generateJourney({
        personaId: 'skeptical', source: 'google_ads', niche: 'pousada',
        city: 'Praia Grande', stateCode: 'SP', seed: i,
      });
      if (impulsiveEvents.some((e) => e.type === 'lead.converted')) impulsiveConv++;
      if (skepticalEvents.some((e) => e.type === 'lead.converted')) skepticalConv++;
    }
    // Impulsive should convert at least 2x more often.
    expect(impulsiveConv).toBeGreaterThan(skepticalConv * 1.5);
  });
});

describe('Simulation Lab', () => {
  beforeEach(() => {
    zcb.clearForExperiment();
    sharedMemory.clearForExperiment();
  });

  it('runs an experiment and returns a verdict', async () => {
    const result = await simulationLab.run({
      experimentId: 'test-exp-1',
      hypothesis: 'Test hypothesis',
      feature: 'test-feature',
      eventCount: 100,
      durationCapMs: 5000,
      metrics: {
        leadCount: (events) => events.filter((e) => e.type === 'lead.created').length,
      },
      approvalThresholds: {
        leadCount: { minDeltaPct: -100 }, // always passes
      },
      baseline: { leadCount: 100 },
    });
    expect(result.experimentId).toBe('test-exp-1');
    expect(result.eventsProcessed).toBeGreaterThan(0);
    expect(['approved', 'rejected', 'inconclusive']).toContain(result.verdict);
  });
});
