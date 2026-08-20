import { describe, it, expect } from 'vitest';
import {
  AgentBudgetController,
  assertToolExecutionAllowed,
  TOOL_REGISTRY_POLICIES,
} from '@/lib/ai/tool-policy';

describe('🤖 Agentic Tool Security & Risk Policy Matrix (P2)', () => {
  it('deve aprovar ferramentas de baixo risco para staff sem necessidade de confirmação humana', () => {
    const result = assertToolExecutionAllowed({
      toolId: 'getRoomAvailability',
      userRole: 'staff',
      contextTenantId: 'tenant_hotel_sol',
      targetTenantId: 'tenant_hotel_sol',
    });

    expect(result.allowed).toBe(true);
  });

  it('deve bloquear ferramentas de risco CRITICAL/HIGH sem aprovação humana', () => {
    const resultUnlock = assertToolExecutionAllowed({
      toolId: 'unlockDoorRemote',
      userRole: 'owner',
      isHumanApproved: false,
      contextTenantId: 'tenant_hotel_sol',
    });

    expect(resultUnlock.allowed).toBe(false);
    expect(resultUnlock.reason).toContain('HUMAN_APPROVAL_REQUIRED');

    const resultRefund = assertToolExecutionAllowed({
      toolId: 'processPaymentRefund',
      userRole: 'owner',
      isHumanApproved: false,
      contextTenantId: 'tenant_hotel_sol',
    });

    expect(resultRefund.allowed).toBe(false);
    expect(resultRefund.reason).toContain('HUMAN_APPROVAL_REQUIRED');
  });

  it('deve autorizar ferramenta crítica quando explicitamente aprovada por humano com papel adequado', () => {
    const result = assertToolExecutionAllowed({
      toolId: 'unlockDoorRemote',
      userRole: 'owner',
      isHumanApproved: true,
      contextTenantId: 'tenant_hotel_sol',
      targetTenantId: 'tenant_hotel_sol',
    });

    expect(result.allowed).toBe(true);
  });

  it('deve bloquear tentativas de Cross-Tenant Tool Execution (Anti-IDOR)', () => {
    const result = assertToolExecutionAllowed({
      toolId: 'getRoomAvailability',
      userRole: 'owner',
      contextTenantId: 'tenant_alpha',
      targetTenantId: 'tenant_beta',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('CROSS_TENANT_TOOL_BLOCKED');
  });

  it('deve aplicar limites estritos de turnos e profundidade de recursão (Budget Controller)', () => {
    expect(() => {
      AgentBudgetController.validateTurnLimits(6, 1);
    }).toThrow(/AGENT_BUDGET_EXCEEDED/);

    expect(() => {
      AgentBudgetController.validateTurnLimits(3, 4);
    }).toThrow(/AGENT_RECURSION_LIMIT/);

    expect(() => {
      AgentBudgetController.validateTurnLimits(4, 2);
    }).not.toThrow();
  });
});
