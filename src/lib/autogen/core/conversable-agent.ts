// =============================================================================
// SEU ZÉLLA AUTOGEN ENGINE — CONVERSABLE AGENT
// =============================================================================

import { type AutoGenMessage, type TerminationCheckFn } from './types';

export interface ConversableAgentConfig {
  name: string;
  systemMessage: string;
  description?: string;
  isTerminationMsg?: TerminationCheckFn;
  maxConsecutiveAutoReply?: number;
}

export class ConversableAgent {
  public readonly name: string;
  public readonly systemMessage: string;
  public readonly description: string;
  private isTerminationMsg?: TerminationCheckFn;
  private messageHistory: AutoGenMessage[] = [];
  protected replyGenerators: Array<(messages: AutoGenMessage[]) => Promise<{ content: string; tokensUsed?: number } | null>> = [];

  constructor(config: ConversableAgentConfig) {
    this.name = config.name;
    this.systemMessage = config.systemMessage;
    this.description = config.description || config.systemMessage.slice(0, 100);
    this.isTerminationMsg = config.isTerminationMsg;
  }

  public registerReply(generator: (messages: AutoGenMessage[]) => Promise<{ content: string; tokensUsed?: number } | null>) {
    this.replyGenerators.unshift(generator);
  }

  public async generateReply(messages: AutoGenMessage[]): Promise<{ content: string; tokensUsed: number }> {
    for (const generator of this.replyGenerators) {
      const res = await generator(messages);
      if (res) {
        return {
          content: res.content,
          tokensUsed: res.tokensUsed || 60,
        };
      }
    }

    // Resposta padrão caso nenhum gerador customizado atenda
    return {
      content: `[${this.name}]: Entendido e de acordo com a proposta anterior.`,
      tokensUsed: 40,
    };
  }

  public async receive(message: AutoGenMessage): Promise<void> {
    this.messageHistory.push(message);
  }

  public checkTermination(latestMessage: AutoGenMessage): boolean {
    if (this.isTerminationMsg) {
      return this.isTerminationMsg(this.messageHistory, latestMessage);
    }
    return latestMessage.content.toUpperCase().includes('TERMINATE');
  }

  public getHistory(): AutoGenMessage[] {
    return [...this.messageHistory];
  }

  public clearHistory() {
    this.messageHistory = [];
  }
}
