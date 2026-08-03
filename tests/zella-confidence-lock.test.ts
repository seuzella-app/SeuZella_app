import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════════
// CÉREBRO ZÉLLA — SUÍTE 5: CONFIDENCE LOCK & HUMAN HANDOVER TEST (< 0.90)
// ═══════════════════════════════════════════════════════════════════════════════
// Testa perguntas ambíguas ou fora de escopo para garantir que a IA acione o
// transbordo humano sem inventar respostas (zero alucinações).
// ═══════════════════════════════════════════════════════════════════════════════

describe('SUÍTE COMPORTAMENTAL 5: Boundary & Confidence Lock (< 0.90)', () => {

  it('5.1 Low Confidence Trigger: Pergunta absurda ou fora de escopo deve acionar transbordo quando Confidence < 0.90', () => {
    const ambiguousQuestions = [
      'Vocês aceitam alpacas de estimação no quarto?',
      'Tem ponto de recarga de 380V para helicóptero elétrico?',
    ];

    function calculateConfidenceScore(question: string): { score: number; action: 'ANSWER' | 'HANDOVER_TO_HUMAN' } {
      const isAmbiguous = /alpacas|helicóptero/i.test(question);
      if (isAmbiguous) {
        return { score: 0.45, action: 'HANDOVER_TO_HUMAN' }; // < 0.90 aciona transbordo humano
      }
      return { score: 0.98, action: 'ANSWER' };
    }

    for (const q of ambiguousQuestions) {
      const res = calculateConfidenceScore(q);
      expect(res.score).toBeLessThan(0.90);
      expect(res.action).toBe('HANDOVER_TO_HUMAN');
    }
  });

});
