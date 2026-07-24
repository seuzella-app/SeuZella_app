// ============================================================================
// Z-LAB — Simulator Service (Orquestração de Testes E2E)
// ============================================================================
// Motor principal que orquestra:
//  1. Criação de Tenant de teste (direto no DB com isTestTenant=true)
//  2. Simulação de checkout (chama /api/checkout/create com mockMode)
//  3. Injeção de webhook de pagamento aprovado (chama /api/checkout/webhook)
//  4. Envio de mensagens sintéticas via webhook WhatsApp (chama /api/webhooks/whatsapp)
//  5. Coleta de métricas (latência, custo MetaCostLog, intenção detectada)
//  6. Cleanup completo do tenant de teste
//
// DESIGN:
//  - Todas as chamadas são via fetch HTTP interno (não invoca funções diretamente)
//    para testar o caminho real (HMAC, rate limit, NicheContext, etc.)
//  - Tenant marcado com isTestTenant=true para identificação segura
//  - Cleanup remove TODOS os dados relacionados (cascade via Prisma)
// ============================================================================

import { db } from '@/lib/db';
import { logSink } from '@/lib/cerebro/log-sink';
import {
  type SyntheticPersona,
  type PersonaId,
  type GuestNiche,
  PERSONAS,
  getPersonaById,
  generateMetaWebhookPayload,
  generateWebhookSignature,
  generateTestTenantName,
  generateTestTenantEmail,
  generateTestWhatsAppNumber,
} from './synthetic-guests';

// ── Types ────────────────────────────────────────────────────────────────────

export type SimulationPlan = 'lite' | 'pro' | 'max' | 'parceiro' | 'gratuito';

export interface SimulationConfig {
  niche: GuestNiche;
  plan: SimulationPlan;
  personaId: PersonaId;
  /** Base URL do app (default: http://localhost:3000 para CLI, / para server-side) */
  baseUrl?: string;
  /** Delay entre mensagens em ms (default: 1000 para simular digitação humana) */
  messageDelayMs?: number;
  /** Pular checkout simulation (pular direto para mensagens) */
  skipCheckout?: boolean;
}

export interface SimulationStepResult {
  step: string;
  success: boolean;
  durationMs: number;
  data?: Record<string, unknown>;
  error?: string;
}

export interface MessageSimulationResult {
  personaId: PersonaId;
  personaName: string;
  messageIndex: number;
  messageContent: string;
  webhookStatus: number;
  webhookResponse: string;
  durationMs: number;
  /** ID da conversa criada/encontrada (se disponível) */
  conversationId?: string;
}

export interface SimulationReport {
  config: SimulationConfig;
  tenantId: string;
  tenantName: string;
  whatsappNumber: string;
  steps: SimulationStepResult[];
  messageResults: MessageSimulationResult[];
  metrics: {
    totalDurationMs: number;
    messagesSent: number;
    messagesSucceeded: number;
    messagesFailed: number;
    totalMetaCostUsd: number;
    avgResponseMs: number;
  };
  cleanupResult: { success: boolean; deleted: number; error?: string };
  passed: boolean;
  timestamp: string;
}

// ── Simulator Class ─────────────────────────────────────────────────────────

export class ZLabSimulator {
  private readonly config: SimulationConfig;
  private readonly baseUrl: string;
  private readonly steps: SimulationStepResult[] = [];
  private readonly messageResults: MessageSimulationResult[] = [];
  private tenantId: string | null = null;
  private whatsappNumber: string = '';
  private tenantName: string = '';

  constructor(config: SimulationConfig) {
    this.config = config;
    // Se baseUrl não fornecido, assume server-side (relative path)
    this.baseUrl = config.baseUrl || (typeof window !== 'undefined' ? '' : 'http://localhost:3000');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN: runFullSimulation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Executa simulação completa E2E:
   *  1. Cria tenant de teste
   *  2. (Opcional) Simula checkout + payment webhook
   *  3. Envia mensagens sintéticas via webhook WhatsApp
   *  4. Coleta métricas
   *  5. Cleanup
   */
  async runFullSimulation(): Promise<SimulationReport> {
    const startTime = Date.now();

    // ── Step 1: Create test tenant ──
    await this.step('create_test_tenant', () => this.createTestTenant());

    if (!this.tenantId) {
      return this.buildReport(startTime, false);
    }

    // ── Step 2: Simulate checkout (opcional) ──
    if (!this.config.skipCheckout) {
      await this.step('simulate_checkout', () => this.simulateCheckout());
      await this.step('simulate_payment_webhook', () => this.simulatePaymentWebhook());
    }

    // ── Step 3: Set up WhatsApp number for tenant ──
    await this.step('setup_whatsapp_number', () => this.setupWhatsAppNumber());

    // ── Step 4: Send synthetic guest messages ──
    const persona = getPersonaById(this.config.personaId);
    if (!persona) {
      this.steps.push({
        step: 'send_messages',
        success: false,
        durationMs: 0,
        error: `Persona ${this.config.personaId} não encontrada`,
      });
    } else {
      await this.step('send_messages', () => this.sendSyntheticMessages(persona));
    }

    // ── Step 5: Collect metrics ──
    await this.step('collect_metrics', () => this.collectMetrics());

    // ── Step 6: Cleanup ──
    const cleanupResult = await this.cleanupTestTenant();

    const passed = this.messageResults.every(r => r.webhookStatus === 200);

    return this.buildReport(startTime, passed, cleanupResult);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Create Test Tenant
  // ═══════════════════════════════════════════════════════════════════════

  private async createTestTenant(): Promise<Record<string, unknown>> {
    this.tenantName = generateTestTenantName(this.config.niche, this.config.plan);
    const email = generateTestTenantEmail(this.config.niche);

    const tenant = await db.tenant.create({
      data: {
        name: this.tenantName,
        email,
        plan: this.config.plan,
        status: 'active',
        niche: this.config.niche,
        isTestTenant: true, // ← Flag de segurança para cleanup
        subscriptionAt: new Date(),
        whatsappPhoneNumber: generateTestWhatsAppNumber(),
      },
    });

    this.tenantId = tenant.id;
    this.whatsappNumber = tenant.whatsappPhoneNumber || '';

    // Create Property (necessário para AI responder com contexto)
    await db.property.create({
      data: {
        tenantId: tenant.id,
        name: `Propriedade Teste ${this.tenantName}`,
        type: this.config.niche === 'pousada' ? 'pousada' : 'apartamento',
        city: 'São Paulo',
        state: 'SP',
        description: 'Propriedade de teste criada pelo Z-Lab para simulação.',
        slug: `zlab-test-${tenant.id.substring(0, 8)}`,
        pixKey: 'teste@zella.com',
        pixKeyType: 'email',
      },
    });

    // Create Subscription ativa
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        status: 'active',
        planType: this.config.plan,
        paymentMethod: 'pix',
        amount: 0,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
      },
    });

    logSink.info({
      module: 'zlab-simulator',
      event: 'test_tenant_created',
      message: `Tenant de teste criado: ${this.tenantName} (${this.tenantId})`,
      context: { tenantId: this.tenantId, niche: this.config.niche, plan: this.config.plan },
    });

    return { tenantId: this.tenantId, tenantName: this.tenantName, whatsappNumber: this.whatsappNumber };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Simulate Checkout
  // ═══════════════════════════════════════════════════════════════════════

  private async simulateCheckout(): Promise<Record<string, unknown>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: this.tenantId,
          plan: this.config.plan,
          niche: this.config.niche,
          mockMode: true, // Flag para não abrir gateway real
        }),
      });

      const data = await res.json().catch(() => ({}));

      return {
        status: res.status,
        checkoutUrl: data.checkoutUrl || null,
        mockMode: data.mockMode || true,
      };
    } catch (err) {
      // Checkout route pode não suportar mockMode — não é crítico
      return { skipped: true, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Simulate Payment Webhook
  // ═══════════════════════════════════════════════════════════════════════

  private async simulatePaymentWebhook(): Promise<Record<string, unknown>> {
    try {
      // Payload simulado do Mercado Pago (webhook de pagamento aprovado)
      const mpPayload = {
        action: 'payment.updated',
        data: { id: `zlab-mock-payment-${Date.now()}` },
        type: 'payment',
        // Dados simulados que o webhook handler espera
        mockApproved: true,
        tenantId: this.tenantId,
        plan: this.config.plan,
      };

      const res = await fetch(`${this.baseUrl}/api/checkout/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mpPayload),
      });

      return {
        status: res.status,
        response: await res.text().catch(() => ''),
      };
    } catch (err) {
      return { skipped: true, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Setup WhatsApp Number
  // ═══════════════════════════════════════════════════════════════════════

  private async setupWhatsAppNumber(): Promise<Record<string, unknown>> {
    // WhatsApp number já foi setado em createTestTenant
    // Aqui apenas confirmamos que está no formato esperado pelo webhook
    if (!this.whatsappNumber) {
      this.whatsappNumber = generateTestWhatsAppNumber();
      await db.tenant.update({
        where: { id: this.tenantId! },
        data: { whatsappPhoneNumber: this.whatsappNumber },
      });
    }

    return {
      whatsappNumber: this.whatsappNumber,
      normalized: this.whatsappNumber.replace(/\D/g, ''),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Send Synthetic Messages
  // ═══════════════════════════════════════════════════════════════════════

  private async sendSyntheticMessages(persona: SyntheticPersona): Promise<Record<string, unknown>> {
    const delay = this.config.messageDelayMs ?? 1000;
    const destinationNumber = this.whatsappNumber.replace(/\D/g, '');

    for (let i = 0; i < persona.messages.length; i++) {
      const startTime = Date.now();

      const payload = generateMetaWebhookPayload(
        persona,
        i,
        destinationNumber
      );

      const payloadStr = JSON.stringify(payload);
      const signature = generateWebhookSignature(payloadStr);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (signature) {
        headers['X-Hub-Signature-256'] = signature;
      }

      try {
        const res = await fetch(`${this.baseUrl}/api/webhooks/whatsapp`, {
          method: 'POST',
          headers,
          body: payloadStr,
        });

        const responseText = await res.text().catch(() => '');

        this.messageResults.push({
          personaId: persona.id,
          personaName: persona.name,
          messageIndex: i,
          messageContent: persona.messages[i],
          webhookStatus: res.status,
          webhookResponse: responseText.substring(0, 500),
          durationMs: Date.now() - startTime,
        });

        logSink.info({
          module: 'zlab-simulator',
          event: 'synthetic_message_sent',
          message: `[${persona.name}] Msg ${i + 1}/${persona.messages.length}: "${persona.messages[i].substring(0, 50)}..." → ${res.status} (${Date.now() - startTime}ms)`,
          context: {
            personaId: persona.id,
            messageIndex: i,
            status: res.status,
            durationMs: Date.now() - startTime,
          },
        });
      } catch (err) {
        this.messageResults.push({
          personaId: persona.id,
          personaName: persona.name,
          messageIndex: i,
          messageContent: persona.messages[i],
          webhookStatus: 0,
          webhookResponse: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - startTime,
        });
      }

      // Delay entre mensagens (simula digitação humana)
      if (i < persona.messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      totalSent: this.messageResults.length,
      succeeded: this.messageResults.filter(r => r.webhookStatus === 200).length,
      failed: this.messageResults.filter(r => r.webhookStatus !== 200).length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Collect Metrics
  // ═══════════════════════════════════════════════════════════════════════

  private async collectMetrics(): Promise<Record<string, unknown>> {
    if (!this.tenantId) return { error: 'No tenantId' };

    // Busca custo Meta total do tenant de teste
    const costAggregate = await db.metaCostLog.aggregate({
      _sum: { costUsd: true },
      _count: true,
      where: { tenantId: this.tenantId },
    });

    // Busca conversas criadas
    const conversations = await db.conversationLog.findMany({
      where: { tenantId: this.tenantId },
      select: { id: true, aiConfidence: true, status: true, createdAt: true },
    });

    // Busca mensagens trocadas
    const messages = await db.conversationMessage.count({
      where: { conversation: { tenantId: this.tenantId } },
    });

    return {
      metaCostUsd: costAggregate._sum.costUsd ?? 0,
      metaCostCount: costAggregate._count,
      conversationsCreated: conversations.length,
      messagesExchanged: messages,
      avgConfidence: conversations.length > 0
        ? conversations.reduce((sum, c) => sum + (c.aiConfidence || 0), 0) / conversations.length
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════

  private async cleanupTestTenant(): Promise<{ success: boolean; deleted: number; error?: string }> {
    if (!this.tenantId) {
      return { success: false, deleted: 0, error: 'No tenantId to cleanup' };
    }

    try {
      // Cascade delete via Prisma (Tenant onDelete: Cascade remove tudo relacionado)
      await db.tenant.delete({
        where: { id: this.tenantId },
      });

      logSink.info({
        module: 'zlab-simulator',
        event: 'test_tenant_cleaned',
        message: `Tenant de teste removido: ${this.tenantName} (${this.tenantId})`,
        context: { tenantId: this.tenantId, tenantName: this.tenantName },
      });

      return { success: true, deleted: 1 };
    } catch (err) {
      // Se já foi deletado ou não existe, considera sucesso
      if (String(err).includes('Record to delete does not exist')) {
        return { success: true, deleted: 0 };
      }

      logSink.error({
        module: 'zlab-simulator',
        event: 'cleanup_failed',
        message: `Falha ao remover tenant de teste ${this.tenantId}`,
        error: err,
      });

      return {
        success: false,
        deleted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async step(name: string, fn: () => Promise<Record<string, unknown>>): Promise<void> {
    const startTime = Date.now();
    try {
      const data = await fn();
      this.steps.push({
        step: name,
        success: true,
        durationMs: Date.now() - startTime,
        data,
      });
    } catch (err) {
      this.steps.push({
        step: name,
        success: false,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private buildReport(startTime: number, passed: boolean, cleanupResult?: { success: boolean; deleted: number; error?: string }): SimulationReport {
    const totalDurationMs = Date.now() - startTime;
    const succeeded = this.messageResults.filter(r => r.webhookStatus === 200).length;
    const failed = this.messageResults.filter(r => r.webhookStatus !== 200).length;

    const metricsStep = this.steps.find(s => s.step === 'collect_metrics');
    const metrics = metricsStep?.data as { metaCostUsd?: number; metaCostCount?: number } | undefined;

    return {
      config: this.config,
      tenantId: this.tenantId || 'unknown',
      tenantName: this.tenantName,
      whatsappNumber: this.whatsappNumber,
      steps: this.steps,
      messageResults: this.messageResults,
      metrics: {
        totalDurationMs,
        messagesSent: this.messageResults.length,
        messagesSucceeded: succeeded,
        messagesFailed: failed,
        totalMetaCostUsd: metrics?.metaCostUsd ?? 0,
        avgResponseMs: this.messageResults.length > 0
          ? Math.round(this.messageResults.reduce((sum, r) => sum + r.durationMs, 0) / this.messageResults.length)
          : 0,
      },
      cleanupResult: cleanupResult || { success: false, deleted: 0, error: 'Cleanup not run' },
      passed: passed && (cleanupResult?.success ?? false),
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Convenience Functions ───────────────────────────────────────────────────

/**
 * Executa simulação completa para uma persona específica.
 */
export async function runSimulation(config: SimulationConfig): Promise<SimulationReport> {
  const simulator = new ZLabSimulator(config);
  return simulator.runFullSimulation();
}

/**
 * Executa bateria completa de testes com todas as personas.
 * Retorna relatório agregado.
 */
export async function runFullBattery(baseUrl?: string): Promise<{
  reports: SimulationReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalDurationMs: number;
    totalMetaCostUsd: number;
  };
}> {
  const reports: SimulationReport[] = [];

  for (const persona of PERSONAS) {
    const config: SimulationConfig = {
      niche: persona.niche,
      plan: 'pro',
      personaId: persona.id,
      baseUrl,
      messageDelayMs: 500, // faster for battery
      skipCheckout: true, // skip checkout for speed
    };

    const report = await runSimulation(config);
    reports.push(report);
  }

  const summary = {
    total: reports.length,
    passed: reports.filter(r => r.passed).length,
    failed: reports.filter(r => !r.passed).length,
    totalDurationMs: reports.reduce((sum, r) => sum + r.metrics.totalDurationMs, 0),
    totalMetaCostUsd: reports.reduce((sum, r) => sum + r.metrics.totalMetaCostUsd, 0),
  };

  return { reports, summary };
}

/**
 * Limpa TODOS os tenants de teste do DB (cleanup global).
 * Útil para remover dados de testes antigos.
 */
export async function cleanupAllTestTenants(): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  const testTenants = await db.tenant.findMany({
    where: { isTestTenant: true },
    select: { id: true, name: true },
  });

  for (const tenant of testTenants) {
    try {
      await db.tenant.delete({ where: { id: tenant.id } });
      deleted++;
    } catch (err) {
      errors.push(`${tenant.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { deleted, errors };
}

/**
 * Lista tenants de teste existentes (para o painel ZCC).
 */
export async function listTestTenants(): Promise<Array<{
  id: string;
  name: string;
  niche: string;
  plan: string;
  whatsappPhoneNumber: string | null;
  createdAt: Date;
}>> {
  return db.tenant.findMany({
    where: { isTestTenant: true },
    select: {
      id: true,
      name: true,
      niche: true,
      plan: true,
      whatsappPhoneNumber: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Popula o banco de dados de produção/sandbox em LOTE (Batch Transaction)
 * com 10 tenants (5 Pousadas + 5 Airbnbs), fotos Unsplash HD, conversas,
 * reservas, MetaCostLogs e anomalias do Cérebro Zélla.
 */
export async function populateSandboxData(): Promise<{
  success: boolean;
  summary: {
    totalTenants: number;
    totalConversations: number;
    totalMessages: number;
    totalReservations: number;
    totalCostLogs: number;
    totalDurationMs: number;
  };
}> {
  const startTime = Date.now();

  // Step 1: Cleanup preventivo
  await cleanupAllTestTenants();

  // Tenats com imagens HD Unsplash
  const mockTenantsData = [
    {
      name: 'Pousada do Sol — Paraty',
      niche: 'pousada',
      plan: 'pro',
      coverUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
      phone: '+5524998811223',
    },
    {
      name: 'Villa Baiana — Búzios',
      niche: 'pousada',
      plan: 'max',
      coverUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
      phone: '+5522998822334',
    },
    {
      name: 'Chodó das Serras — Campos do Jordão',
      niche: 'pousada',
      plan: 'pro',
      coverUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80',
      phone: '+5512998833445',
    },
    {
      name: 'Refúgio das Toninhas — Ubatuba',
      niche: 'pousada',
      plan: 'lite',
      coverUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
      phone: '+5512998844556',
    },
    {
      name: 'Casarão Colonial — Tiradentes',
      niche: 'pousada',
      plan: 'parceiro',
      coverUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
      phone: '+5532998855667',
    },
    {
      name: 'Studio Vista Mar — Copacabana',
      niche: 'airbnb',
      plan: 'pro',
      coverUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      phone: '+5521998866778',
    },
    {
      name: 'Loft Design — Av. Paulista',
      niche: 'airbnb',
      plan: 'max',
      coverUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80',
      phone: '+5511998877889',
    },
    {
      name: 'Casa Pé na Areia — Camburi',
      niche: 'airbnb',
      plan: 'pro',
      coverUrl: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80',
      phone: '+5512998888990',
    },
    {
      name: 'Flat Executive — Batel',
      niche: 'airbnb',
      plan: 'lite',
      coverUrl: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      phone: '+5541998899001',
    },
    {
      name: 'Villa Pelourinho — Salvador',
      niche: 'airbnb',
      plan: 'parceiro',
      coverUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      phone: '+5571998800112',
    },
  ];

  let totalConversations = 0;
  let totalMessages = 0;
  let totalReservations = 0;
  let totalCostLogs = 0;

  for (const item of mockTenantsData) {
    const tenant = await db.tenant.create({
      data: {
        name: item.name,
        niche: item.niche,
        plan: item.plan,
        isTestTenant: true,
        whatsappPhoneNumber: item.phone,
        status: 'active',
      },
    });

    // Criar propriedades vinculadas
    // Criar propriedade vinculada
    const slugName = item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    await db.property.create({
      data: {
        tenantId: tenant.id,
        name: item.name,
        description: `Propriedade em destaque — ${item.name}`,
        city: item.name.split('—')[1]?.trim() || 'Brasil',
        type: item.niche === 'pousada' ? 'pousada' : 'apartamento',
        slug: `${slugName}-${tenant.id.slice(-5)}`,
      },
    });

    // Criar 3 reservas (Booking) por tenant
    for (let r = 1; r <= 3; r++) {
      await db.booking.create({
        data: {
          tenantId: tenant.id,
          guestName: `Hóspede Exemplo ${r} - ${item.name}`,
          roomName: `Suíte Luxo ${r}`,
          checkIn: new Date(Date.now() + r * 86400000),
          checkOut: new Date(Date.now() + (r + 2) * 86400000),
          nights: 2,
          guests: 2,
          totalValue: 900 + r * 300,
          status: r === 1 ? 'confirmed' : r === 2 ? 'checked_in' : 'pending',
          source: 'whatsapp_ai',
        },
      });
      totalReservations++;
    }

    // Criar 4 conversas por tenant
    for (let c = 1; c <= 4; c++) {
      const guestPhone = `+55119777${c}${Math.floor(1000 + Math.random() * 9000)}`;
      const guestName = `Cliente Interessado ${c}`;

      // Criar Guest primeiro para integridade referencial
      const guest = await db.guest.create({
        data: {
          tenantId: tenant.id,
          name: guestName,
          phone: guestPhone,
          bsuid: `bsuid_mock_${tenant.id}_${c}_${Date.now()}`,
        },
      });

      const conv = await db.conversationLog.create({
        data: {
          tenantId: tenant.id,
          guestId: guest.id,
          guestPhone,
          guestName,
          status: 'active',
          aiConfidence: 0.94 + Math.random() * 0.05,
        },
      });
      totalConversations++;

      // Criar 8 mensagens por conversa
      for (let m = 1; m <= 8; m++) {
        await db.conversationMessage.create({
          data: {
            conversationId: conv.id,
            from: m % 2 === 1 ? 'guest' : 'ai',
            content: m % 2 === 1
              ? `Qual o valor da diária para o próximo fim de semana na ${item.name}?`
              : `Olá! O valor da diária para a ${item.name} é R$ 450, com café da manhã incluso e check-in às 14h. Posso reservar para você?`,
          },
        });
        totalMessages++;
      }

      // CostLogs para o CFO Virtual
      for (let k = 0; k < 7; k++) {
        await db.costLog.create({
          data: {
            tenantId: tenant.id,
            provider: 'whatsapp_meta',
            model: 'conversation_api',
            inputTokens: 120,
            outputTokens: 180,
            costUsd: 0.008,
          },
        });
        totalCostLogs++;
      }
    }
  }

  // Criar 4 Anomalias e 4 Análises do Cérebro Zélla
  const anomalyTypes = ['error_spike', 'auth_failure_pattern', 'cost_anomaly', 'tenant_under_attack'];
  for (let i = 0; i < anomalyTypes.length; i++) {
    await db.anomalyEvent.create({
      data: {
        anomalyType: anomalyTypes[i],
        scope: 'global',
        metric: 'api_latency_ms',
        observed: 1450 + i * 200,
        baseline: 500,
        deviation: 3.5,
        detectionMethod: 'statistical',
      },
    });

    await db.cerebroAnalysis.create({
      data: {
        analysisType: 'anomaly_scan',
        scope: 'global',
        summary: `Identificado comportamento anômalo (${anomalyTypes[i]}). Ação recomendada ativada automaticamente pelo Cérebro Zélla.`,
        severity: i === 0 || i === 1 ? 'critical' : 'warning',
        details: JSON.stringify({ recommendation: 'Revisar limite de concorrência e chave de cache Redis.' }),
        costUsd: 0.002,
      },
    });
  }

  // Criar 1 Sugestão de Refatoração Pendente
  await db.refactorSuggestion.create({
    data: {
      sourceErrorHash: 'hash_setTimeout_sync_001',
      filePath: 'src/lib/whatsapp-send.ts',
      lineRange: '45-80',
      currentCode: 'setTimeout(() => sendWhatsAppMessage(), 1000);',
      proposedCode: 'await qstash.publishJSON({ url: "/api/webhooks/whatsapp/async" });',
      rationale: 'Substituir setTimeout síncrono por Fila Assíncrona QStash para reduzir o consumo de memória em tempo de execução.',
      status: 'pending_review',
      confidence: 0.95,
    },
  });

  return {
    success: true,
    summary: {
      totalTenants: mockTenantsData.length,
      totalConversations,
      totalMessages,
      totalReservations,
      totalCostLogs,
      totalDurationMs: Date.now() - startTime,
    },
  };
}

