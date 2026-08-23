// ============================================================================
// ZÉLLA — Code Reviewer Types
// ============================================================================
// Tipos compartilhados do Code Reviewer (ferramenta inspirada nas
// funcionalidades PÚBLICAS do CodeRabbit — 100% original, sem scraping).
//
// Ferramenta: revisão de código automatizada usando GLM 5.2 embarcado.
// Funcionalidades espelhadas das públicas do CodeRabbit:
//  - Walkthrough summary (high-level summary)
//  - Line-by-line comments
//  - Path-specific instructions (loaded from .coderabbit.yaml mirror)
//  - Severity classification (info/warning/critical/emergency)
//  - Code suggestions with rationale
// ============================================================================

// ── Review Modes ────────────────────────────────────────────────────────────

export type ReviewMode = 'diff' | 'file' | 'directory' | 'hotspot';

export const REVIEW_MODES: ReviewMode[] = ['diff', 'file', 'directory', 'hotspot'];

// ── Severity (reuses Cérebro's) ──────────────────────────────────────────────

export type ReviewSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export const SEVERITY_RANK: Record<ReviewSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
};

// ── Categories ──────────────────────────────────────────────────────────────

export type CommentCategory =
  | 'security'
  | 'performance'
  | 'bug'
  | 'maintainability'
  | 'style'
  | 'best_practice'
  | 'info';

export const COMMENT_CATEGORIES: CommentCategory[] = [
  'security',
  'performance',
  'bug',
  'maintainability',
  'style',
  'best_practice',
  'info',
];

// ── Comment ─────────────────────────────────────────────────────────────────

export interface CodeReviewComment {
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  category: CommentCategory;
  severity: ReviewSeverity;
  title: string;
  description: string;
  suggestedCode: string | null;
  currentCode: string | null;
  rationale: string | null;
  confidence: number; // 0..1
}

// ── Review Result ──────────────────────────────────────────────────────────

export interface CodeReviewResult {
  highLevelSummary: string;
  severity: ReviewSeverity;
  comments: CodeReviewComment[];
  stats: {
    filesReviewed: number;
    totalComments: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    emergencyCount: number;
    filesSkipped: number;
    bytesAnalyzed: number;
    tokensUsed: number;
    costUsd: number;
  };
  mode: 'mock' | 'live';
}

// ── Review Request ──────────────────────────────────────────────────────────

export interface ReviewRequest {
  mode: ReviewMode;
  /** Para "diff": base ref (default "main"). Para "file": path. Para "directory": path. Para "hotspot": windowHours (default 24). */
  target: string;
  /** Filtros de caminho (glob patterns) — apenas arquivos que casam são revisados */
  includePatterns?: string[];
  /** Padrões a excluir (default vêm do .coderabbit.yaml) */
  excludePatterns?: string[];
  /** Limite de arquivos a revisar (default 10) */
  maxFiles?: number;
  /** Severidade mínima para reportar (default "info") */
  minSeverity?: ReviewSeverity;
  /** Profile: "assertive" | "gentle" (default do .coderabbit.yaml = "assertive") */
  profile?: 'assertive' | 'gentle';
  /** Forçar modo live mesmo com CEREBRO_LIVE_MODE=false (requer GODMODE) */
  forceLive?: boolean;
  /** Quem disparou (ZCC admin email) */
  triggeredBy?: string;
}

// ── Quality Gate Failures ──────────────────────────────────────────────────

export type QualityGateFailure =
  | 'path_not_allowed'        // caminho fora da allowlist
  | 'file_too_large'          // arquivo excede MAX_FILE_SIZE_KB
  | 'max_files_exceeded'      // lotes excedem maxFiles
  | 'budget_exhausted'        // budget mensal do Cérebro estourou
  | 'rate_limited'             // too many reviews em janela curta
  | 'diff_empty'               // diff vazio
  | 'invalid_request'          // request malformado
  | 'secret_detected_in_path'; // caminho parece conter secret

export interface QualityGateResult {
  allowed: boolean;
  failure?: QualityGateFailure;
  reason?: string;
  /** Métricas capturadas mesmo se allowed=false */
  filesConsidered: number;
  filesAllowed: number;
}

// ── LLM JSON Output Schema ──────────────────────────────────────────────────
// GLM retorna JSON com esta estrutura (JSON mode via callOpenAICompatible)
export interface ReviewerLLMOutput {
  highLevelSummary: string;
  severity: ReviewSeverity;
  comments: Array<{
    filePath: string;
    startLine: number | null;
    endLine: number | null;
    category: CommentCategory;
    severity: ReviewSeverity;
    title: string;
    description: string;
    suggestedCode: string | null;
    rationale: string | null;
    confidence: number;
  }>;
}

// ── Path Instructions (mirror of .coderabbit.yaml) ──────────────────────────

export interface PathInstruction {
  /** Glob pattern: "src/app/api/**" | "src/middleware.ts" | "prisma/**" etc. */
  path: string;
  /** Instruções específicas para este path */
  instructions: string;
}

// ── Default Review Profile ──────────────────────────────────────────────────

export const DEFAULT_REVIEW_PROFILE: string = `Você é um auditor sênior de segurança da informação (AppSec), performance e qualidade de código para o projeto SmartHotel Zehla.
Atue de forma rigorosa focando em:
1. OWASP Top 10: Prevenção contra SQL Injection (Prisma raw queries), XSS (React/Next.js dangerous HTML/inputs), CSRF, IDOR (Insecure Direct Object References) em APIs.
2. Gestão de Segredos & Credenciais: Identificação de chaves de API, senhas, tokens JWT ou variáveis de ambiente sensíveis expostas em código.
3. Autenticação e Autorização: Validação estrita de tokens JWT e permissões em middleware.ts, rotas de API em src/app/api e serviços em mini-services.
4. Performance e Vazamentos: Prevenção de vazamentos de memória (event listeners não removidos, sockets abertos), queries ineficientes (N+1 no Prisma) e falta de índices.
5. Robustez e Tratamento de Erros: Garantir blocos try/catch apropriados, logs estruturados sem vazar dados sensíveis (PII/senhas) e fallback adequado em serviços críticos.`;

export const DEFAULT_PATH_INSTRUCTIONS: PathInstruction[] = [
  {
    path: 'src/app/api/**',
    instructions:
      'Exija validação de entrada (ex: Zod), autenticação de sessão/JWT em todas as rotas de API e garanta que dados sensíveis de hóspedes/usuários não sejam expostos sem autorização.',
  },
  {
    path: 'src/middleware.ts',
    instructions:
      'Revise com atenção máxima a lógica de proteção de rotas, renovação/validação de tokens e redirecionamentos para evitar bypass de segurança.',
  },
  {
    path: 'prisma/**',
    instructions:
      'Verifique consultas ineficientes, migrações destrutivas sem rollback seguro e ausência de índices em campos frequentemente filtrados.',
  },
  {
    path: 'mini-services/**',
    instructions:
      'Verifique tratamento de exceções não capturadas, gerenciamento de conexões de banco/socket e resiliência a falhas de rede.',
  },
  {
    path: 'src/components/**',
    instructions:
      'Valide acessibilidade (a11y), prevenção de XSS ao renderizar HTML dinâmico e boas práticas de renderização Next.js/React.',
  },
];

export const DEFAULT_PATH_FILTERS_EXCLUDE: string[] = [
  '!**/.agents/**',
  '!**/.antigravity/**',
  '!**/.next/**',
  '!**/.docs/**',
  '!**/node_modules/**',
  '!**/bun.lock',
  '!**/package-lock.json',
  '!**/tsconfig.tsbuildinfo',
  '!**/test-screenshots/**',
  '!**/dev.log',
  '!**/.env*',
  '!**/*.secret',
  '!**/.git/**',
];
