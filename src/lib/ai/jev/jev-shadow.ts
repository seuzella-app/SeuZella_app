// ============================================================================
// JEV — Runner SHADOW_ONLY (RUN22-A) — comparação local vs remoto, in-memory
// ============================================================================
// O runner é o coração do SHADOW_ONLY: valida (contrato), minimiza (firewall),
// decide com o baseline local SEMPRE e com o remoto QUANDO disponível, guarda
// a comparação num buffer limitado EM MEMÓRIA (nada de banco nesta onda — o
// decision ledger persistido é onda futura, conforme a diretiva).
// PII por construção: o buffer NUNCA guarda o payload nem o tenantId puro —
// guarda apenas o HASH do tenant (sha256 truncado).
// NÃO é um router paralelo: nada aqui alimenta fluxo real; nenhum chamador de
// produção é obrigado a usá-lo nesta onda.
// ============================================================================

import { createHash } from 'node:crypto';

import type { JevDecisionMode, JevDecisionResponse } from '../../../domain/decision/contracts/JevTypes';
import { validateJevRequest } from '../../../domain/decision/contracts/JevDecisionContract';
import { sanitizeJevPayload } from './jev-pii-firewall';
import { jevAvailable } from './jev-config';
import { JevLocalHeuristicAdapter } from '../../../domain/decision/adapters/JevLocalHeuristicAdapter';
import { JevTypesafeAdapter } from '../../../domain/decision/adapters/JevTypesafeAdapter';
import type { IJevDecisionPort } from '../../../domain/decision/ports/IJevDecisionPort';

export interface JevShadowEntry {
  ts: string;
  requestId: string;
  /** sha256(tenantId) truncado — o id puro NUNCA é guardado aqui. */
  tenantHash: string;
  mode: JevDecisionMode;
  local: JevDecisionResponse;
  remote: JevDecisionResponse | null;
  /** true se ambos produziram 'ok' com o MESMO label; null se remoto ausente. */
  agreement: boolean | null;
}

export interface JevShadowStats {
  total: number;
  okLocal: number;
  remoteOk: number;
  remoteUnavailable: number;
  rejected: number;
  agreements: number;
  /** agreements / amostras remotas — null enquanto não houver remoto. */
  agreementRate: number | null;
  byMode: Record<string, { n: number; agreements: number }>;
}

export function hashTenantId(tenantId: string): string {
  return createHash('sha256').update(tenantId, 'utf8').digest('hex').slice(0, 16);
}

export interface JevShadowRunnerOptions {
  /** null = usa o default da casa; instância = injeção p/ testes. */
  localPort?: IJevDecisionPort | null;
  /** undefined = default (adapter TypeSafe); null = SEM remoto (só local). */
  remotePort?: IJevDecisionPort | null;
  capacity?: number;
}

export class JevShadowRunner {
  private readonly localPort: IJevDecisionPort;
  private readonly remotePort: IJevDecisionPort | null;
  private readonly capacity: number;
  private readonly buffer: JevShadowEntry[] = [];

  constructor(opts?: JevShadowRunnerOptions) {
    // Adapters por injeção (stubs nos testes) ou defaults da casa.
    this.localPort = opts?.localPort ?? new JevLocalHeuristicAdapter();
    this.remotePort =
      opts?.remotePort === undefined ? new JevTypesafeAdapter() : opts.remotePort;
    this.capacity =
      typeof opts?.capacity === 'number' && opts.capacity > 0 ? Math.floor(opts.capacity) : 500;
  }

  /** Avalia um envelope bruto (validação + firewall inclusos). NUNCA lança:
   * entrada inválida vira entry com local 'rejected' e agreement null. */
  async evaluate(raw: unknown): Promise<JevShadowEntry> {
    const validation = validateJevRequest(raw);
    if (!validation.ok) {
      return {
        ts: new Date().toISOString(),
        requestId: 'unknown',
        tenantHash: 'invalid',
        mode: 'INTENT',
        local: {
          status: 'rejected',
          mode: 'INTENT',
          reason: validation.reason,
          shadowOnly: true,
          latencyMs: 0,
        },
        remote: null,
        agreement: null,
      };
    }
    const request = validation.request;
    const minimized = sanitizeJevPayload(request.mode, request.payload);
    const safeRequest = { ...request, payload: minimized };

    const local = await this.localPort.decide(safeRequest);

    let remote: JevDecisionResponse | null = null;
    if (this.remotePort !== null && jevAvailable()) {
      remote = await this.remotePort.decide(safeRequest);
    }

    const agreement =
      local.status === 'ok' && remote !== null && remote.status === 'ok'
        ? local.decision.label === remote.decision.label
        : null;

    const entry: JevShadowEntry = {
      ts: new Date().toISOString(),
      requestId: request.requestId,
      tenantHash: hashTenantId(request.tenantId),
      mode: request.mode,
      local,
      remote,
      agreement,
    };
    this.buffer.push(entry);
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
    return entry;
  }

  recent(n: number): JevShadowEntry[] {
    const count = Math.max(0, Math.min(n, this.buffer.length));
    return this.buffer.slice(this.buffer.length - count);
  }

  stats(): JevShadowStats {
    const byMode: Record<string, { n: number; agreements: number }> = {};
    let okLocal = 0;
    let remoteOk = 0;
    let remoteUnavailable = 0;
    let rejected = 0;
    let agreements = 0;
    let remoteSamples = 0;
    for (const entry of this.buffer) {
      const bucket = byMode[entry.mode] ?? { n: 0, agreements: 0 };
      bucket.n += 1;
      if (entry.local.status === 'ok') okLocal += 1;
      if (entry.local.status === 'rejected') rejected += 1;
      if (entry.remote !== null && entry.remote.status === 'ok') {
        remoteOk += 1;
        remoteSamples += 1;
        if (entry.agreement === true) {
          agreements += 1;
          bucket.agreements += 1;
        }
      } else if (entry.remote !== null) {
        remoteUnavailable += 1;
      }
      byMode[entry.mode] = bucket;
    }
    return {
      total: this.buffer.length,
      okLocal,
      remoteOk,
      remoteUnavailable,
      rejected,
      agreements,
      agreementRate: remoteSamples > 0 ? agreements / remoteSamples : null,
      byMode,
    };
  }

  get size(): number {
    return this.buffer.length;
  }
}

// Singleton do processo (buffer em memória; some no restart — por enquanto é
// só sombra). O ledger persistido virá em onda futura conforme a diretiva.
export const jevShadow = new JevShadowRunner();
