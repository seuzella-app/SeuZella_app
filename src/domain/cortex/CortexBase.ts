// ============================================================================
// CortexBase — abstract foundation for every cortex
// ----------------------------------------------------------------------------
// Every cortex extends this base. The base provides:
//   - Access to the ZCB (publish/subscribe).
//   - Access to the Shared Cognitive Memory.
//   - Access to the AdapterBundle (Mock or Real — cortex never knows).
//   - Standard `start()` / `stop()` lifecycle hooks the ZCC can call.
//   - Subscription bookkeeping so `stop()` cleanly unsubscribes.
//
// Cortexes override `onStart()` to register subscriptions and seed knowledge,
// and `onStop()` for any cleanup.
// ============================================================================

import type {
  CortexId,
  CognitiveEvent,
  EventHandler,
} from '@/domain/zcc';
import { zcb, sharedMemory } from '@/domain/zcc';
import type { AdapterBundle } from '@/adapters';

export abstract class CortexBase {
  abstract readonly id: CortexId;
  protected readonly bus = zcb;
  protected readonly memory = sharedMemory;
  protected readonly adapters: AdapterBundle;

  private unsubs: Array<() => void> = [];
  private running = false;

  constructor(adapters: AdapterBundle) {
    this.adapters = adapters;
  }

  /**
   * Called by ZCC on boot. Subclasses override `onStart()` instead.
   */
  async start(): Promise<void> {
    if (this.running) return;
    await this.onStart();
    this.running = true;
    await this.bus.publish({
      id: `evt_cortex_start_${this.id}_${Date.now()}`,
      source: this.id,
      type: 'cortex.lifecycle.started',
      severity: 'info',
      payload: { cortex: this.id },
      occurredAt: new Date().toISOString(),
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    await this.onStop();
    for (const unsub of this.unsubs) {
      try { unsub(); } catch { /* ignore */ }
    }
    this.unsubs = [];
    this.running = false;
    await this.bus.publish({
      id: `evt_cortex_stop_${this.id}_${Date.now()}`,
      source: this.id,
      type: 'cortex.lifecycle.stopped',
      severity: 'info',
      payload: { cortex: this.id },
      occurredAt: new Date().toISOString(),
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Subscribe to a class of events. Subscriptions are auto-cleaned on stop.
   */
  protected subscribe(prefix: string, handler: EventHandler): void {
    const unsub = this.bus.subscribe(prefix, handler);
    this.unsubs.push(unsub);
  }

  /**
   * Convenience wrapper around `bus.publish` that fills in `source`.
   */
  protected async emit(
    type: string,
    payload: Record<string, unknown> | object,
    severity: CognitiveEvent['severity'] = 'info',
    correlationId?: string
  ): Promise<void> {
    await this.bus.publish({
      id: `evt_${this.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      source: this.id,
      type,
      severity,
      payload,
      correlationId,
      occurredAt: new Date().toISOString(),
    });
  }

  protected abstract onStart(): Promise<void>;
  protected async onStop(): Promise<void> { /* default no-op */ }
}
