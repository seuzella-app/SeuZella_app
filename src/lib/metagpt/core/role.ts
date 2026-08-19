// =============================================================================
// SEU ZÉLLA METAGPT ENGINE — ROLE BASE CLASS
// =============================================================================

import { MetaAction } from './action';
import { type MetaMessage } from './message';
import { RoleMemory } from './memory';

export interface RoleProfile {
  name: string;
  profile: string;          // Ex: 'Senior Yield Specialist', 'Anti-Hallucination QA'
  goal: string;             // Ex: 'Maximizar receita preservando ocupação'
  constraints: string[];    // Ex: ['Nunca exceder 7% de taxa', 'Nunca prometer check-in antes das 14h sem autorização']
  subscribedTopics?: string[];
}

export abstract class MetaRole {
  public readonly name: string;
  public readonly profile: string;
  public readonly goal: string;
  public readonly constraints: string[];
  public readonly subscribedTopics: string[];
  public readonly memory: RoleMemory;
  protected actions: Map<string, MetaAction> = new Map();

  constructor(config: RoleProfile) {
    this.name = config.name;
    this.profile = config.profile;
    this.goal = config.goal;
    this.constraints = config.constraints || [];
    this.subscribedTopics = config.subscribedTopics || [];
    this.memory = new RoleMemory();
  }

  public registerAction(action: MetaAction) {
    this.actions.set(action.name, action);
  }

  public getAction<T extends MetaAction>(name: string): T | undefined {
    return this.actions.get(name) as T;
  }

  /**
   * Ponto de entrada padrão de processamento de mensagem recebida no ambiente.
   */
  public abstract handleMessage(
    msg: MetaMessage,
    context?: Record<string, unknown>
  ): Promise<MetaMessage | null>;
}
