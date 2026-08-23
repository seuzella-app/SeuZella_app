/**
 * ============================================================================
 * 🤖 AGENTIC TOOL SECURITY POLICY & RISK MATRIX (FASE P2)
 * ============================================================================
 *
 * Responsabilidades:
 * 1. Mapeamento de ferramentas cognitivas com classificação de risco:
 *    - LOW: Leitura não sensível
 *    - MEDIUM: Operações de escrita reversíveis
 *    - HIGH: Atualizações financeiras e alteração de reservas
 *    - CRITICAL: Acionamento físico (Smart Locks), estornos e código
 * 2. Controle de limites de turnos, chamadas de ferramentas e recursão (Budget Controller)
 * 3. Garantia estrita de vinculação ao Tenant do SecurityContext
 * ============================================================================
 */

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TenantRole = 'owner' | 'admin' | 'staff' | 'guest';

export interface ToolSecurityPolicy {
  toolId: string;
  risk: ToolRiskLevel;
  requiredRole: TenantRole;
  requiresHumanApproval: boolean;
  tenantBound: boolean;
  maxExecutionTimeMs: number;
}

export const TOOL_REGISTRY_POLICIES: Record<string, ToolSecurityPolicy> = {
  getRoomAvailability: {
    toolId: 'getRoomAvailability',
    risk: 'LOW',
    requiredRole: 'staff',
    requiresHumanApproval: false,
    tenantBound: true,
    maxExecutionTimeMs: 3000,
  },
  getGuestFolio: {
    toolId: 'getGuestFolio',
    risk: 'LOW',
    requiredRole: 'staff',
    requiresHumanApproval: false,
    tenantBound: true,
    maxExecutionTimeMs: 3000,
  },
  updateReservationDates: {
    toolId: 'updateReservationDates',
    risk: 'HIGH',
    requiredRole: 'admin',
    requiresHumanApproval: true, // Requer confirmação para evitar perdas financeiras
    tenantBound: true,
    maxExecutionTimeMs: 5000,
  },
  processPaymentRefund: {
    toolId: 'processPaymentRefund',
    risk: 'CRITICAL',
    requiredRole: 'owner',
    requiresHumanApproval: true, // Estornos financeiros sempre exigem aprovação humana
    tenantBound: true,
    maxExecutionTimeMs: 6000,
  },
  unlockDoorRemote: {
    toolId: 'unlockDoorRemote',
    risk: 'CRITICAL',
    requiredRole: 'owner',
    requiresHumanApproval: true, // Abertura remota de portas físicas requer aprovação
    tenantBound: true,
    maxExecutionTimeMs: 4000,
  },
  generateReservationPin: {
    toolId: 'generateReservationPin',
    risk: 'MEDIUM',
    requiredRole: 'staff',
    requiresHumanApproval: false,
    tenantBound: true,
    maxExecutionTimeMs: 4000,
  },
};

export class AgentBudgetController {
  private static readonly MAX_TOOL_CALLS_PER_TURN = 5;
  private static readonly MAX_DEPTH_RECURSION = 3;

  static validateTurnLimits(callCount: number, depth: number): void {
    if (callCount > this.MAX_TOOL_CALLS_PER_TURN) {
      throw new Error(
        `[AGENT_BUDGET_EXCEEDED] Máximo de ${this.MAX_TOOL_CALLS_PER_TURN} chamadas de ferramentas atingido no turno atual.`
      );
    }
    if (depth > this.MAX_DEPTH_RECURSION) {
      throw new Error(
        `[AGENT_RECURSION_LIMIT] Profundidade de recursão máxima (${this.MAX_DEPTH_RECURSION}) atingida.`
      );
    }
  }
}

/**
 * Validador de execução de ferramenta com base na política de segurança
 */
export function assertToolExecutionAllowed(params: {
  toolId: string;
  userRole: TenantRole;
  isHumanApproved?: boolean;
  contextTenantId: string;
  targetTenantId?: string;
}): { allowed: boolean; reason?: string } {
  const policy = TOOL_REGISTRY_POLICIES[params.toolId];

  if (!policy) {
    return { allowed: false, reason: `TOOL_NOT_REGISTERED: Ferramenta '${params.toolId}' não registrada na política de segurança.` };
  }

  // 1. Isolamento de Tenant (Anti-IDOR em ferramentas de IA)
  if (policy.tenantBound && params.targetTenantId && params.contextTenantId !== params.targetTenantId) {
    return {
      allowed: false,
      reason: `CROSS_TENANT_TOOL_BLOCKED: Tentativa de executar ferramenta '${params.toolId}' para tenant '${params.targetTenantId}' a partir do contexto '${params.contextTenantId}'.`,
    };
  }

  // 2. Verificação de Role (RBAC)
  const roleHierarchy: Record<TenantRole, number> = {
    guest: 1,
    staff: 2,
    admin: 3,
    owner: 4,
  };

  if (roleHierarchy[params.userRole] < roleHierarchy[policy.requiredRole]) {
    return {
      allowed: false,
      reason: `INSUFFICIENT_ROLE: A ferramenta '${params.toolId}' exige privilégios de '${policy.requiredRole}', mas o usuário possui '${params.userRole}'.`,
    };
  }

  // 3. Human-in-the-loop requirement
  if (policy.requiresHumanApproval && !params.isHumanApproved) {
    return {
      allowed: false,
      reason: `HUMAN_APPROVAL_REQUIRED: A ferramenta '${params.toolId}' (Risco ${policy.risk}) requer confirmação humana explícita antes do disparo.`,
    };
  }

  return { allowed: true };
}
