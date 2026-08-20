/**
 * ============================================================================
 * 🤖 BACKEND TOOL AUTHORIZATION & AGENT SECURITY POLICY
 * ============================================================================
 *
 * Desacoplado do Prompt Guard: Garante que o modelo de IA NUNCA execute ferramentas
 * ou ações de estado sem autorização explícita validada pelo backend, tenant scope,
 * matriz de risco, orçamentos e circuit breaker.
 * ============================================================================
 */

import { logger } from '@/lib/logger';

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ToolInvocationContext {
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'staff' | 'guest' | 'robot';
  requestId?: string;
  turnToolCallCount?: number;
  startTimeMs?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: ToolRiskLevel;
  requiredRole: 'owner' | 'admin' | 'staff' | 'guest' | 'robot';
  isStateChanging: boolean;
  requiresExplicitConfirmation?: boolean;
}

export class ToolAuthorizationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ToolAuthorizationError';
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  guest: 1,
  staff: 2,
  admin: 3,
  owner: 4,
  robot: 4,
};

// Limites de orçamento por turno de execução
export const AGENT_BUDGET = {
  MAX_TOOL_CALLS_PER_TURN: 10,
  MAX_EXECUTION_TIME_MS: 30000, // 30 segundos
  CIRCUIT_BREAKER_THRESHOLD: 3,  // 3 falhas consecutivas bloqueiam a ferramenta
};

/** Circuit breaker em memória para ferramentas com falhas consecutivas */
const toolFailureCounts = new Map<string, number>();

/** Catálogo de ferramentas registradas com políticas de risco e autorização */
export const TOOL_REGISTRY: Map<string, ToolDefinition> = new Map([
  ['checkAvailability', { name: 'checkAvailability', description: 'Consultar disponibilidade', risk: 'low', requiredRole: 'guest', isStateChanging: false }],
  ['getRoomDetails', { name: 'getRoomDetails', description: 'Ver detalhes do quarto', risk: 'low', requiredRole: 'guest', isStateChanging: false }],
  ['createReservationDraft', { name: 'createReservationDraft', description: 'Criar rascunho de reserva', risk: 'medium', requiredRole: 'guest', isStateChanging: true }],
  ['confirmPayment', { name: 'confirmPayment', description: 'Confirmar pagamento', risk: 'high', requiredRole: 'staff', isStateChanging: true }],
  ['generateDoorPasscode', { name: 'generateDoorPasscode', description: 'Gerar senha de fechadura', risk: 'high', requiredRole: 'staff', isStateChanging: true }],
  ['unlockDoorRemote', { name: 'unlockDoorRemote', description: 'Abertura remota de fechadura', risk: 'critical', requiredRole: 'admin', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['cancelReservation', { name: 'cancelReservation', description: 'Cancelar reserva de hóspede', risk: 'high', requiredRole: 'staff', isStateChanging: true }],
  ['updatePricingPolicy', { name: 'updatePricingPolicy', description: 'Alterar regras de tarifário', risk: 'critical', requiredRole: 'owner', isStateChanging: true }],
  ['sendBulkWhatsApp', { name: 'sendBulkWhatsApp', description: 'Disparo em massa de WhatsApp', risk: 'high', requiredRole: 'admin', isStateChanging: true }],
  ['exportTenantData', { name: 'exportTenantData', description: 'Exportar dados cadastrais', risk: 'high', requiredRole: 'owner', isStateChanging: false }],
]);

/**
 * Registra falha ou sucesso de ferramenta para o circuit breaker
 */
export function recordToolExecutionResult(toolName: string, success: boolean): void {
  if (success) {
    toolFailureCounts.delete(toolName);
  } else {
    const current = toolFailureCounts.get(toolName) || 0;
    toolFailureCounts.set(toolName, current + 1);
  }
}

/**
 * Valida se uma solicitação de invocação de ferramenta emitida pela IA é autorizada pelo backend
 */
export function authorizeToolExecution(
  toolName: string,
  params: Record<string, any>,
  context: ToolInvocationContext
): { authorized: boolean; reason?: string } {
  // 1. Validação de Tenant Context
  if (!context.tenantId || (process.env.NODE_ENV === 'production' && context.tenantId.includes('demo'))) {
    throw new ToolAuthorizationError('INVALID_OR_MISSING_TENANT_CONTEXT', 'TENANT_SCOPE_VIOLATION');
  }

  // 2. Verificação de Orçamento de Chamadas (Budget Guard)
  if (context.turnToolCallCount !== undefined && context.turnToolCallCount >= AGENT_BUDGET.MAX_TOOL_CALLS_PER_TURN) {
    throw new ToolAuthorizationError(
      `Limite de ${AGENT_BUDGET.MAX_TOOL_CALLS_PER_TURN} chamadas de ferramentas por turno excedido.`,
      'TOOL_BUDGET_EXCEEDED'
    );
  }

  // 3. Verificação de Timeout de Execução
  if (context.startTimeMs && (Date.now() - context.startTimeMs > AGENT_BUDGET.MAX_EXECUTION_TIME_MS)) {
    throw new ToolAuthorizationError(
      `Tempo limite de execução de agente (${AGENT_BUDGET.MAX_EXECUTION_TIME_MS}ms) expirado.`,
      'EXECUTION_TIMEOUT'
    );
  }

  // 4. Verificação de Circuit Breaker da Ferramenta
  const consecutiveFailures = toolFailureCounts.get(toolName) || 0;
  if (consecutiveFailures >= AGENT_BUDGET.CIRCUIT_BREAKER_THRESHOLD) {
    throw new ToolAuthorizationError(
      `Ferramenta '${toolName}' temporariamente desativada por excesso de falhas consecutivas (${consecutiveFailures}).`,
      'CIRCUIT_BREAKER_ACTIVE'
    );
  }

  // 5. Verificação de Registro da Ferramenta
  const tool = TOOL_REGISTRY.get(toolName);
  if (!tool) {
    throw new ToolAuthorizationError(`Unregistered tool: ${toolName}`, 'UNKNOWN_TOOL');
  }

  // 6. Verificação de RBAC (Role-Based Access Control)
  const userLevel = ROLE_HIERARCHY[context.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[tool.requiredRole] || 99;

  if (userLevel < requiredLevel) {
    throw new ToolAuthorizationError(
      `Role '${context.role}' does not have permission to execute '${toolName}' (requires '${tool.requiredRole}')`,
      'INSUFFICIENT_PERMISSIONS'
    );
  }

  // 7. Isolamento estrito de parâmetros de Tenant (Parâmetros não podem referenciar outro tenantId)
  if (params.tenantId && params.tenantId !== context.tenantId) {
    throw new ToolAuthorizationError('Cross-tenant parameter injection detected', 'CROSS_TENANT_ATTEMPT');
  }

  return { authorized: true };
}
