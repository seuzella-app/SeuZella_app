/**
 * ZCC — Zélla Central Control
 * Tipos alinhados EXATAMENTE com prisma/schema.prisma do projeto real.
 */

// ===== ENUMS DO PRISMA =====

/** Enum Plan do Prisma — 4 planos pagos + Link-in-Bio, SEM trial gratuito */
export type Plan = "LITE" | "PRO" | "MAX" | "PARCEIRO" | "LINK_IN_BIO";

/** Enum LeadStatus do Prisma */
export type LeadStatusPrisma =
  | "PROSPECT"
  | "QUALIFIED"
  | "TRIAL_STARTED"
  | "CONVERTED"
  | "BLACKLISTED";

// ===== MODELOS DO PRISMA (espelhados) =====

/** Model Lead do Prisma — campos completos */
export interface Lead {
  id: string;
  tenantId: string;
  empresa: string;
  decisor: string;
  cargo: string;
  email: string;
  whatsapp: string | null;
  setor: string;
  porte: string; // pequeno | medio | grande
  status: string; // pending | verified | contacted | converted | lost
  hook: string;
  socialFootprint: string;
  targetId: string | null;

  // Legacy fields
  name: string;
  phone: string | null;
  property: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  region: string | null;
  googleRating: number | null;
  score: number | null;
  painPoints: string | null;
  source: string;
  latitude: number | null;
  longitude: number | null;
  scoreValid: number;
  localPraia: string | null;
  observacoes: string | null;

  // LIS / ZEHLA FISH extensions
  isCanary: boolean;
  estimatedValues: string | null;
  intentSignals: string | null;
  location: string | null;
  phoneSecondary: string | null;
  qualification: string | null;
  socialMedia: string;
  site: string | null;
  validationScore: number;
  validationStatus: string; // pendente | validado
  conversionScore: number;
  funnelStage: string;
  lastInteractionAt: string | null;
  behavioralProfile: string | null;
  cluster: string; // HOT | WARM | COLD
  previousCluster: string | null;
  lastSwipeAction: string | null;
  lastSwipeUsedId: string | null;
  tierConfidence: number | null;
  tierSugerido: string | null;
  tierSugeridoEm: string | null;
  roomsCount: number;
  instagramFollowers: number;
  googleReviewsCount: number;
  otaCommissionLost: number;
  hasWebsite: boolean;
  otaDependenceLevel: string;
  buyingBehavior: string | null;
  conversionProbability: number;
  objectKeywords: string | null;
  recommendedPitch: string | null;
  leadTier: string;
  metadata: string;

  createdAt: string;
  updatedAt: string;
  converted?: boolean;
  hot?: boolean;
  uf?: string;
  avgScore?: number;
}

/** Model Tenant do Prisma */
export interface Tenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneAlt: string | null;
  whatsappPhoneNumber: string | null;
  whatsappBusinessId: string | null;
  role: string; // owner | admin | staff
  plan: string; // lite | pro | max | parceiro
  status: string; // active | suspended | churned
  subscriptionAt: string | null;
  domain: string | null;
  niche: string; // pousada | airbnb
  isTestTenant: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Model Subscription do Prisma */
export interface Subscription {
  id: string;
  tenantId: string;
  planType: string; // lite | pro | max | parceiro
  status: string; // pending | active | canceled | expired
  paymentMethod: string; // pix | cartao
  amount: number;
  paymentId: string | null;
  paymentStatus: string | null;
  checkoutUrl: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastProrateAmount: number | null;
  lastProrateDate: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

/** Model RouterProvider do Prisma — Thompson Sampling */
export interface RouterProvider {
  id: string;
  provider: string; // openrouter | anthropic | ollama | groq | gemini
  modelName: string;
  tier: string; // 1=budget, 2=mid, 3=premium
  alpha: number; // Thompson Sampling Beta posterior
  beta: number;
  circuitStatus: string; // closed | half_open | open
  lastFailureAt: string | null;
  failureCount: number;
  successCount: number;
  avgLatencyMs: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  isActive: boolean;
  supportsJson: boolean;
  supportsTools: boolean;
  maxContextTokens: number;
  createdAt: string;
  updatedAt: string;
}

/** Model BudgetGuardState do Prisma */
export interface BudgetGuardState {
  id: string;
  date: string; // YYYY-MM-DD
  dailySpendUsd: number;
  dailyBudgetUsd: number;
  monthlySpendUsd: number;
  monthlyBudgetUsd: number;
  criticalLevel: string; // nominal | warning | critical
  createdAt: string;
  updatedAt: string;
}

/** Model CostLog do Prisma */
export interface CostLog {
  id: string;
  tenantId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  tier: number;
  bucket: string;
  cacheHit: boolean;
  latencyMs: number;
  circuitState: string | null;
  budgetLevel: string | null;
  createdAt: string;
}

/** Model CerebroAnalysis do Prisma */
export interface CerebroAnalysis {
  id: string;
  analysisType: string; // anomaly_scan | budget_forecast | security_audit | refactor_suggestion | inadimplencia_check
  scope: string; // global | tenant:<id> | module:<name> | route:<path>
  summary: string;
  details: string;
  severity: string; // info | warning | critical | emergency
  actionTaken: string | null; // alert_sent | tenant_suspended | none
  costUsd: number;
  mode: string; // mock | live
  createdAt: string;
}

/** Model AnomalyEvent do Prisma */
export interface AnomalyEvent {
  id: string;
  anomalyType: string; // error_spike | latency_degradation | cost_anomaly | auth_failure_pattern | tenant_under_attack | webhook_throughput_burst
  scope: string;
  metric: string;
  observed: number;
  baseline: number;
  deviation: number;
  detectionMethod: string; // statistical | threshold
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  acknowledgeNotes: string | null;
}

/** Model RefactorSuggestion do Prisma */
export interface RefactorSuggestion {
  id: string;
  sourceErrorHash: string;
  filePath: string;
  lineRange: string;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  status: string; // pending_review | approved | rejected | applied
  confidence: number;
  reviewNotes: string | null;
  mode: string; // mock | live
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

// ===== AGENTES — 12 agentes do ZCC =====

export type AgentId =
  | "conductor" | "concierge" | "cfo" | "guardian"
  | "sales" | "marketing" | "dspy" | "graphrag"
  | "selfdefense" | "meta-cloud" | "pousadabrain" | "partnerhunter";

export type AgentStatus = "idle" | "active" | "thinking" | "error" | "offline";
export type AgentDepartment = "command" | "comms" | "finance" | "operations" | "sales" | "tech" | "marketing";
export type AgentTier = "lead" | "specialist" | "worker";
export type LlmModel = "glm-4.7-flash" | "glm-4.7" | "glm-5.2";

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  department: AgentDepartment;
  tier: AgentTier;
  defaultModel: LlmModel;
  emoji: string;
  icon: string;
  lastRun?: string;
  tasksToday: number;
  tasksTotal: number;
  successRate: number;
}

// ===== INTEGRAÇÕES =====

export type IntegrationId = "whatsapp" | "booking" | "airbnb" | "meta" | "openai" | "groq" | "mercadopago" | "asaas" | "tuya" | "august" | "whatsapp-cloud-api" | "airbnb-oauth" | "mercado-pago" | "zai-sdk" | "vercel-postgres";

export type IntegrationStatus = "online" | "offline" | "warning" | "configuring";

export interface Integration {
  id: IntegrationId;
  name: string;
  category: "messaging" | "booking" | "payment" | "llm" | "database";
  status: IntegrationStatus;
  latencyMs?: number;
  lastCheck?: string;
  endpoint?: string;
  purpose: string;
  isLLM?: boolean;
}

// ===== BRAIN HEALTH (espelha /api/brain response) =====

export interface BrainHealthResponse {
  status: string;
  service: string;
  version: string;
  engine: string;
  budget: {
    spentToday?: number;
    dailyLimit?: number;
    monthlySpend?: number;
    monthlyLimit?: number;
    criticalLevel?: string;
  };
  cache: {
    hitRate: number;
    totalEntries: number;
    avgTtlMinutes: number;
  };
  circuitBreakers: Record<string, string>;
  providers: RouterProvider[];
  learning?: {
    totalPatterns: number;
    verifiedPatterns: number;
    antiPatternsCount: number;
    learningVelocity: number;
    avgSentimentScore: number;
  };
}

// ===== EVENTOS DO CÉREBRO =====

export type EventType = "info" | "ok" | "warn" | "error" | "decision";

export interface BrainEvent {
  id: string;
  type: EventType;
  agent: string;
  message: string;
  detail?: string;
  at: string;
  confidence?: number;
}

// ===== KPIs DO OPERADOR =====

export interface OperatorKPI {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
}

// ===== TABS DO ZCC =====

export type ZccTabId =
  | "overview" | "live-leads" | "financeiro"
  | "onboarding" | "live-agents" | "pulse-check"
  | "brain" | "brain-tests" | "zecode" | "sandbox" | "breakdown"
  | "airbnb" | "pousadas" | "burn-rate" | "tenants" | "geo"
  | "tokens-ai" | "semantica"
  | "mobile-analytics"
  | "upsell" | "settings";

// ===== ZÉCODE — DEV FULL STACK INTERNO =====
// ZéCode = agente DEV FULL STACK interno do ZCC (inspirado em CodeRabbit.ai).
// Diferente do Cérebro Zélla (que toma decisões runtime em produção),
// o ZéCode atua sobre o código-fonte: análise, refactor, gargalos, gaps.
// Opera em paralelo ao Cérebro, sem conflito (escopos diferentes).

export type ZeCodeAnalysisKind =
  | "bottleneck" // gargalo de performance
  | "gap" // gap de funcionalidade / ausência de teste / etc
  | "improvement" // melhoria incremental
  | "refactor" // refactor estrutural
  | "security" // audit de segurança
  | "tech_debt" // débito técnico identificado
  | "anti_pattern"; // anti-pattern detectado

export type ZeCodeSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ZeCodeStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "applied"
  | "blocked_safety"; // bloqueado por trava de segurança

export interface ZeCodeFinding {
  id: string;
  kind: ZeCodeAnalysisKind;
  severity: ZeCodeSeverity;
  title: string;
  description: string;
  filePath: string;
  lineRange: string;
  confidence: number; // 0-100
  status: ZeCodeStatus;
  currentCode: string;
  proposedCode: string;
  rationale: string;
  createdAt: string;
  reviewedAt: string | null;
  // TRAVAS DE SEGURANÇA
  safetyChecks: ZeCodeSafetyCheck[];
}

export interface ZeCodeSafetyCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ZeCodeFileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: ZeCodeFileNode[];
  language?: string;
}

export type ZeCodeScanMode =
  | "quick" // scan rápido de hot files
  | "deep" // scan profundo (todos arquivos src/)
  | "targeted" // scan de arquivo/path específico
  | "diff"; // scan de diff git (pending changes)

export interface ZeCodeScanRequest {
  mode: ZeCodeScanMode;
  targetPath?: string;
  kinds?: ZeCodeAnalysisKind[];
  maxFindings?: number;
}

export interface ZeCodeScanResponse {
  ok: boolean;
  scanId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  filesScanned: number;
  findings: ZeCodeFinding[];
  safetySummary: {
    totalChecks: number;
    passed: number;
    blocked: number;
  };
  llmProvider: string;
  llmModel: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

// ===== STATS =====

export interface LeadsStats {
  total: number;
  porUf: { uf: string; count: number }[];
  porStatus: { status: string; count: number }[];
  porRegiao: { regiao: string; count: number }[];
  avgScore: number;
  avgScoreValid: number;
}

// ===== PLANOS COM PREÇO (alinhado com enum Plan do Prisma) =====

export interface PlanPricing {
  plan: Plan;
  price: number;
  label: string;
  features: string[];
}

/** Preços oficiais do comentário no schema.prisma */
export const PLAN_PRICING: PlanPricing[] = [
  {
    plan: "LITE",
    price: 197,
    label: "LITE",
    features: ["50 hóspedes", "500 mensagens", "IA limitada"],
  },
  {
    plan: "PRO",
    price: 397,
    label: "PRO",
    features: ["Ilimitado", "OAuth Airbnb", "Dynamic pricing"],
  },
  {
    plan: "MAX",
    price: 797,
    label: "MAX",
    features: ["Tudo de PRO", "Competitor monitoring", "Multi-property"],
  },
  {
    plan: "PARCEIRO",
    price: 247,
    label: "PARCEIRO",
    features: ["PRO + tab Conquistas", "Referral gamification"],
  },
];

// ===== TIPOS ADICIONAIS PARA ZCC v5 =====

export type UF = "AC" | "AL" | "AP" | "AM" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MT" | "MS" | "MG" | "PA" | "PB" | "PR" | "PE" | "PI" | "RJ" | "RN" | "RS" | "RO" | "RR" | "SC" | "SP" | "SE" | "TO";

export type Region = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export interface StateAggregate {
  uf: UF;
  name: string;
  region: Region;
  count: number;
  revenue: number;
  plan: Plan;
  totalLeads?: number;
  hotLeads?: number;
  convertedLeads?: number;
}

export interface ActivityEntry {
  type: "lead" | "reservation" | "message" | "alert" | "system" | "payment";
  message: string;
  text?: string;
  panel?: string;
  id?: string;
  at?: string;
  label?: string;
  timestamp: string;
  user?: string;
  priority?: "low" | "medium" | "high" | "urgent";
}

