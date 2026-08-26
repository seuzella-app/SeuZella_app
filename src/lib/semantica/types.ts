/**
 * ZÉLLA — Semantica Types (espelho da API Python do Semantica)
 *
 * Tipos compartilhados entre:
 *   - src/lib/semantica/client.ts (cliente HTTP)
 *   - src/lib/ml/graph-rag.ts (thin wrapper)
 *   - src/lib/ai/cognitive-router.ts (consumidor)
 *   - src/lib/cerebro/knowledge-distiller.ts (consumidor)
 *   - src/lib/brain/conversation-learner.ts (consumidor)
 *   - src/components/zcc/panels/semantica-panel.tsx (UI)
 *
 * Alinhado com a API do Semantica (semantica-agi/semantica):
 *   - semantica.context.ContextGraph
 *   - semantica.kg.GraphBuilder
 *   - semantica.conflicts.ConflictDetector
 *   - semantica.provenance.ProvenanceManager
 *   - semantica.ontology.OntologyValidator
 *   - semantica.reasoning.ReteEngine
 *
 * Storage: Apache AGE (graph) + PgVector (vectors) em PostgreSQL 16.
 */

// ============================================================================
// ENTITY TYPES — espelham ontologia Seu Zélla
// ============================================================================

/** Tipos de nó do grafo (alinhado com Prisma GraphNode.entityType) */
export type EntityType =
  | 'RULE' // regra rígida ("Check-in às 14h")
  | 'POLICY' // política negociável ("Pets permitidos com taxa")
  | 'AMENITY' // comodidade ("Piscina aquecida")
  | 'CHECKIN' // procedimento de check-in
  | 'CHECKOUT' // procedimento de check-out
  | 'PAYMENT' // regra de pagamento ("PIX com 5% desconto")
  | 'CANCEL' // política de cancelamento
  | 'SERVICE' // serviço adicional ("Café da manhã")
  | 'GUEST' // hóspede (anonimizado p/ LGPD)
  | 'RESERVATION' // reserva específica
  | 'ROOM' // quarto/acomodação
  | 'FAQ' // pergunta frequente
  | 'CUSTOM'; // entidade customizada pelo tenant

/** Tipos de relação (aresta) — alinhado com Prisma GraphEdge.relationType */
export type RelationType =
  | 'SUPERSEDES' // A sobrepõe B (A é mais recente/específica)
  | 'FORBIDS' // A proíbe B
  | 'REQUIRES' // A requer B (pré-requisito)
  | 'OVERLAPS' // A e B se sobrepõem (parcialmente equivalentes)
  | 'ENABLES' // A habilita B
  | 'CAUSED' // A causou B (cadeia causal de decisões)
  | 'INFLUENCED' // A influenciou B
  | 'PRECEDENT_FOR'; // A é precedente para B

/** Severidade de conflito */
export type ConflictSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Status de resolução de conflito */
export type ConflictStatus = 'detected' | 'acknowledged' | 'resolved' | 'ignored';

// ============================================================================
// GRAPH NODES & EDGES
// ============================================================================

export interface ContextNode {
  id: string;
  tenantId: string;
  type: EntityType;
  name: string;
  content: string;
  /** Embedding vetorial 768-dim (Gemini) ou TF-IDF, serializado como JSON */
  embedding?: number[];
  /** Proveniência: de onde veio este nó */
  provenance?: ProvenanceInfo;
  /** Confiança 0-1 (padrão Learning Engine) */
  confidence?: number;
  /** Marcado como esquecido (LGPD) — não deletado, mas anonimizado */
  forgotten?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface GraphEdge {
  id: string;
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType;
  /** Peso 1-10 (maior = mais prioridade no desempate hierárquico) */
  priorityWeight: number;
  /** Conteúdo da regra (ex: "mediante disponibilidade") */
  condition?: string;
  createdAt: string;
}

export interface ProvenanceInfo {
  /** Fonte: 'regulamento', 'faq', 'ddc_edit', 'dpo_pair', 'auto_learned' */
  source: string;
  /** Referência: arquivo, URL, ou ID do DpoPreferencePair */
  sourceRef?: string;
  /** Quem extraiu: 'semantica_ner', 'semantica_relation_extractor', 'manual' */
  extractedBy?: string;
  /** ID do hóspede se aplicável (anonimizado p/ LGPD) */
  guestId?: string;
  /** Timestamp de extração */
  extractedAt: string;
}

// ============================================================================
// CONFLICTS
// ============================================================================

export interface GraphConflict {
  id: string;
  tenantId: string;
  /** Nós em conflito (2 ou mais) */
  nodeIds: string[];
  /** Descrição do conflito detectado */
  description: string;
  /** Severidade calculada */
  severity: ConflictSeverity;
  /** Status atual */
  status: ConflictStatus;
  /** Resolução sugerida pelo Semantica (SUPERSEDES, FORBIDS, MERGE) */
  suggestedResolution?: {
    type: RelationType;
    winnerNodeId: string;
    loserNodeId: string;
    reasoning: string;
  };
  /** Quem resolveu (se resolvido) */
  resolvedBy?: string;
  resolvedAt?: string;
  detectedAt: string;
}

// ============================================================================
// DECISIONS (Audit Intelligence)
// ============================================================================

export type DecisionCategory =
  | 'guest_response' // resposta ao hóspede
  | 'intent_classification' // classificação de intenção
  | 'tool_calling' // execução de ferramenta (reserva, cotação)
  | 'human_handover' // escalação para humano
  | 'message_blocked' // mensagem bloqueada por guardrails
  | 'graph_query' // consulta ao grafo
  | 'refactor_suggestion' // sugestão de refatoração
  | 'budget_alert' // alerta de budget
  | 'anomaly_detected'; // anomalia detectada

export type DecisionOutcome =
  | 'success' // sucesso total
  | 'partial_success' // parcialmente correto
  | 'failure' // falhou
  | 'escalated' // escalado para humano
  | 'blocked' // bloqueado por policy
  | 'pending'; // aguardando outcome

export interface DecisionRecord {
  id: string;
  tenantId: string;
  category: DecisionCategory;
  /** Cenário: o que aconteceu (mensagem do hóspede, contexto) */
  scenario: string;
  /** Raciocínio: por que essa decisão (regra usada, proveniência) */
  reasoning: string;
  /** Outcome: o que foi decidido */
  outcome: DecisionOutcome;
  /** Resposta dada (se aplicável) */
  response?: string;
  /** Confiança 0-1 */
  confidence: number;
  /** Metadados: provider usado, latência, etc. */
  metadata: DecisionMetadata;
  /** IDs de nós do grafo que justificaram a decisão */
  graphNodeIds?: string[];
  /** ID da decisão pai (cadeia causal) */
  parentDecisionId?: string;
  createdAt: string;
}

export interface DecisionMetadata {
  providerId?: string;
  tier?: number;
  latencyMs?: number;
  sessionId?: string;
  guestId?: string;
  intent?: string;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  [key: string]: unknown;
}

export interface CausalChain {
  decisionId: string;
  decision: DecisionRecord;
  parents: CausalChain[];
  children: CausalChain[];
  depth: number;
}

// ============================================================================
// SEARCH (hybrid graph + vector)
// ============================================================================

export interface HybridSearchRequest {
  tenantId: string;
  query: string;
  /** Profundidade BFS no grafo (default 2) */
  hops?: number;
  /** Máximo de nós a retornar (default 5) */
  maxNodes?: number;
  /** Incluir conflitos detectados no resultado */
  includeConflicts?: boolean;
  /** Pular cache (force fresh) */
  noCache?: boolean;
}

export interface HybridSearchResult {
  /** Nós relevantes encontrados */
  nodes: ContextNode[];
  /** Arestas relevantes (incluindo SUPERSEDES aplicado) */
  edges: GraphEdge[];
  /** Contexto resolvido formatado para injetar no prompt do LLM */
  resolvedContext: string;
  /** Conflitos detectados durante a busca (se includeConflicts=true) */
  conflicts?: GraphConflict[];
  /** Metadados da busca */
  searchMeta: {
    totalNodesScanned: number;
    totalEdgesTraversed: number;
    cacheHit: boolean;
    latencyMs: number;
    source: 'semantica' | 'fallback';
  };
}

// ============================================================================
// INGESTION (regulamento → grafo)
// ============================================================================

export interface IngestRequest {
  tenantId: string;
  /** Texto bruto ou URL */
  text?: string;
  url?: string;
  /** Tipo de fonte */
  sourceType: 'regulamento' | 'faq' | 'politics' | 'manual' | 'ddc_edit';
  /** Forçar re-ingestão (ignorar cache) */
  force?: boolean;
}

export interface IngestResult {
  tenantId: string;
  nodesCreated: number;
  edgesCreated: number;
  conflictsDetected: number;
  durationMs: number;
  /** IDs dos nós criados */
  nodeIds: string[];
  /** IDs das arestas criadas */
  edgeIds: string[];
  /** IDs dos conflitos detectados */
  conflictIds: string[];
}

// ============================================================================
// ONTOLOGY & REASONING
// ============================================================================

export interface OntologyValidationResult {
  valid: boolean;
  violations: Array<{
    nodeId: string;
    rule: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

export interface ReasoningResult {
  /** Inferências feitas pelo motor (forward chaining) */
  inferences: Array<{
    subject: string;
    predicate: RelationType;
    object: string;
    confidence: number;
    explanation: string;
  }>;
  /** Query executada (Datalog/SPARQL) */
  query: string;
  durationMs: number;
}

// ============================================================================
// LGPD (esquecimento)
// ============================================================================

export interface ForgetGuestRequest {
  guestId: string;
  tenantId: string;
  /** Motivo do esquecimento (LGPD art. 18) */
  reason: 'user_request' | 'gdpr_right_to_erasure' | 'data_retention_expiry' | 'manual';
  /** Quem autorizou */
  authorizedBy: string;
}

export interface ForgetGuestResult {
  guestId: string;
  tenantId: string;
  nodesMarkedForgotten: number;
  decisionsAnonymized: number;
  edgesRemoved: number;
  consentLogId: string;
  completedAt: string;
}

// ============================================================================
// HEALTH & STATS
// ============================================================================

export interface SemanticaHealth {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime: string;
  postgres: 'connected' | 'disconnected';
  age: 'connected' | 'disconnected';
  pgvector: 'connected' | 'disconnected';
  totalTenants: number;
  totalNodes: number;
  totalEdges: number;
  totalDecisions: number;
  totalConflicts: number;
  cacheHitRate: number;
}

export interface GraphStats {
  tenantId: string;
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<EntityType, number>;
  edgesByRelation: Record<RelationType, number>;
  conflicts: {
    detected: number;
    resolved: number;
    pending: number;
  };
  decisions: {
    total: number;
    last24h: number;
  };
  brainAge: number; // dias desde primeira ingest
}

// ============================================================================
// ERRORS
// ============================================================================

export type SemanticaErrorCode =
  | 'UNAUTHORIZED' // 401 — API key inválida
  | 'FORBIDDEN' // 403 — tenant não tem acesso
  | 'NOT_FOUND' // 404 — nó/aresta/decisão não existe
  | 'VALIDATION_ERROR' // 400 — payload inválido
  | 'CONFLICT' // 409 — conflito de versão
  | 'RATE_LIMITED' // 429 — excedeu limite
  | 'TIMEOUT' // 408 — excedeu timeout
  | 'INTERNAL_ERROR' // 500 — erro interno
  | 'SERVICE_UNAVAILABLE' // 503 — sidecar down
  | 'BAD_GATEWAY' // 502 — erro de upstream
  | 'GRAPH_INVALID' // grafo do tenant corrompido
  | 'ONTLOGY_VIOLATION'; // quebrou restrição SHACL

export class SemanticaError extends Error {
  constructor(
    public code: SemanticaErrorCode,
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SemanticaError';
  }

  /** Retorna true se o erro é recuperável com fallback */
  isRecoverable(): boolean {
    return (
      this.code === 'TIMEOUT' ||
      this.code === 'SERVICE_UNAVAILABLE' ||
      this.code === 'BAD_GATEWAY' ||
      this.code === 'INTERNAL_ERROR'
    );
  }

  /** Retorna true se o erro deve disparar alerta Sentry */
  shouldAlert(): boolean {
    return (
      this.code === 'INTERNAL_ERROR' ||
      this.code === 'BAD_GATEWAY' ||
      this.code === 'GRAPH_INVALID' ||
      this.code === 'ONTLOGY_VIOLATION'
    );
  }
}
