// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — MEMORY & REFLECTION
// =============================================================================

import { type MetaMessage } from './message';

export class RoleMemory {
  private messages: MetaMessage[] = [];
  private insights: Array<{ key: string; value: string; learnedAt: number }> = [];

  public addMessage(msg: MetaMessage) {
    this.messages.push(msg);
    // Manter buffer otimizado (últimas 30 mensagens)
    if (this.messages.length > 30) {
      this.messages.shift();
    }
  }

  public getMessages(filterTopic?: string): MetaMessage[] {
    if (!filterTopic) return [...this.messages];
    return this.messages.filter((m) => m.topic === filterTopic);
  }

  public addInsight(key: string, value: string) {
    this.insights.push({ key, value, learnedAt: Date.now() });
  }

  public getInsights(): Array<{ key: string; value: string; learnedAt: number }> {
    return [...this.insights];
  }

  public clear() {
    this.messages = [];
  }
}
