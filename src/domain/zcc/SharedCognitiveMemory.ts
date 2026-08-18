// ============================================================================
// Shared Cognitive Memory
// ----------------------------------------------------------------------------
// The single source of truth for validated knowledge in the entire system.
//
// INVARIANTS:
//  1. No cortex maintains isolated knowledge. Every validated conclusion
//     lives here, versioned, attributed, and queryable by every cortex.
//  2. Knowledge is append-only at the version level. Replacing a conclusion
//     means publishing a new version and marking the old one `superseded`.
//  3. `confidence` is mandatory and must be backed by `evidence` (event ids).
//  4. Knowledge entries are immutable once `validated`. To correct, supersede.
//
// Cortexes read from memory synchronously via `query()`. Writes go through
// `publish()`, which emits a `knowledge.published` event on the ZCB so other
// cortexes can refresh their working state.
// ============================================================================

import type { KnowledgeEntry, CortexId } from './types';
import { zcb, buildEvent } from './ZCB';

class SharedCognitiveMemory {
  private entries = new Map<string, KnowledgeEntry>();
  private byType = new Map<string, Set<string>>();

  /**
   * Publish a new piece of knowledge, or a new version of an existing one.
   *
   * If `id` already exists, the previous version is marked `superseded`
   * with `supersededBy` pointing to the new version, and the new entry
   * gets `version = oldVersion + 1`.
   */
  async publish(entry: Omit<KnowledgeEntry, 'version' | 'status' | 'publishedAt'> & {
    status?: KnowledgeEntry['status'];
  }): Promise<KnowledgeEntry> {
    const existing = this.entries.get(entry.id);
    const version = existing ? existing.version + 1 : 1;
    const status = entry.status ?? 'validated';
    const publishedAt = new Date().toISOString();

    const finalized: KnowledgeEntry = {
      ...(entry as Omit<KnowledgeEntry, 'version' | 'status' | 'publishedAt'>),
      version,
      status,
      publishedAt,
      supersededBy: undefined,
    };

    // Supersede the previous version.
    if (existing && existing.status === 'validated') {
      this.entries.set(existing.id, {
        ...existing,
        status: 'superseded',
        supersededBy: finalized.id,
      });
    }

    this.entries.set(finalized.id, finalized);

    // Index by type for fast querying.
    if (!this.byType.has(finalized.type)) {
      this.byType.set(finalized.type, new Set());
    }
    this.byType.get(finalized.type)!.add(finalized.id);

    // Notify the rest of the system.
    await zcb.publish(
      buildEvent({
        source: finalized.publisher,
        type: 'knowledge.published',
        severity: 'signal',
        payload: {
          knowledgeId: finalized.id,
          version: finalized.version,
          type: finalized.type,
          title: finalized.title,
          confidence: finalized.confidence,
        },
      })
    );

    return finalized;
  }

  /**
   * Retrieve a specific knowledge entry by id (returns the latest version).
   */
  get(id: string): KnowledgeEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Query the memory by type, optionally filtering by publisher or status.
   * Returns only the latest version of each entry by default.
   */
  query(opts?: {
    type?: string;
    publisher?: CortexId;
    status?: KnowledgeEntry['status'];
    minConfidence?: number;
    validAt?: string;
    limit?: number;
  }): KnowledgeEntry[] {
    let ids: Set<string> | undefined;
    if (opts?.type) {
      ids = this.byType.get(opts.type);
      if (!ids || ids.size === 0) return [];
    }

    let results: KnowledgeEntry[] = [];
    const idSet = ids ?? new Set(this.entries.keys());
    for (const id of idSet) {
      const entry = this.entries.get(id);
      if (!entry) continue;
      if (opts?.publisher && entry.publisher !== opts.publisher) continue;
      if (opts?.status && entry.status !== opts.status) continue;
      if (opts?.minConfidence !== undefined && entry.confidence < opts.minConfidence) continue;
      if (opts?.validAt) {
        if (entry.validFrom > opts.validAt) continue;
        if (entry.validUntil && entry.validUntil < opts.validAt) continue;
      }
      results.push(entry);
    }

    // When no explicit status filter, return only the "live" versions
    // (validated or draft), not superseded/retired history.
    if (!opts?.status) {
      results = results.filter((r) => r.status === 'validated' || r.status === 'draft');
    }

    if (opts?.limit) {
      results = results.slice(0, opts.limit);
    }
    return results;
  }

  /**
   * Retire a piece of knowledge (e.g. it was found to be wrong).
   * Emits `knowledge.retired` on the ZCB.
   */
  async retire(id: string, by: CortexId, reason: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.set(id, { ...entry, status: 'retired' });
    await zcb.publish(
      buildEvent({
        source: by,
        type: 'knowledge.retired',
        severity: 'alert',
        payload: { knowledgeId: id, reason },
      })
    );
  }

  /**
   * Full snapshot — used by the Simulation Lab to compare before/after.
   */
  snapshot(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Total count — used by health checks.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Reset memory. ONLY the Simulation Lab calls this between experiments.
   */
  clearForExperiment(): void {
    this.entries.clear();
    this.byType.clear();
  }
}

/**
 * The singleton Shared Cognitive Memory for the entire process.
 */
export const sharedMemory = new SharedCognitiveMemory();
