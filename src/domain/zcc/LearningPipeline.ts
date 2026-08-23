// ============================================================================
// Learning Pipeline
// ----------------------------------------------------------------------------
// The canonical 8-stage learning cycle every cortex must run.
//
//   Observation  →  Inference  →  Hypothesis  →  Test
//   →  Validation  →  Publication  →  Versioning  →  Memory
//
// Cortexes do NOT need to call these helpers — they can implement the cycle
// themselves. But using this helper guarantees:
//   - Every stage emits a `learning.<stage>` event on the ZCB.
//   - The Shared Cognitive Memory is updated atomically on validation.
//   - Versions are bumped correctly.
//   - Evidence (event ids) is preserved end-to-end.
// ============================================================================

import type { CortexId, KnowledgeEntry, CognitiveEvent } from './types';
import { zcb, buildEvent } from './ZCB';
import { sharedMemory } from './SharedCognitiveMemory';

export interface Observation {
  /** What was observed, in plain language. */
  description: string;
  /** Raw signal data backing the observation. */
  data: Record<string, unknown> | object;
  /** Source event ids that triggered this observation. */
  sourceEventIds: string[];
}

export interface Inference {
  /** Statistical or qualitative conclusion drawn from observations. */
  statement: string;
  /** How the inference was reached — method name + parameters. */
  method: string;
  /** Confidence in [0, 1] before hypothesis testing. */
  priorConfidence: number;
}

export interface Hypothesis {
  /** Testable prediction derived from the inference. */
  prediction: string;
  /** The independent variable(s) to manipulate. */
  variables: string[];
  /** The expected direction and magnitude of the effect. */
  expectedEffect: string;
  /** The statistical test to apply. */
  testType: 'ab' | 'before-after' | 'correlation' | 'simulation';
}

export interface TestResult {
  /** Did the test confirm the hypothesis? */
  outcome: 'confirmed' | 'refuted' | 'inconclusive';
  /** Sample size used. */
  sampleSize: number;
  /** Effect size observed (e.g. lift %, correlation r). */
  effectSize: number;
  /** p-value if applicable, else NaN. */
  pValue: number;
  /** Event ids generated during the test (synthetic or real). */
  generatedEventIds: string[];
}

export interface Validation {
  /** Final confidence in [0, 1] after test. */
  posteriorConfidence: number;
  /** Whether the result justifies publication. */
  publishable: boolean;
  /** Reviewer notes (a cortex self-reviews; ZCC can override). */
  notes: string;
}

export interface LearningRunOptions {
  cortex: CortexId;
  correlationId?: string;
  knowledgeId: string;
  knowledgeType: string;
  knowledgeTitle: string;
}

/**
 * Run a single learning cycle from observation to memory publication.
 * Returns the published KnowledgeEntry (or undefined if not publishable).
 *
 * Cortexes typically call this with their own observations, inferences,
 * hypotheses, and test results. The helper handles the bookkeeping.
 */
export async function runLearningCycle(
  opts: LearningRunOptions,
  stages: {
    observation: Observation;
    inference: Inference;
    hypothesis: Hypothesis;
    test: TestResult;
    validation: Validation;
    /** Final body of the knowledge entry. */
    body: Record<string, unknown> | object;
  }
): Promise<KnowledgeEntry | undefined> {
  const { cortex, correlationId, knowledgeId, knowledgeType, knowledgeTitle } = opts;

  // Stage 1: Observation
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.observation',
      severity: 'info',
      correlationId,
      payload: {
        knowledgeId,
        description: stages.observation.description,
        sourceEventIds: stages.observation.sourceEventIds,
      },
    })
  );

  // Stage 2: Inference
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.inference',
      severity: 'info',
      correlationId,
      payload: {
        knowledgeId,
        statement: stages.inference.statement,
        method: stages.inference.method,
        priorConfidence: stages.inference.priorConfidence,
      },
    })
  );

  // Stage 3: Hypothesis
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.hypothesis',
      severity: 'signal',
      correlationId,
      payload: {
        knowledgeId,
        prediction: stages.hypothesis.prediction,
        variables: stages.hypothesis.variables,
        expectedEffect: stages.hypothesis.expectedEffect,
        testType: stages.hypothesis.testType,
      },
    })
  );

  // Stage 4: Test
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.test',
      severity: 'info',
      correlationId,
      payload: {
        knowledgeId,
        outcome: stages.test.outcome,
        sampleSize: stages.test.sampleSize,
        effectSize: stages.test.effectSize,
        pValue: stages.test.pValue,
      },
    })
  );

  // Stage 5: Validation
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.validation',
      severity: 'signal',
      correlationId,
      payload: {
        knowledgeId,
        posteriorConfidence: stages.validation.posteriorConfidence,
        publishable: stages.validation.publishable,
        notes: stages.validation.notes,
      },
    })
  );

  if (!stages.validation.publishable) {
    return undefined;
  }

  // Stage 6: Publication (also emits `knowledge.published` via sharedMemory)
  const evidence = [
    ...stages.observation.sourceEventIds,
    ...stages.test.generatedEventIds,
  ];
  const entry = await sharedMemory.publish({
    id: knowledgeId,
    publisher: cortex,
    type: knowledgeType,
    title: knowledgeTitle,
    body: stages.body,
    confidence: stages.validation.posteriorConfidence,
    evidence,
    validFrom: new Date().toISOString(),
  });

  // Stage 7: Versioning — already handled inside sharedMemory.publish()
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.versioning',
      severity: 'info',
      correlationId,
      payload: {
        knowledgeId: entry.id,
        version: entry.version,
        previousVersion: entry.version - 1,
      },
    })
  );

  // Stage 8: Memory — confirm the entry is queryable
  await zcb.publish(
    buildEvent({
      source: cortex,
      type: 'learning.memory',
      severity: 'info',
      correlationId,
      payload: {
        knowledgeId: entry.id,
        version: entry.version,
        memorySize: sharedMemory.size(),
      },
    })
  );

  return entry;
}

/**
 * Replay an event stream into a learning cortex to rebuild its knowledge.
 * Used on cold start and after a memory reset.
 */
export async function warmStartFromEvents(
  cortex: CortexId,
  eventStream: CognitiveEvent[]
): Promise<void> {
  for (const event of eventStream) {
    if (event.source === cortex) {
      // Cortexes that want warm-start implement their own event handlers;
      // this helper just re-publishes the events for the cortex to consume.
      await zcb.publish(event);
    }
  }
}
