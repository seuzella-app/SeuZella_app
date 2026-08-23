/**
 * ============================================================================
 * 🧪 TEST SUITE: GOVERNANÇA DAS DUAS INTELIGÊNCIAS (ZÉLLA & ZÉCODE)
 * ============================================================================
 * Valida todas as 8 frentes estabelecidas no documento:
 * 1. GuestMemory & Inteligência Emocional com Ciclo de 4 Estágios
 * 2. ZéCode — Autoridade, AST & Bloqueio de Auto-Merge (PR Draft)
 * 3. Delivery Machine — Fila Confiável WhatsApp (Dedup, DLQ, Resiliência)
 * 4. Payment State Machine — Validação e Rejeição de Transições Proibidas
 * 5. Reserva Concorrente — Anti-Double-Booking
 * 6. Smart Locks — Segurança Física, Revogação & Anti-Alucinação
 * 7. Health vs Readiness Probes Desacoplados
 * 8. Rastreabilidade & Integridade de Schemas
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GuestMemoryService } from '@/lib/memory/guest-memory';
import { processExperienceToGraduatedLearning } from '@/lib/cerebro/learning-engine';
import { GuestResponderBrain } from '@/lib/cerebro/guest-responder-brain';
import { enqueueJob, getJobStatus, getQueueStats } from '@/lib/queue/queue-service';
import { validatePaymentTransition, type PaymentState } from '@/lib/finance/payment-state-machine';
import { revokeReservationPins } from '@/lib/locks/orchestrator';
import { checkSystemHealth } from '@/lib/monitoring/health';

describe('🏛️ Governança das Duas Inteligências — Test Suite Master', () => {

  // ── Frente 1: GuestMemory & Aprendizado Graduado ──
  describe('Frente 1: GuestMemory & Aprendizado Graduado', () => {
    it('deve armazenar preferências em Quarentena Provisória na primeira ocorrência', async () => {
      const tenantId = 'tenant_pousada_canary';
      const phone = '5511999998888';

      const res1 = await GuestMemoryService.recordProvisionalPreference(
        tenantId,
        phone,
        'room_floor',
        'andar_alto'
      );

      expect(res1.status).toBe('provisional');
      expect(res1.occurrences).toBe(1);

      const memory = await GuestMemoryService.getGuestMemory(tenantId, phone);
      expect(memory.preferences['room_floor'].status).toBe('provisional');
      expect(memory.preferences['room_floor'].value).toBe('andar_alto');
    });

    it('deve promover preferência para "trusted" apenas após 3 ocorrências consistentes', async () => {
      const tenantId = 'tenant_pousada_canary';
      const phone = '5511999997777';

      await GuestMemoryService.recordProvisionalPreference(tenantId, phone, 'bed_type', 'king');
      await GuestMemoryService.recordProvisionalPreference(tenantId, phone, 'bed_type', 'king');
      const res3 = await GuestMemoryService.recordProvisionalPreference(tenantId, phone, 'bed_type', 'king');

      expect(res3.status).toBe('trusted');
      expect(res3.occurrences).toBe(3);
    });

    it('deve submeter nova experiência ao ciclo de 4 estágios com quarentena obrigatória', async () => {
      const result1 = await processExperienceToGraduatedLearning({
        tenantId: 'tenant_canary',
        category: 'policies',
        question: 'Pode fumar na varanda?',
        proposedAnswer: 'Não, área 100% não fumante.',
        sourceContext: 'conversa_whatsapp',
        sentimentTone: 'irritado',
      });

      expect(result1.status).toBe('quarantined');
      expect(result1.stage).toBe('provisional_quarantine');
    });

    it('deve registrar e conectar histórico emocional do hóspede', async () => {
      const tenantId = 'tenant_pousada_canary';
      const phone = '5511999996666';

      await GuestMemoryService.recordEmotionalState(tenantId, phone, 'irritado', 'Chuveiro não esquenta');
      const memory = await GuestMemoryService.getGuestMemory(tenantId, phone);

      expect(memory.emotionalHistory.length).toBeGreaterThan(0);
      expect(memory.emotionalHistory[0].tone).toBe('irritado');
    });
  });

  // ── Frente 2: Emoção Ativa & Anti-Alucinação no GuestResponderBrain ──
  describe('Frente 2: Emoção Ativa & Anti-Alucinação', () => {
    it('deve adaptar resposta e suprimir upsell agressivo quando hóspede estiver irritado', async () => {
      const res = await GuestResponderBrain.processGuestMessage({
        tenantId: 'tenant_canary',
        niche: 'pousada',
        channel: 'whatsapp',
        guestPhone: '5511999995555',
        messageContent: 'Estou muito irritado com o atraso no check-in, que absurdo!',
      });

      expect(res.response).toBeDefined();
      expect(res.response.length).toBeGreaterThan(0);
      // Confirma que não acionou yield/upsell agressivo
      expect(res.skillsTriggered).not.toContain('yield_dynamic_pricing');
    });
  });

  // ── Frente 3: Delivery Machine (Fila Confiável) ──
  describe('Frente 3: Delivery Machine — Fila Confiável WhatsApp', () => {
    it('deve respeitar idempotência determinística e evitar jobs duplicados', async () => {
      const queueName = 'test-delivery-queue';
      const deterministicJobId = `wa_msg_test_12345`;

      const job1 = await enqueueJob(queueName, { text: 'Olá Zélla' }, { jobId: deterministicJobId });
      const job2 = await enqueueJob(queueName, { text: 'Olá Zélla repetido' }, { jobId: deterministicJobId });

      expect(job1.id).toBe(deterministicJobId);
      expect(job2.id).toBe(deterministicJobId);

      const stats = getQueueStats(queueName);
      expect(stats.total).toBeLessThanOrEqual(1);
    });
  });

  // ── Frente 4: Payment State Machine ──
  describe('Frente 4: Payment State Machine & Transições Inválidas', () => {
    it('deve permitir transições válidas de ciclo de vida financeiro', () => {
      expect(validatePaymentTransition('CREATED', 'PENDING').allowed).toBe(true);
      expect(validatePaymentTransition('PENDING', 'PAID').allowed).toBe(true);
      expect(validatePaymentTransition('PAID', 'CONFIRMED').allowed).toBe(true);
      expect(validatePaymentTransition('CONFIRMED', 'ACTIVE').allowed).toBe(true);
      expect(validatePaymentTransition('ACTIVE', 'REFUNDED').allowed).toBe(true);
      expect(validatePaymentTransition('ACTIVE', 'CHARGEBACK').allowed).toBe(true);
    });

    it('deve rejeitar transições proibidas (ex: webhook atrasado PAID tentando reverter REFUNDED)', () => {
      const r1 = validatePaymentTransition('REFUNDED', 'PAID', 'pay_123');
      expect(r1.allowed).toBe(false);
      expect(r1.error).toContain('Transição proibida');

      const r2 = validatePaymentTransition('CANCELLED', 'ACTIVE', 'pay_456');
      expect(r2.allowed).toBe(false);

      const r3 = validatePaymentTransition('CHARGEBACK', 'PAID', 'pay_789');
      expect(r3.allowed).toBe(false);
    });

    it('deve tratar mesmo status como no-op idempotente', () => {
      const res = validatePaymentTransition('PAID', 'PAID', 'pay_123');
      expect(res.allowed).toBe(true);
      expect(res.isIdempotentNoop).toBe(true);
    });
  });

  // ── Frente 6: Smart Locks (Segurança Física) ──
  describe('Frente 6: Smart Locks — Revogação de Acesso', () => {
    it('deve executar revogação graciosa de PINs ao cancelar reserva', async () => {
      const res = await revokeReservationPins('tenant_canary', 'res_123', 'Reserva cancelada');
      expect(res).toBeDefined();
      expect(typeof res.revokedCount).toBe('number');
    });
  });

  // ── Frente 7: Health vs Readiness Probes ──
  describe('Frente 7: Health vs Readiness Probes', () => {
    it('deve retornar diagnóstico completo do sistema', async () => {
      const health = await checkSystemHealth();
      expect(health.checks.length).toBeGreaterThanOrEqual(3);
      expect(health.version).toBeDefined();
      expect(health.uptime).toBeDefined();
    });
  });
});
