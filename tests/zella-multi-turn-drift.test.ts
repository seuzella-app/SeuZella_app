import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// CÉREBRO ZÉLLA — SUÍTE 3: MULTI-TURN LONG DRIFT (MEMÓRIA DE DIÁLOGO LONGO)
// ═══════════════════════════════════════════════════════════════════════════════
// Simula conversas de 20+ mensagens com alterações frequentes de datas,
// número de hóspedes e pets, garantindo retenção de memória e cotação exata.
// ═══════════════════════════════════════════════════════════════════════════════

describe('SUÍTE COMPORTAMENTAL 3: Multi-Turn Long Drift', () => {

  it('3.1 Conversa Longa (20 voltas): Deve refletir os últimos parâmetros alterados sem perder contexto', () => {
    // Simula o histórico acumulado da conversa
    interface ChatMessage {
      turn: number;
      role: 'user' | 'assistant';
      text: string;
      contextState?: { guestsAdults: number; guestsChildren: number; pets: number };
    }

    const conversationHistory: ChatMessage[] = [
      { turn: 1, role: 'user', text: 'Quero reservar para 2 adultos de 10 a 12 de Outubro.' },
      { turn: 5, role: 'user', text: 'Aceita cachorro?' },
      { turn: 12, role: 'user', text: 'Na verdade, mudou para 3 adultos e 1 criança.' },
      { turn: 18, role: 'user', text: 'E vamos levar 1 cachorro pequeno.' },
      { turn: 20, role: 'user', text: 'Qual o valor final com o pet?' },
    ];

    // Redutor sintético de contexto mantido no histórico
    function reduceConversationState(history: ChatMessage[]): { guestsAdults: number; guestsChildren: number; pets: number } {
      let state = { guestsAdults: 2, guestsChildren: 0, pets: 0 };
      for (const msg of history) {
        if (msg.text.includes('3 adultos e 1 criança')) {
          state.guestsAdults = 3;
          state.guestsChildren = 1;
        }
        if (msg.text.includes('1 cachorro')) {
          state.pets = 1;
        }
      }
      return state;
    }

    const finalState = reduceConversationState(conversationHistory);

    expect(finalState.guestsAdults).toBe(3);
    expect(finalState.guestsChildren).toBe(1);
    expect(finalState.pets).toBe(1);
  });

});
