/**
 * Backend Tool Authorization Engine
 * Desacoplado do Prompt Guard: Garante que o modelo de IA NUNCA execute ferramentas
 * ou ações de estado sem autorização explícita validada pelo backend, tenant scope e RBAC.
 */

export interface ToolInvocationContext {
  userId: string;
  tenantId: string;
  role: 'owner' | 'admin' | 'staff' | 'guest' | 'robot';
  requestId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
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

/** Catálogo de ferramentas registradas com políticas de autorização */
const TOOL_REGISTRY: Map<string, ToolDefinition> = new Map([
  ['checkAvailability', { name: 'checkAvailability', description: 'Consultar disponibilidade', requiredRole: 'guest', isStateChanging: false }],
  ['getRoomDetails', { name: 'getRoomDetails', description: 'Ver detalhes do quarto', requiredRole: 'guest', isStateChanging: false }],
  ['createReservationDraft', { name: 'createReservationDraft', description: 'Criar rascunho de reserva', requiredRole: 'guest', isStateChanging: true }],
  ['confirmPayment', { name: 'confirmPayment', description: 'Confirmar pagamento', requiredRole: 'staff', isStateChanging: true }],
  ['generateDoorPasscode', { name: 'generateDoorPasscode', description: 'Gerar senha de fechadura', requiredRole: 'staff', isStateChanging: true }],
  ['unlockDoorRemote', { name: 'unlockDoorRemote', description: 'Abertura remota de fechadura', requiredRole: 'admin', isStateChanging: true, requiresExplicitConfirmation: true }],
  ['cancelReservation', { name: 'cancelReservation', description: 'Cancelar reserva de hóspede', requiredRole: 'staff', isStateChanging: true }],
  ['updatePricingPolicy', { name: 'updatePricingPolicy', description: 'Alterar regras de tarifário', requiredRole: 'owner', isStateChanging: true }],
  ['sendBulkWhatsApp', { name: 'sendBulkWhatsApp', description: 'Disparo em massa de WhatsApp', requiredRole: 'admin', isStateChanging: true }],
  ['exportTenantData', { name: 'exportTenantData', description: 'Exportar dados cadastrais', requiredRole: 'owner', isStateChanging: false }],
]);

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

  // 2. Verificação de Registro da Ferramenta
  const tool = TOOL_REGISTRY.get(toolName);
  if (!tool) {
    throw new ToolAuthorizationError(`Unregistered tool: ${toolName}`, 'UNKNOWN_TOOL');
  }

  // 3. Verificação de RBAC (Role-Based Access Control)
  const userLevel = ROLE_HIERARCHY[context.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[tool.requiredRole] || 99;

  if (userLevel < requiredLevel) {
    throw new ToolAuthorizationError(
      `Role '${context.role}' does not have permission to execute '${toolName}' (requires '${tool.requiredRole}')`,
      'INSUFFICIENT_PERMISSIONS'
    );
  }

  // 4. Isolamento estrito de parâmetros de Tenant (Parâmetros não podem referenciar outro tenantId)
  if (params.tenantId && params.tenantId !== context.tenantId) {
    throw new ToolAuthorizationError('Cross-tenant parameter injection detected', 'CROSS_TENANT_ATTEMPT');
  }

  return { authorized: true };
}
