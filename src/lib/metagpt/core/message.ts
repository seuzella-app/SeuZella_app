// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — MESSAGE BUS CONTRACTS
// =============================================================================

export interface MetaMessage<T = unknown> {
  id: string;
  sender: string; // Ex: 'DemandAnalystRole', 'GuestConciergeRole', 'User'
  senderRole?: string;
  recipient?: string; // Ex: 'YieldStrategistRole', 'All', 'Environment'
  topic: string; // Ex: 'yield.proposal', 'guest.message', 'hardware.alert'
  content: string;
  data?: T;
  timestamp: number;
  tags?: string[];
  correlationId?: string;
}

export interface SOPExecutionLog {
  sopName: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ESCALATED_HITL';
  totalTokensUsed: number;
  estimatedCostUsd: number;
  steps: Array<{
    stepIndex: number;
    roleName: string;
    actionName: string;
    inputSummary: string;
    outputSummary: string;
    tokensUsed: number;
    durationMs: number;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  }>;
  error?: string;
}
