/**
 * AIRB PRO — Tipos compartilhados dos módulos P0/P1
 * Inspiração: análise competitiva ProHost (out/2026)
 *
 * Módulos cobertos:
 *   P0-1: PDF Reports
 *   P0-2: Financial Management (despesas, fluxo de caixa)
 *   P0-3: Self-Service Trial
 *   P1-1: Operations (limpeza, manutenção, checklist)
 *   P1-2: Goals Dashboard
 *   P1-3: Commissions (parceiros/afiliados)
 */

// ── P0-1: PDF REPORTS ─────────────────────────────────────────────────────────

export type ReportType =
  | 'monthly_summary' // resumo mensal completo
  | 'reservations' // lista de reservas do período
  | 'financial' // DRE simplificado + fluxo de caixa
  | 'guests' // CRM de hóspedes
  | 'operations' // tarefas de limpeza/manutenção
  | 'goals' // progresso de metas
  | 'commissions'; // comissões de parceiros

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface ReportPeriod {
  startDate: Date;
  endDate: Date;
  label: string; // ex: "Julho 2026" ou "01/07 a 31/07/2026"
}

export interface ReportRequest {
  type: ReportType;
  format: ReportFormat;
  period: ReportPeriod;
  filters?: {
    propertyId?: string;
    category?: string;
    status?: string;
  };
}

export interface ReportMetadata {
  tenantName: string;
  tenantEmail?: string;
  generatedAt: Date;
  generatedBy: string;
  periodLabel: string;
  filtersApplied: readonly string[];
}

// ── P0-2: FINANCIAL MANAGEMENT ────────────────────────────────────────────────

export type ExpenseCategory =
  | 'fixed_cost' // custos fixos (aluguel, software, salários)
  | 'variable' // custos variáveis (produtos de limpeza, amenidades)
  | 'maintenance' // manutenção (consertos, peças)
  | 'utilities' // utilidades (luz, água, internet)
  | 'marketing' // marketing (anúncios, redes sociais)
  | 'commission' // comissões (OTA, parceiros)
  | 'tax' // impostos (ISS, PIS, COFINS)
  | 'other'; // outros

export type ExpenseStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ExpenseRecurrence = 'one_time' | 'monthly' | 'weekly' | 'yearly';

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  dueDate?: Date;
  paidAt?: Date;
  status?: ExpenseStatus;
  recurrence?: ExpenseRecurrence;
  document?: string;
  metadata?: Record<string, unknown>;
}

export interface ExpenseRecord extends ExpenseInput {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashFlowSummary {
  period: ReportPeriod;
  inflow: number; // total de receitas (reservas pagas)
  outflow: number; // total de despesas pagas
  net: number; // inflow - outflow
  pendingExpenses: number;
  overdueExpenses: number;
  byCategory: Record<ExpenseCategory, { count: number; total: number }>;
  byMonth: Array<{ month: string; inflow: number; outflow: number; net: number }>;
}

export interface DreSimplified {
  period: ReportPeriod;
  grossRevenue: number; // receita bruta
  otaCommissions: number; // comissões de OTAs
  netRevenue: number; // receita líquida
  fixedCosts: number;
  variableCosts: number;
  marketingCosts: number;
  taxes: number;
  ebitda: number; // resultado antes de impostos/juros
  margin: number; // margem percentual
}

// ── P0-3: SELF-SERVICE TRIAL ──────────────────────────────────────────────────

export type TrialStatus =
  | 'started' // signup inicial
  | 'verified' // email verificado
  | 'converted' // virou Tenant real
  | 'abandoned' // abandonou antes de converter
  | 'expired'; // trial expirou sem conversão

export type TrialNiche = 'pousada' | 'airbnb';
export type TrialSource = 'organic' | 'ads' | 'referral' | 'partner';

export interface TrialSignupInput {
  email: string;
  phone?: string;
  name?: string;
  companyName?: string;
  niche?: TrialNiche;
  source?: TrialSource;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
}

export interface TrialSignupRecord extends TrialSignupInput {
  id: string;
  status: TrialStatus;
  magicToken: string | null;
  verifiedAt: Date | null;
  convertedAt: Date | null;
  tenantId: string | null;
  abandonReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrialFunnelStats {
  totalStarted: number;
  totalVerified: number;
  totalConverted: number;
  totalAbandoned: number;
  totalExpired: number;
  conversionRate: number; // converted / started
  dropOff: {
    startedToVerified: number; // % que abandonou entre started → verified
    verifiedToConverted: number;
  };
  bySource: Record<TrialSource, number>;
  byNiche: Record<TrialNiche, number>;
  byDay: Array<{ date: string; started: number; converted: number }>;
}

// ── P1-1: OPERATIONS ──────────────────────────────────────────────────────────

export type OperationTaskType =
  | 'cleaning' // limpeza (checkout, check-in prep, deep clean)
  | 'maintenance' // manutenção corretiva/preventiva
  | 'inspection' // inspeção rotineira
  | 'restock' // reposição de insumos
  | 'other';

export type OperationTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OperationTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChecklistItem {
  item: string;
  done: boolean;
  notes?: string;
}

export interface OperationTaskInput {
  propertyId?: string | null;
  type: OperationTaskType;
  priority?: OperationTaskPriority;
  title: string;
  description?: string;
  assignedTo?: string | null;
  scheduledFor?: Date | null;
  estimatedMin?: number;
  checklist?: ChecklistItem[];
  cost: number;
  metadata?: Record<string, unknown>;
}

export interface OperationTaskRecord extends OperationTaskInput {
  id: string;
  tenantId: string;
  status: OperationTaskStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  actualMin: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationsDashboard {
  pending: number;
  inProgress: number;
  completedToday: number;
  completedThisWeek: number;
  overdue: number;
  byType: Record<OperationTaskType, number>;
  byPriority: Record<OperationTaskPriority, number>;
  upcoming: OperationTaskRecord[]; // próximas 7 tarefas agendadas
  recent: OperationTaskRecord[]; // últimas 5 tarefas concluídas
}

// ── P1-2: GOALS DASHBOARD ─────────────────────────────────────────────────────

export type GoalType =
  | 'revenue' // receita total
  | 'occupancy' // taxa de ocupação
  | 'bookings' // número de reservas
  | 'adr' // Average Daily Rate
  | 'revpar' // Revenue Per Available Room
  | 'guests' // número de hóspedes
  | 'reviews'; // número de avaliações

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'paused';
export type GoalUnit = 'BRL' | 'percent' | 'count';

export interface GoalInput {
  type: GoalType;
  period: GoalPeriod;
  targetValue: number;
  currentValue: number;
  unit?: GoalUnit;
  startDate: Date;
  endDate: Date;
  notes?: string;
}

export interface GoalRecord extends GoalInput {
  id: string;
  tenantId: string;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalProgress {
  goal: GoalRecord;
  progressPercent: number; // 0-100
  remaining: number;
  daysRemaining: number;
  projectedValue: number; // projeção linear no fim do período
  projectedStatus: GoalStatus; // achieved | missed baseado na projeção
  trend: 'up' | 'down' | 'flat';
}

export interface GoalsDashboard {
  active: GoalProgress[];
  achievedThisPeriod: GoalRecord[];
  missedThisPeriod: GoalRecord[];
  summary: {
    totalGoals: number;
    onTrack: number;
    atRisk: number;
    achieved: number;
    missed: number;
  };
}

// ── P1-3: COMMISSIONS ─────────────────────────────────────────────────────────

export type ReferralType = 'affiliate' | 'agent' | 'partner' | 'influencer';
export type CommissionRule = 'percentage' | 'fixed';
export type CommissionStatus = 'pending' | 'payable' | 'paid' | 'cancelled';

export interface CommissionInput {
  partnerName: string;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
  partnerCode?: string | null;
  referralType?: ReferralType;
  rule?: CommissionRule;
  rate: number;
  basisAmount: number;
  dueDate?: Date | null;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CommissionRecord extends CommissionInput {
  id: string;
  tenantId: string;
  status: CommissionStatus;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionsSummary {
  period: ReportPeriod;
  totalPending: number;
  totalPayable: number;
  totalPaid: number;
  totalCancelled: number;
  byPartner: Array<{
    partnerName: string;
    partnerCode: string | null;
    referralType: ReferralType;
    count: number;
    totalAmount: number;
    paid: number;
    pending: number;
  }>;
  byReferralType: Record<ReferralType, { count: number; total: number }>;
}

// ── SHARED UTILITIES ──────────────────────────────────────────────────────────

export interface ApiListResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    source?: 'db' | 'demo' | 'fallback';
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/** Helper para gerar período mensal (mês atual ou anterior) */
export function getMonthPeriod(year: number, month: number): ReportPeriod {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const label = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return { startDate, endDate, label };
}

/** Helper para gerar período dos últimos N dias */
export function getLastNDaysPeriod(n: number): ReportPeriod {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - n);
  const label = `Últimos ${n} dias`;
  return { startDate, endDate, label };
}

/** Helper para formatar valores em BRL */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Helper para formatar percentual */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** Helper para formatar datas no padrão pt-BR */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

/** Helper para formatar data e hora */
export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Categorias de despesa com labels em PT-BR */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fixed_cost: 'Custos Fixos',
  variable: 'Custos Variáveis',
  maintenance: 'Manutenção',
  utilities: 'Utilidades',
  marketing: 'Marketing',
  commission: 'Comissões',
  tax: 'Impostos',
  other: 'Outros',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
};

export const OPERATION_TYPE_LABELS: Record<OperationTaskType, string> = {
  cleaning: 'Limpeza',
  maintenance: 'Manutenção',
  inspection: 'Inspeção',
  restock: 'Reposição',
  other: 'Outro',
};

export const OPERATION_PRIORITY_LABELS: Record<OperationTaskPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  revenue: 'Receita',
  occupancy: 'Ocupação',
  bookings: 'Reservas',
  adr: 'Diária Média (ADR)',
  revpar: 'RevPAR',
  guests: 'Hóspedes',
  reviews: 'Avaliações',
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export const REFERRAL_TYPE_LABELS: Record<ReferralType, string> = {
  affiliate: 'Afiliado',
  agent: 'Agente',
  partner: 'Parceiro',
  influencer: 'Influencer',
};

/** Checklist padrão para limpeza de checkout */
export const DEFAULT_CLEANING_CHECKLIST: ChecklistItem[] = [
  { item: 'Trocar roupas de cama', done: false },
  { item: 'Lavar toalhas', done: false },
  { item: 'Limpar banheiro completo', done: false },
  { item: 'Limpar cozinha (pia, fogão, geladeira)', done: false },
  { item: 'Varrer e passar piso', done: false },
  { item: 'Esvaziar lixeiras', done: false },
  { item: 'Repor amenidades (sabonete, shampoo, papel)', done: false },
  { item: 'Verificar iluminação e tomadas', done: false },
  { item: 'Checar ar-condicionado/ventilador', done: false },
  { item: 'Inspecionar danos ou itens faltantes', done: false },
];

/** Checklist padrão para manutenção preventiva */
export const DEFAULT_MAINTENANCE_CHECKLIST: ChecklistItem[] = [
  { item: 'Verificar vazamentos (torneiras, vasos, chuveiros)', done: false },
  { item: 'Testar extintores e alarmes', done: false },
  { item: 'Inspecionar instalação elétrica (tomadas, disjuntores)', done: false },
  { item: 'Limpar filtros de ar-condicionado', done: false },
  { item: 'Verificar fechaduras e dobradiças', done: false },
  { item: 'Inspecionar telhado/forro (se aplicável)', done: false },
  { item: 'Conferir pressão de água', done: false },
  { item: 'Limpar caixa de gordura e ralos', done: false },
];
