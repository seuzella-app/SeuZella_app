// =============================================================================
// SEU ZÉLLA AUTOGEN ENGINE — TYPE DEFINITIONS & CONTRACTS
// =============================================================================

export interface AutoGenMessage {
  id: string;
  sender: string; // Nome do agente remetente
  recipient?: string; // Destinatário específico ou 'GroupChat'
  content: string;
  role?: 'user' | 'assistant' | 'system';
  timestamp: number;
  data?: Record<string, unknown>;
}

export type SpeakerSelectionMethod = 'round_robin' | 'auto_llm' | 'priority_order';

export interface GroupChatConfig {
  maxRounds: number;
  speakerSelectionMethod?: SpeakerSelectionMethod;
  adminName?: string;
  silent?: boolean;
}

export interface GroupChatTranscript {
  topic: string;
  messages: AutoGenMessage[];
  totalTurns: number;
  totalTokensUsed: number;
  estimatedCostUsd: number;
  durationMs: number;
  consensusSummary: string;
  isTerminated: boolean;
  terminationReason?: string;
}

export type TerminationCheckFn = (messages: AutoGenMessage[], latestMessage: AutoGenMessage) => boolean;
