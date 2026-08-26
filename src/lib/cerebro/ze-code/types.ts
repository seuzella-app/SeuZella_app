// ============================================================================
// ZÉLLA — ZéCode Types (DEV FULL STACK Interno — Inspirado no CodeRabbit)
// ============================================================================
// Ferramenta "DEV FULL STACK" interna do ZCC. Diferente do Cérebro Zélla
// (que é o "código vivo" — observabilidade runtime, anomalias, budget forecast),
// o ZéCode atua no CÓDIGO-FONTE em si:
//
//   - Revisar (estilo CodeRabbit): diff/file/directory/hotspot com comments
//   - Refatorar: propõe patches para erros recorrentes
//   - Identificar Gaps: testes faltando, tipos ausentes, error handling
//   - Identificar Gargalos: N+1 queries, sync blocking, missing indexes
//   - Sugerir Ajustes Finos: melhorias de pattern, naming, estrutura
//
// SEGURANÇA (locks):
//   1. Reuso do code-reader sandboxed (allowlist ext, skip dirs, anti-traversal)
//   2. Reuso do secret-redactor (redaction obrigatória antes de qualquer LLM)
//   3. Reuso do quality-gates (budget, rate limit, path allowlist, file size)
//   4. Nenhuma alteração é auto-aplicada — sempre exige Approve humano no ZCC
//   5. Modo mock por default (CEREBRO_LIVE_MODE=false) — não gasta tokens
//   6. Modo live exige GODMODE + budget + API key + rate limit
//   7. Toda ação é auditada via logSink + AlertBus
//
// PARALELO COM O CÉREBRO ZÉLLA:
//   - Cérebro Zélla = "código vivo" → anomalias runtime, spend, forecast
//   - ZéCode         = "DEV FULL STACK" → revisão e evolução do código-fonte
//   - Ambos usam o mesmo GLM 5.2 embarcado, mas com prompts e propósitos distintos
//   - Cérebro Zélla fica na aba `cerebro`; ZéCode fica na aba `ze-code`
// ============================================================================

import type { ReviewSeverity, CommentCategory } from '../code-reviewer/types';

// ── ZéCode View Modes (tabs dentro do painel) ──────────────────────────────

export type ZeCodeView = 'overview' | 'reviews' | 'refactors' | 'gaps' | 'bottlenecks';

export const ZE_CODE_VIEWS: { id: ZeCodeView; label: string; desc: string }[] = [
  { id: 'overview', label: 'Overview', desc: 'Visão geral + codebase domain + safety locks' },
  { id: 'reviews', label: 'Reviews', desc: 'Revisões estilo CodeRabbit (diff/file/dir/hotspot)' },
  { id: 'refactors', label: 'Refactors', desc: 'Sugestões de refatoração para erros recorrentes' },
  { id: 'gaps', label: 'Gaps', desc: 'Testes faltando, tipos ausentes, error handling' },
  { id: 'bottlenecks', label: 'Gargalos', desc: 'N+1 queries, sync blocking, missing indexes' },
];

// ── Codebase Domain (estado do conhecimento do ZéCode sobre o projeto) ───────

export interface CodebaseDomainStats {
  /** Total de arquivos de código indexados (allowlist) */
  totalCodeFiles: number;
  /** Total de chunks no DB do code-indexer */
  dbChunks: number;
  /** TF-IDF index stats */
  tfidf: {
    totalDocs: number;
    totalTerms: number;
    avgDocLength: number;
    isLoaded: boolean;
  };
  /** Distribuição por tipo de arquivo */
  byExtension: Array<{ ext: string; count: number; percentage: number }>;
  /** Top 5 diretórios por número de arquivos */
  topDirectories: Array<{ dir: string; files: number }>;
  /** Status do último escaneamento */
  lastScanAt: string | null;
  /** Mode (mock/live) */
  mode: 'mock' | 'live';
}

// ── Safety Locks (status das travas de segurança) ───────────────────────────

export interface SafetyLockStatus {
  /** Allowlist de extensões ativa */
  extensionAllowlist: string[];
  /** Diretórios bloqueados */
  blockedDirs: string[];
  /** Tamanho máximo por arquivo (KB) */
  maxFileSizeKb: number;
  /** Budget mensal (USD) */
  monthlyBudgetUsd: number;
  /** Spend atual no mês (USD) */
  monthSpendUsd: number;
  /** Spend restante (USD) */
  remainingBudgetUsd: number;
  /** % budget utilizado */
  budgetUsagePercent: number;
  /** Rate limit (reviews por hora) */
  rateLimitPerHour: number;
  /** Reviews executados na última hora */
  reviewsLastHour: number;
  /** Modo live habilitado? */
  liveModeEnabled: boolean;
  /** GODMODE requerido para auto-apply? */
  godmodeRequired: boolean;
  /** Auto-apply habilitado? (sempre false por segurança) */
  autoApplyEnabled: boolean;
}

// ── Gap Detection ───────────────────────────────────────────────────────────

export type GapType =
  | 'missing_test'
  | 'missing_type'
  | 'missing_error_handling'
  | 'missing_input_validation'
  | 'missing_auth_check'
  | 'missing_rate_limit'
  | 'missing_logger'
  | 'missing_doc';

export const GAP_TYPES: GapType[] = [
  'missing_test',
  'missing_type',
  'missing_error_handling',
  'missing_input_validation',
  'missing_auth_check',
  'missing_rate_limit',
  'missing_logger',
  'missing_doc',
];

export interface GapFinding {
  id: string;
  filePath: string;
  lineRange: string;
  gapType: GapType;
  severity: ReviewSeverity;
  title: string;
  description: string;
  /** Trecho de código atual (com secrets redacted) */
  currentCode: string | null;
  /** Sugestão de código para preencher o gap */
  suggestedCode: string | null;
  rationale: string;
  confidence: number; // 0..1
  /** Detecção por heurística (regex/AST) ou LLM */
  detectedBy: 'heuristic' | 'llm' | 'hybrid';
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

// ── Bottleneck Detection ────────────────────────────────────────────────────

export type BottleneckType =
  | 'n_plus_one_query'
  | 'sync_blocking_io'
  | 'missing_db_index'
  | 'large_payload'
  | 'memory_leak_risk'
  | 'unnecessary_re_render'
  | 'expensive_loop'
  | 'missing_pagination';

export const BOTTLENECK_TYPES: BottleneckType[] = [
  'n_plus_one_query',
  'sync_blocking_io',
  'missing_db_index',
  'large_payload',
  'memory_leak_risk',
  'unnecessary_re_render',
  'expensive_loop',
  'missing_pagination',
];

export interface BottleneckFinding {
  id: string;
  filePath: string;
  lineRange: string;
  bottleneckType: BottleneckType;
  severity: ReviewSeverity;
  title: string;
  description: string;
  /** Trecho problemático (com secrets redacted) */
  currentCode: string | null;
  /** Sugestão de otimização */
  suggestedCode: string | null;
  rationale: string;
  /** Impacto estimado (low/medium/high/critical) */
  estimatedImpact: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  detectedBy: 'heuristic' | 'llm' | 'hybrid';
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

// ── Unified Stats ──────────────────────────────────────────────────────────

export interface ZeCodeStats {
  mode: 'mock' | 'live';
  /** Codebase domain */
  domain: CodebaseDomainStats;
  /** Safety locks status */
  safety: SafetyLockStatus;
  /** Contagem por categoria */
  counts: {
    reviewsTotal: number;
    reviewsPending: number;
    refactorsTotal: number;
    refactorsPending: number;
    gapsTotal: number;
    gapsPending: number;
    bottlenecksTotal: number;
    bottlenecksPending: number;
    /** Total de sugestões aplicadas (todas as categorias) */
    appliedTotal: number;
  };
  /** Última atividade (ISO date ou null) */
  lastActivityAt: string | null;
}

// ── Evolve Code Request (comando master "evoluir o código") ──────────────────

export interface EvolveRequest {
  /** Escopo: 'hotspot' (top erros) | 'directory' (pasta específica) | 'full' (todas as categorias) */
  scope: 'hotspot' | 'directory' | 'full';
  /** Para scope='directory': path alvo (default: 'src/') */
  target?: string;
  /** Forçar modo live (requer GODMODE) */
  forceLive?: boolean;
  /** Quem disparou (ZCC admin email) */
  triggeredBy?: string;
  /** Limite de arquivos (default 10) */
  maxFiles?: number;
}

export interface EvolveResult {
  /** ID do job assíncrono */
  jobId: string;
  /** Status final (síncrono para mock, pode ser async para live) */
  status: 'completed' | 'running' | 'failed';
  /** Mode (mock/live) */
  mode: 'mock' | 'live';
  /** Reviews geradas */
  reviewsCreated: number;
  /** Refactors propostos */
  refactorsCreated: number;
  /** Gaps identificados */
  gapsCreated: number;
  /** Bottlenecks identificados */
  bottlenecksCreated: number;
  /** Custo USD (0 em mock) */
  costUsd: number;
  /** Duração em ms */
  durationMs: number;
  /** Walkthrough summary */
  summary: string;
  /** Erros (se houve falhas parciais) */
  warnings: string[];
}

// ── Apply Suggestion (com safety locks) ──────────────────────────────────────

export type SuggestionCategory = 'review' | 'refactor' | 'gap' | 'bottleneck';

export interface ApplySuggestionRequest {
  category: SuggestionCategory;
  suggestionId: string;
  /** Quem aplicou (ZCC admin email) — obrigatório */
  appliedBy: string;
  /** Notas opcionais */
  notes?: string;
}

export interface ApplySuggestionResult {
  ok: boolean;
  /** Status final da sugestão */
  status: 'applied' | 'rejected' | 'failed';
  /** Detalhes da aplicação (path, lines, mode) */
  details: string;
  /** Em modo mock, NENHUMA escrita real é feita — apenas marcamos como applied no DB */
  mode: 'mock' | 'live';
  /** Safety locks acionados durante apply */
  safetyLocksTriggered: string[];
}

// ── Re-export de tipos reusados ─────────────────────────────────────────────

export type { ReviewSeverity, CommentCategory };
