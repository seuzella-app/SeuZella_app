// ============================================================================
// JEV — Porta de decisão (hexagonal, RUN22-A — SHADOW_ONLY)
// ============================================================================
// Mesma convenção da casa do domínio decision (IRouterStatePort): portas no
// domínio, adapters do lado de fora. Qualquer implementação (heurística local,
// TypeSafe remoto) deve satisfazer esta porta — e TODA resposta é um resultado
// tipado fail-closed (nunca lança).
// ============================================================================

import type { JevDecisionRequest, JevDecisionResponse, JevDecisionSource } from '../contracts/JevTypes';

export interface IJevDecisionPort {
  /** Identificador estável da fonte de decisão (JEV_DECISION_SOURCES). */
  readonly source: JevDecisionSource;
  /** Produz UMA decisão tipada. Nunca lança; nunca afeta fluxo real (shadow). */
  decide(request: JevDecisionRequest): Promise<JevDecisionResponse>;
}
