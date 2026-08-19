// =============================================================================
// SEU ZÉLLA AUTOGEN ENGINE — NESTED CHAT (SUB-CONVERSAS INTERNAS)
// =============================================================================

import { ConversableAgent } from './conversable-agent';
import { GroupChat, GroupChatManager } from './group-chat';
import { type GroupChatTranscript } from './types';

export interface NestedChatConfig {
  recipient: ConversableAgent | ConversableAgent[];
  topic: string;
  maxRounds?: number;
  summaryPrompt?: string;
}

export class NestedChatCoordinator {
  /**
   * Dispara uma sub-conversa interna invisível entre sub-agentes e retorna o consenso final.
   */
  public static async execute(
    initiator: ConversableAgent,
    config: NestedChatConfig,
    query: string
  ): Promise<{ summary: string; transcript: GroupChatTranscript }> {
    const participants = Array.isArray(config.recipient)
      ? [initiator, ...config.recipient]
      : [initiator, config.recipient];

    const groupChat = new GroupChat(participants, config.maxRounds || 4);
    const manager = new GroupChatManager(groupChat, {
      maxRounds: config.maxRounds || 4,
      speakerSelectionMethod: 'round_robin',
    });

    const transcript = await manager.run(config.topic, query, 1);

    return {
      summary: transcript.consensusSummary,
      transcript,
    };
  }
}
