// ============================================================================
// ZCC — Zélla Central Control | Core Cognitive Types
// ----------------------------------------------------------------------------
// These types are the lingua franca of the entire cognitive architecture.
// Every cortex, every adapter, every strategic decision speaks in these terms.
//
// Nothing in this file may import from anywhere else in the codebase.
// It is the lowest layer of the cognitive stack.
// ============================================================================

/**
 * The canonical learning pipeline every cortex must implement.
 *
 *   Observation  →  Inference  →  Hypothesis  →  Test
 *   →  Validation  →  Publication  →  Versioning  →  Memory
 *
 * Each stage emits an event on the ZCB so other cortexes can react.
 */
export type LearningStage =
  | 'observation'
  | 'inference'
  | 'hypothesis'
  | 'test'
  | 'validation'
  | 'publication'
  | 'versioning'
  | 'memory';

/**
 * Severity of a cognitive event.
 * - `info`: routine observation (a click, an impression, a webhook)
 * - `signal`: something potentially meaningful (a funnel bottleneck, an anomaly)
 * - `decision`: a cortex or ZGS chose a course of action
 * - `alert`: an experiment failed, a budget was breached, a regression was detected
 */
export type CognitiveSeverity = 'info' | 'signal' | 'decision' | 'alert';

/**
 * The unique identifier of a cortex.
 * Used as the `source` of every event and the `publisher` of every knowledge entry.
 */
export type CortexId =
  | 'zcc'
  | 'growth'
  | 'market-intelligence'
  | 'sales'
  | 'revenue'
  | 'success'
  | 'learning'
  | 'executive'
  | 'zgs';

/**
 * A single cognitive event flowing through the ZCB.
 *
 * Contracts:
 *  - `id` is unique and immutable.
 *  - `source` is the cortex that emitted the event.
 *  - `type` is a dotted string, e.g. `campaign.created`, `lead.converted`,
 *    `hypothesis.validated`. Cortexes subscribe to type prefixes.
 *  - `payload` is plain JSON-serialisable data. Never a class instance.
 *  - `severity` guides downstream routing (alerts → paging, decisions → audit log).
 *  - `correlationId` links events that belong to the same workflow
 *    (e.g. a single campaign's lifecycle from creation to ROI calculation).
 *  - `occurredAt` is ISO-8601 UTC.
 */
export interface CognitiveEvent {
  id: string;
  source: CortexId;
  type: string;
  payload: Record<string, unknown> | object;
  severity: CognitiveSeverity;
  correlationId?: string;
  occurredAt: string;
}

/**
 * A piece of validated, published knowledge that any cortex may consult.
 *
 * Knowledge is NOT raw data. It is the *conclusion* a cortex reached after
 * running the learning pipeline. Examples:
 *   - "CAC for Google Ads / pousada-niche / Praia Grande = R$ 42 ± 6"
 *   - "Airbnb-type leads convert 2.3x better on weekend evenings"
 *   - "Increasing WhatsApp response time > 5 min drops conversion by 18%"
 *
 * Contracts:
 *  - `id` is unique and immutable.
 *  - `publisher` is the cortex that produced this knowledge.
 *  - `version` is monotonically increasing within the same `id`.
 *  - `status` is `draft` while being tested, `validated` once published,
 *    `superseded` when a newer version replaces it, `retired` when withdrawn.
 *  - `evidence` lists the event ids that back this conclusion.
 *  - `confidence` is in [0, 1] and must be backed by evidence count + test result.
 *  - `validFrom` / `validUntil` define the temporal scope.
 */
export interface KnowledgeEntry {
  id: string;
  publisher: CortexId;
  type: string;
  title: string;
  body: Record<string, unknown> | object;
  confidence: number;
  evidence: string[];
  status: 'draft' | 'validated' | 'superseded' | 'retired';
  version: number;
  validFrom: string;
  validUntil?: string;
  publishedAt: string;
  supersededBy?: string;
}

/**
 * A handler subscribed to a class of events on the ZCB.
 * Subscriptions are by type prefix — `campaign.` matches `campaign.created`,
 * `campaign.paused`, etc.
 */
export type EventHandler = (event: CognitiveEvent) => void | Promise<void>;

/**
 * The mode the entire cognitive stack is operating in.
 *
 * - `digital-twin` — every adapter is a Mock. No external API is called.
 *                   This is the default and the permanent simulation mode.
 * - `production`   — adapters resolve to their Real implementations.
 *                   Toggled per-adapter via env, never globally.
 *
 * Note: even in `production`, the ZCC Digital Twin stays alive. New features
 * are still validated in twin mode before being promoted.
 */
export type OperatingMode = 'digital-twin' | 'production';

/**
 * Result of running an experiment in the ZCC Simulation Lab.
 */
export interface ExperimentResult {
  experimentId: string;
  hypothesis: string;
  eventsProcessed: number;
  durationMs: number;
  metrics: Record<string, number>;
  verdict: 'approved' | 'rejected' | 'inconclusive';
  notes?: string;
  finishedAt: string;
}

/**
 * A human-readable persona used by the Mock Behavioral Engine.
 * Each persona defines a customer journey archetype.
 */
export interface Persona {
  id: string;
  label: string;
  description: string;
  /** Probability weights for each step in a journey. */
  journeyWeights: Record<string, number>;
  /** Conversion rate multiplier vs. baseline. */
  conversionMultiplier: number;
  /** Average time-to-decision in minutes. */
  avgDecisionTimeMin: number;
}
