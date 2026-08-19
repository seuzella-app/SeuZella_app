import { describe, it, expect } from 'vitest';
import {
  BudgetGuard,
  RoleMemory,
  MetaEnvironment,
  runYieldWarRoom,
  runGuestConcierge,
  runHITLArbitration,
  runLockGuardian,
  runExperienceDistiller,
} from '@/lib/metagpt';

describe('MetaGPT Multi-Agent Engine — Seu Zélla', () => {
  describe('BudgetGuard & Memory', () => {
    it('deve registrar tokens e respeitar o teto de orçamento', () => {
      const guard = new BudgetGuard({ maxTokensPerSOP: 1000 });
      guard.recordUsage(250);
      expect(guard.getTokensUsed()).toBe(250);
      expect(guard.estimateCostUsd()).toBeGreaterThan(0);

      expect(() => {
        guard.recordUsage(800);
      }).toThrowError(/Limite de tokens excedido/);
    });

    it('deve armazenar mensagens e insights no RoleMemory', () => {
      const memory = new RoleMemory();
      memory.addMessage({
        id: 'msg-1',
        sender: 'TestAgent',
        topic: 'test.topic',
        content: 'Hello World',
        timestamp: Date.now(),
      });
      memory.addInsight('preference', 'Quarto 101 prefere cama king');

      expect(memory.getMessages()).toHaveLength(1);
      expect(memory.getInsights()).toHaveLength(1);
      expect(memory.getInsights()[0].key).toBe('preference');
    });
  });

  describe('SOP 1: War-Room de Yield & UPSELL 7%', () => {
    it('deve calcular o reajuste de feriado e validar a partilha 93% / 7%', async () => {
      const res = await runYieldWarRoom({
        holidayName: 'Réveillon 2026/2027',
        nights: 4,
        totalRooms: 6,
        baseDailyPrice: 450,
        customIncrease: 200,
        occupancyRate: 0.9,
      });

      expect(res.success).toBe(true);
      expect(res.log.status).toBe('COMPLETED');
      expect(res.log.steps).toHaveLength(3);

      const yieldData = res.result;
      expect(yieldData.isCompliant).toBe(true);
      expect(yieldData.feePercentage).toBe(7);
    });
  });

  describe('SOP 2: Delirium Zero Concierge (WhatsApp 24h)', () => {
    it('deve classificar a intenção e formular resposta de Wi-Fi sem alucinação', async () => {
      const res = await runGuestConcierge({
        messageText: 'Boa tarde, qual a senha do Wi-Fi?',
        guestName: 'Lucas',
        propertyName: 'Pousada Solar das Marés',
        wifiPassword: 'marés_vip2026',
      });

      expect(res.success).toBe(true);
      expect(res.result.isSafe).toBe(true);
      expect(res.result.finalMessage).toContain('marés_vip2026');
      expect(res.result.finalMessage).toContain('Lucas');
      expect(res.result.deliriumZeroScore).toBe(100);
    });
  });

  describe('SOP 3: HITL Arbitration & Legal Compliance', () => {
    it('deve gerar link do WhatsApp e atestar conformidade com os Termos de Uso', async () => {
      const res = await runHITLArbitration({
        guestName: 'Carlos Andrade',
        guestPhone: '21971103344',
        propertyName: 'Pousada Solar das Marés',
        reason: 'USER_CLICK_ASSUMIR',
      });

      expect(res.success).toBe(true);
      expect(res.result.termsCompliant).toBe(true);
      expect(res.result.legalNotice).toContain('Termos de Uso');
    });
  });

  describe('SOP 4: Lock Guardian & Governança', () => {
    it('deve gerar PIN CSPRNG seguro e disparar faxina no checkout', async () => {
      const res = await runLockGuardian({
        roomName: 'Suíte Master 101',
        guestName: 'Maria Silva',
        batteryLevel: 92,
        isCheckOut: true,
      });

      expect(res.success).toBe(true);
      expect(res.result.pinRevoked).toBe(true);
      expect(res.result.cleanersNotified).toBe(true);
      expect(res.result.roomStatus).toBe('manutencao');
    });
  });

  describe('SOP 5: Experience & Learning Distillation', () => {
    it('deve categorizar promotor e extrair regra de aprendizado', async () => {
      const res = await runExperienceDistiller({
        guestName: 'Fernanda Lima',
        roomName: 'Suíte Luxo 103',
        npsScore: 10,
        feedbackText: 'Tudo excelente na nossa estadia!',
      });

      expect(res.success).toBe(true);
      expect(res.result.confidence).toBe(0.95);
      expect(res.result.targetTopic).toBe('housekeeping.preferences');
    });
  });
});
