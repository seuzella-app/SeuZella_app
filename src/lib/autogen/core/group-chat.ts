// =============================================================================
// SEU ZÉLLA AUTOGEN ENGINE — GROUP CHAT & GROUP CHAT MANAGER
// =============================================================================

import { ConversableAgent } from './conversable-agent';
import { type AutoGenMessage, type GroupChatConfig, type GroupChatTranscript } from './types';

export class GroupChat {
  public agents: ConversableAgent[] = [];
  public messages: AutoGenMessage[] = [];
  public maxRounds: number;

  constructor(agents: ConversableAgent[], maxRounds = 6) {
    this.agents = agents;
    this.maxRounds = maxRounds;
  }

  public reset() {
    this.messages = [];
    for (const agent of this.agents) {
      agent.clearHistory();
    }
  }

  public addMessage(msg: AutoGenMessage) {
    this.messages.push(msg);
    for (const agent of this.agents) {
      agent.receive(msg);
    }
  }

  public selectNextSpeaker(currentSpeakerIndex: number, method: 'round_robin' | 'auto_llm' | 'priority_order' = 'round_robin'): ConversableAgent {
    if (method === 'round_robin') {
      const nextIndex = (currentSpeakerIndex + 1) % this.agents.length;
      return this.agents[nextIndex];
    }
    // Default fallback: round robin
    return this.agents[(currentSpeakerIndex + 1) % this.agents.length];
  }
}

export class GroupChatManager {
  private groupChat: GroupChat;
  private config: GroupChatConfig;

  constructor(groupChat: GroupChat, config: Partial<GroupChatConfig> = {}) {
    this.groupChat = groupChat;
    this.config = {
      maxRounds: config.maxRounds || 6,
      speakerSelectionMethod: config.speakerSelectionMethod || 'round_robin',
      adminName: config.adminName || 'GroupManager',
    };
  }

  public async run(topic: string, initialMessage: string, initialSpeakerIndex = 0): Promise<GroupChatTranscript> {
    const startedAt = Date.now();
    this.groupChat.reset();
    let totalTokens = 0;
    let isTerminated = false;
    let terminationReason = '';

    // Mensagem inicial disparada
    const firstMsg: AutoGenMessage = {
      id: `msg-${Date.now()}-0`,
      sender: 'User',
      recipient: 'GroupChat',
      content: initialMessage,
      role: 'user',
      timestamp: Date.now(),
    };

    this.groupChat.addMessage(firstMsg);
    let currentSpeakerIndex = initialSpeakerIndex;

    for (let round = 1; round <= this.config.maxRounds; round++) {
      const speaker = this.groupChat.agents[currentSpeakerIndex];
      const reply = await speaker.generateReply(this.groupChat.messages);

      totalTokens += reply.tokensUsed;

      const replyMsg: AutoGenMessage = {
        id: `msg-${Date.now()}-${round}`,
        sender: speaker.name,
        recipient: 'GroupChat',
        content: reply.content,
        role: 'assistant',
        timestamp: Date.now(),
      };

      this.groupChat.addMessage(replyMsg);

      // Checa condição de término
      if (speaker.checkTermination(replyMsg)) {
        isTerminated = true;
        terminationReason = `Terminado por [${speaker.name}] com sinal de conclusão.`;
        break;
      }

      // Próximo orador
      const nextSpeaker = this.groupChat.selectNextSpeaker(currentSpeakerIndex, this.config.speakerSelectionMethod);
      currentSpeakerIndex = this.groupChat.agents.indexOf(nextSpeaker);
    }

    if (!isTerminated) {
      terminationReason = `Alcançado número máximo de rodadas (${this.config.maxRounds}).`;
    }

    const durationMs = Date.now() - startedAt;
    const lastMsg = this.groupChat.messages[this.groupChat.messages.length - 1]?.content || '';

    return {
      topic,
      messages: [...this.groupChat.messages],
      totalTurns: this.groupChat.messages.length,
      totalTokensUsed: totalTokens,
      estimatedCostUsd: (totalTokens / 1000) * 0.0003,
      durationMs,
      consensusSummary: lastMsg.replace(/TERMINATE/gi, '').trim(),
      isTerminated,
      terminationReason,
    };
  }
}
