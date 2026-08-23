import { describe, it, expect } from 'vitest';
import {
  ConversableAgent,
  GroupChat,
  GroupChatManager,
  runYieldDebate,
  runGuestEmpathyNestedChat,
  runExecutiveWarRoom,
} from '@/lib/autogen';

describe('Microsoft AutoGen Engine — Seu Zélla', () => {
  describe('ConversableAgent & Termination', () => {
    it('deve registrar mensagens e detectar condição de término', async () => {
      const agent = new ConversableAgent({
        name: 'TesterAgent',
        systemMessage: 'Agente de testes unitários',
      });

      agent.registerReply(async () => ({
        content: 'Trabalho finalizado com sucesso. TERMINATE',
        tokensUsed: 50,
      }));

      const reply = await agent.generateReply([]);
      expect(reply.content).toContain('TERMINATE');
      expect(agent.checkTermination({
        id: '1',
        sender: 'TesterAgent',
        content: reply.content,
        timestamp: Date.now(),
      })).toBe(true);
    });
  });

  describe('GroupChat & GroupChatManager', () => {
    it('deve alternar oradores e respeitar o limite máximo de turnos', async () => {
      const agentA = new ConversableAgent({
        name: 'AgentA',
        systemMessage: 'Primeiro orador',
      });
      const agentB = new ConversableAgent({
        name: 'AgentB',
        systemMessage: 'Segundo orador',
      });

      agentA.registerReply(async () => ({ content: 'Ponto A apresentado.', tokensUsed: 30 }));
      agentB.registerReply(async () => ({ content: 'Ponto B contraposto.', tokensUsed: 30 }));

      const groupChat = new GroupChat([agentA, agentB], 3);
      const manager = new GroupChatManager(groupChat, { maxRounds: 3 });

      const transcript = await manager.run('TesteRoundRobin', 'Iniciando teste');
      expect(transcript.totalTurns).toBe(4); // 1 User + 3 turnos
      expect(transcript.totalTokensUsed).toBe(90);
      expect(transcript.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Team 1: Yield Debate War Room (Maximizer vs Defender)', () => {
    it('deve debater e convergir no reajuste ótimo de +R$ 220', async () => {
      const transcript = await runYieldDebate('Carnaval 2027', 500);

      expect(transcript.isTerminated).toBe(true);
      expect(transcript.messages.length).toBeGreaterThanOrEqual(3);
      expect(transcript.consensusSummary).toContain('+R$ 220');
      expect(transcript.consensusSummary).toContain('93%');
    });
  });

  describe('Team 2: Guest Empathy Committee (Nested Chat)', () => {
    it('deve realizar sub-conversa interna e gerar resposta acolhedora', async () => {
      const res = await runGuestEmpathyNestedChat(
        'Gostaria de entrar mais cedo para alimentar meu bebê',
        'Camila Rocha'
      );

      expect(res.finalResponse).toContain('Camila Rocha');
      expect(res.finalResponse).toContain('13h');
      expect(res.transcript.messages.length).toBeGreaterThan(1);
    });
  });

  describe('Team 3: Executive War Room (Board Advisory)', () => {
    it('deve reunir diretoria e formular parecer estratégico unânime', async () => {
      const transcript = await runExecutiveWarRoom(
        'Como aumentar as reservas diretas sem depender de OTAs?'
      );

      expect(transcript.isTerminated).toBe(true);
      expect(transcript.consensusSummary).toContain('NPS');
      expect(transcript.totalTokensUsed).toBeGreaterThan(0);
    });
  });
});
