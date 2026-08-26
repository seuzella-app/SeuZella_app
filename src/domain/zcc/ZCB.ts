// ============================================================================
// ZCB — Zélla Cognitive Bus
// ----------------------------------------------------------------------------
// The single event bus for the entire cognitive architecture.
//
// INVARIANTS (enforced by ZCC governance):
//  1. Cortexes NEVER call each other directly. They publish events here.
//  2. Adapters NEVER call cortexes. They emit events on state changes.
//  3. ZCB has zero business logic — it routes, persists, and replays.
//  4. All events are append-only and immutable. Corrections are new events.
//  5. Every event is JSON-serialisable (no class instances, no Dates, no Maps).
//
// This in-process implementation is the reference. The contract is identical
// for a future Redis/NATS-backed bus — only the transport changes.
// ============================================================================

import type { CognitiveEvent, EventHandler, CortexId } from './types';

type Subscription = {
  id: string;
  prefix: string;
  handler: EventHandler;
  sourceFilter?: CortexId;
};

class ZellaCognitiveBus {
  private subscriptions: Subscription[] = [];
  private eventLog: CognitiveEvent[] = [];
  private maxLogSize = 100_000;

  /**
   * Subscribe to events whose `type` starts with `prefix`.
   * Use `sourceFilter` to listen only to a specific cortex.
   * Returns an unsubscribe function.
   */
  subscribe(
    prefix: string,
    handler: EventHandler,
    sourceFilter?: CortexId
  ): () => void {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const subscription: Subscription = { id, prefix, handler, sourceFilter };
    this.subscriptions.push(subscription);
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
    };
  }

  /**
   * Publish an event. Handlers are invoked asynchronously in subscription order.
   * Handler errors are swallowed (after being logged as `bus.handler.error`
   * events) so one bad subscriber cannot poison the bus.
   */
  async publish(event: CognitiveEvent): Promise<void> {
    // Append to the immutable log first.
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.splice(0, this.eventLog.length - this.maxLogSize);
    }

    // Fan out to matching subscribers.
    const matching = this.subscriptions.filter(
      (s) =>
        event.type.startsWith(s.prefix) &&
        (!s.sourceFilter || s.sourceFilter === event.source)
    );

    await Promise.all(
      matching.map(async (s) => {
        try {
          await s.handler(event);
        } catch (err) {
          // Self-correction without recursion: log to console only.
          // (We avoid publishing a `bus.handler.error` event to prevent
          // infinite loops if the error handler itself errors.)
           
          console.error(
            `[ZCB] handler ${s.id} failed on ${event.type}:`,
            err
          );
        }
      })
    );
  }

  /**
   * Replay the last N events to a handler. Useful for cortex warm-start,
   * bug reproduction in the Simulation Lab, and audit.
   */
  async replay(handler: EventHandler, lastN = 1000): Promise<void> {
    const slice = this.eventLog.slice(-lastN);
    for (const event of slice) {
      try {
        await handler(event);
      } catch (err) {
         
        console.error('[ZCB] replay handler failed:', err);
      }
    }
  }

  /**
   * Inspect the log — primarily for the Simulation Lab and observability UI.
   */
  inspect(filter?: {
    typePrefix?: string;
    source?: CortexId;
    since?: string;
    limit?: number;
  }): CognitiveEvent[] {
    let slice = this.eventLog;
    if (filter?.typePrefix) {
      slice = slice.filter((e) => e.type.startsWith(filter.typePrefix!));
    }
    if (filter?.source) {
      slice = slice.filter((e) => e.source === filter.source);
    }
    if (filter?.since) {
      slice = slice.filter((e) => e.occurredAt >= filter.since!);
    }
    const limit = filter?.limit ?? 1000;
    return slice.slice(-limit);
  }

  /**
   * Total event count — used by health checks.
   */
  size(): number {
    return this.eventLog.length;
  }

  /**
   * Clear the log. Used ONLY by the Simulation Lab between experiments
   * to ensure a clean baseline. Production never calls this.
   */
  clearForExperiment(): void {
    this.eventLog = [];
  }
}

/**
 * The singleton ZCB instance for the entire process.
 * Every cortex, adapter, and strategic layer imports this same object.
 */
export const zcb = new ZellaCognitiveBus();

/**
 * Helper to build a well-formed event.
 * Generates id + occurredAt if not provided.
 */
export function buildEvent(
  partial: Omit<CognitiveEvent, 'id' | 'occurredAt'> &
    Partial<Pick<CognitiveEvent, 'id' | 'occurredAt'>>
): CognitiveEvent {
  return {
    id: partial.id ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    occurredAt: partial.occurredAt ?? new Date().toISOString(),
    ...partial,
  };
}
