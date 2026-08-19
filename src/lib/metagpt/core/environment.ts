// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — ENVIRONMENT & PUB/SUB BUS
// =============================================================================

import { MetaRole } from './role';
import { type MetaMessage } from './message';

export class MetaEnvironment {
  private roles: Map<string, MetaRole> = new Map();
  private messageHistory: MetaMessage[] = [];

  public addRole(role: MetaRole) {
    this.roles.set(role.name, role);
  }

  public getRole(name: string): MetaRole | undefined {
    return this.roles.get(name);
  }

  public getAllRoles(): MetaRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * Publica uma mensagem no ambiente e aciona todos os Roles inscritos no tópico.
   */
  public async publish(message: MetaMessage, context: Record<string, unknown> = {}): Promise<MetaMessage[]> {
    this.messageHistory.push(message);
    const responses: MetaMessage[] = [];

    for (const role of this.roles.values()) {
      const isSubscribed =
        role.subscribedTopics.length === 0 ||
        role.subscribedTopics.includes(message.topic) ||
        role.subscribedTopics.includes('*');

      const isTargeted =
        !message.recipient ||
        message.recipient === 'All' ||
        message.recipient === 'Environment' ||
        message.recipient === role.name;

      if (isSubscribed && isTargeted && role.name !== message.sender) {
        try {
          const res = await role.handleMessage(message, context);
          if (res) {
            responses.push(res);
            this.messageHistory.push(res);
          }
        } catch (err) {
          console.error(`[MetaEnvironment] Erro no Role ${role.name}:`, err);
        }
      }
    }

    return responses;
  }

  public getHistory(): MetaMessage[] {
    return [...this.messageHistory];
  }

  public clear() {
    this.messageHistory = [];
  }
}
