// ============================================================================
// ZCC — Zélla Central Control | Coordinator
// ----------------------------------------------------------------------------
// The ZCC is the Chief Architect. It does NOT make operational decisions —
// that is the job of the cortexes and the ZGS. The ZCC:
//
//   1. Boots and registers every cortex in the correct order.
//   2. Wires every cortex's event subscriptions on the ZCB.
//   3. Owns the Operating Mode (digital-twin vs production).
//   4. Mediates knowledge conflicts (e.g. two cortexes publish contradicting
//      conclusions — ZCC can retire the lower-confidence one).
//   5. Runs the permanent Simulation Lab on a schedule.
//   6. Emits the heartbeat that proves the cognitive stack is alive.
//
// The ZCC is intentionally thin. Power lives in the cortexes.
// ============================================================================

import type { CortexId, OperatingMode } from './types';
import { zcb, buildEvent } from './ZCB';
import { sharedMemory } from './SharedCognitiveMemory';

export interface ZCCConfig {
  operatingMode: OperatingMode;
  /** Heartbeat interval in ms. Default 60_000. */
  heartbeatMs?: number;
  /** Whether to auto-start the Simulation Lab on boot. Default false. */
  autoStartLab?: boolean;
}

type CortexRegistration = {
  id: CortexId;
  start: () => Promise<void>;
  stop?: () => Promise<void>;
};

export class ZellaCentralControl {
  private config: ZCCConfig = { operatingMode: 'digital-twin' };
  private registrations: CortexRegistration[] = [];
  private started = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private labRunner?: () => Promise<void>;

  configure(config: ZCCConfig): void {
    this.config = { ...this.config, ...config };
  }

  getOperatingMode(): OperatingMode {
    return this.config.operatingMode;
  }

  /**
   * Register a cortex for ordered startup.
   * Cortexes start in registration order; the ZCC is always first.
   */
  registerCortex(reg: CortexRegistration): void {
    if (this.registrations.some((r) => r.id === reg.id)) {
      throw new Error(`Cortex ${reg.id} is already registered`);
    }
    this.registrations.push(reg);
  }

  /**
   * Register the Simulation Lab runner. The ZCC will invoke it on boot
   * (if autoStartLab) and on a configurable schedule.
   */
  registerLabRunner(runner: () => Promise<void>): void {
    this.labRunner = runner;
  }

  /**
   * Boot the cognitive stack.
   *   1. Emit `zcc.booting`
   *   2. Start every registered cortex in order
   *   3. Emit `zcc.ready`
   *   4. Begin heartbeat
   *   5. Optionally start the Simulation Lab
   */
  async boot(): Promise<void> {
    if (this.started) return;

    await zcb.publish(
      buildEvent({
        source: 'zcc',
        type: 'zcc.booting',
        severity: 'info',
        payload: {
          operatingMode: this.config.operatingMode,
          cortexes: this.registrations.map((r) => r.id),
        },
      })
    );

    for (const reg of this.registrations) {
      try {
        await reg.start();
        await zcb.publish(
          buildEvent({
            source: 'zcc',
            type: 'cortex.started',
            severity: 'info',
            payload: { cortex: reg.id },
          })
        );
      } catch (err) {
        await zcb.publish(
          buildEvent({
            source: 'zcc',
            type: 'cortex.start.failed',
            severity: 'alert',
            payload: { cortex: reg.id, error: String(err) },
          })
        );
        throw err;
      }
    }

    this.started = true;
    this.startHeartbeat();

    await zcb.publish(
      buildEvent({
        source: 'zcc',
        type: 'zcc.ready',
        severity: 'info',
        payload: {
          cortexes: this.registrations.map((r) => r.id),
          memorySize: sharedMemory.size(),
          busSize: zcb.size(),
        },
      })
    );

    if (this.config.autoStartLab && this.labRunner) {
      // Fire and forget — the lab runs in the background.
      void this.labRunner();
    }
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    if (!this.started) return;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const reg of [...this.registrations].reverse()) {
      try {
        await reg.stop?.();
        await zcb.publish(
          buildEvent({
            source: 'zcc',
            type: 'cortex.stopped',
            severity: 'info',
            payload: { cortex: reg.id },
          })
        );
      } catch (err) {
        // Best-effort shutdown.
         
        console.error(`[ZCC] cortex ${reg.id} stop failed:`, err);
      }
    }
    this.started = false;
    await zcb.publish(
      buildEvent({
        source: 'zcc',
        type: 'zcc.shutdown',
        severity: 'info',
        payload: {},
      })
    );
  }

  /**
   * Resolve a knowledge conflict between two cortexes.
   * Strategy: keep the higher-confidence entry, retire the other with
   * `reason = 'conflict-resolved-by-zcc'`.
   */
  async resolveConflict(
    entryIdA: string,
    entryIdB: string,
    reason = 'conflict-resolved-by-zcc'
  ): Promise<void> {
    const a = sharedMemory.get(entryIdA);
    const b = sharedMemory.get(entryIdB);
    if (!a || !b) return;
    const loser = a.confidence >= b.confidence ? b : a;
    const winner = a.confidence >= b.confidence ? a : b;
    await sharedMemory.retire(loser.id, 'zcc', `${reason}; winner=${winner.id}`);
    await zcb.publish(
      buildEvent({
        source: 'zcc',
        type: 'zcc.conflict.resolved',
        severity: 'decision',
        payload: { winner: winner.id, loser: loser.id, reason },
      })
    );
  }

  /**
   * Trigger the Simulation Lab manually (e.g. via admin API).
   */
  async runLab(): Promise<void> {
    if (!this.labRunner) {
      throw new Error('No lab runner registered');
    }
    await this.labRunner();
  }

  /**
   * Snapshot of cognitive-stack health.
   */
  health() {
    return {
      started: this.started,
      operatingMode: this.config.operatingMode,
      cortexes: this.registrations.map((r) => r.id),
      memorySize: sharedMemory.size(),
      busSize: zcb.size(),
      heartbeatActive: !!this.heartbeatTimer,
    };
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatMs ?? 60_000;
    this.heartbeatTimer = setInterval(async () => {
      try {
        await zcb.publish(
          buildEvent({
            source: 'zcc',
            type: 'zcc.heartbeat',
            severity: 'info',
            payload: this.health(),
          })
        );
      } catch (err) {
         
        console.error('[ZCC] heartbeat failed:', err);
      }
    }, interval);
    // Don't keep the process alive just for the heartbeat.
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }
}

/**
 * The singleton ZCC coordinator.
 */
export const zcc = new ZellaCentralControl();
