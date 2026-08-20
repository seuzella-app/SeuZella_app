/**
 * Backend authorization boundary for agent tool execution.
 * The model is never the authority: identity, tenant scope, role, risk and confirmation
 * are validated here before a registered tool can execute.
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
  explicitConfirmation?: boolean;
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
  constructor(message: string, public code: string) { super(message); this.name = 'ToolAuthorizationError'; }
}

const ROLE_HIERARCHY: Record<string, number> = { guest: 1, robot: 1, staff: 2, admin: 3, owner: 4 };
export const AGENT_BUDGET = { MAX_TOOL_CALLS_PER_TURN: 10, MAX_EXECUTION_TIME_MS: 30000, CIRCUIT_BREAKER_THRESHOLD: 3 };
// Circuit-breaker state is tenant-scoped so one tenant cannot disable a tool for every tenant.
const toolFailureCounts = new Map<string, number>();

export const TOOL_REGISTRY: Map<string, ToolDefinition> = new Map([
  ['checkAvailability', { name: 'checkAvailability', description: 'Consultar disponibilidade', risk: 'low', requiredRole: 'guest', isStateChanging: false }],
  ['getRoomDetails', { name: 'getRoomDetails', description: 'Ver detalhes do quarto', risk: 'low', requiredRole: 'guest', isStateChanging: false }],
  ['createReservationDraft', { name: 'createReservationDraft', description: 'Criar rascunho de reserva', risk: 'medium', requiredRole: 'guest', isStateChanging: true }],
  ['confirmPayment', { name: 'confirmPayment', description: 'Confirmar pagamento', risk: 'high', requiredRole: 'staff', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['generateDoorPasscode', { name: 'generateDoorPasscode', description: 'Gerar senha de fechadura', risk: 'high', requiredRole: 'staff', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['unlockDoorRemote', { name: 'unlockDoorRemote', description: 'Abertura remota de fechadura', risk: 'critical', requiredRole: 'admin', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['cancelReservation', { name: 'cancelReservation', description: 'Cancelar reserva de hóspede', risk: 'high', requiredRole: 'staff', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['updatePricingPolicy', { name: 'updatePricingPolicy', description: 'Alterar regras de tarifário', risk: 'critical', requiredRole: 'owner', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['sendBulkWhatsApp', { name: 'sendBulkWhatsApp', description: 'Disparo em massa de WhatsApp', risk: 'high', requiredRole: 'admin', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['exportTenantData', { name: 'exportTenantData', description: 'Exportar dados cadastrais', risk: 'high', requiredRole: 'owner', isStateChanging: false, requiresExplicitConfirmation: true }],
]);

function failureKey(tenantId: string, toolName: string): string {
  return `${tenantId}:${toolName}`;
}

export function recordToolExecutionResult(toolName: string, success: boolean, tenantId?: string): void {
  if (!tenantId) return;
  const key = failureKey(tenantId, toolName);
  if (success) toolFailureCounts.delete(key);
  else toolFailureCounts.set(key, (toolFailureCounts.get(key) || 0) + 1);
}

export function authorizeToolExecution(toolName: string, params: Record<string, unknown>, context: ToolInvocationContext): { authorized: boolean; reason?: string } {
  if (!context.userId || !context.tenantId || (process.env.NODE_ENV === 'production' && context.tenantId.includes('demo'))) {
    throw new ToolAuthorizationError('INVALID_OR_MISSING_TENANT_CONTEXT', 'TENANT_SCOPE_VIOLATION');
  }
  if (context.turnToolCallCount !== undefined && context.turnToolCallCount >= AGENT_BUDGET.MAX_TOOL_CALLS_PER_TURN) {
    throw new ToolAuthorizationError('Tool-call budget exceeded', 'TOOL_BUDGET_EXCEEDED');
  }
  if (context.startTimeMs && Date.now() - context.startTimeMs > AGENT_BUDGET.MAX_EXECUTION_TIME_MS) {
    throw new ToolAuthorizationError('Agent execution timeout exceeded', 'EXECUTION_TIMEOUT');
  }

  const tool = TOOL_REGISTRY.get(toolName);
  if (!tool) throw new ToolAuthorizationError(`Unregistered tool: ${toolName}`, 'UNKNOWN_TOOL');

  const failures = toolFailureCounts.get(failureKey(context.tenantId, toolName)) || 0;
  if (failures >= AGENT_BUDGET.CIRCUIT_BREAKER_THRESHOLD) {
    throw new ToolAuthorizationError('Tool temporarily disabled by circuit breaker', 'CIRCUIT_BREAKER_ACTIVE');
  }

  const userLevel = ROLE_HIERARCHY[context.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[tool.requiredRole] || 99;
  if (userLevel < requiredLevel) throw new ToolAuthorizationError('Insufficient role for tool', 'INSUFFICIENT_PERMISSIONS');

  if (params.tenantId !== undefined && params.tenantId !== context.tenantId) {
    throw new ToolAuthorizationError('Cross-tenant parameter injection detected', 'CROSS_TENANT_ATTEMPT');
  }

  if (tool.requiresExplicitConfirmation && context.explicitConfirmation !== true) {
    throw new ToolAuthorizationError('Explicit confirmation required', 'EXPLICIT_CONFIRMATION_REQUIRED');
  }

  for (const key of ['userId', 'actorId', 'ownerId']) {
    if (params[key] !== undefined && params[key] !== context.userId) {
      throw new ToolAuthorizationError(`Identity parameter '${key}' does not match authenticated user`, 'IDENTITY_SCOPE_VIOLATION');
    }
  }

  logger.debug('Agent tool authorized', { toolName, tenantId: context.tenantId, userId: context.userId, role: context.role, risk: tool.risk }, context.requestId);
  return { authorized: true };
}
