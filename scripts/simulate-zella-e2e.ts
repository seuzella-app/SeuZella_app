#!/usr/bin/env bun
// ============================================================================
// Z-LAB — CLI Script: E2E Simulation Battery
// ============================================================================
// Executa bateria completa de testes E2E via terminal.
//
// USO:
//   bun run test:e2e-zella                          # testa contra localhost:3000
//   ZLAB_BASE_URL=https://smart-hotel-zehla.vercel.app bun run test:e2e-zella
//
// FLUXO:
//  1. Cria tenant de teste (isTestTenant=true) para cada persona
//  2. Envia mensagens sintéticas via webhook WhatsApp
//  3. Coleta métricas (latência, custo, intenção)
//  4. Limpa tenant de teste
//  5. Gera relatório no terminal com APROVADO/REPROVADO
//
// AUTH:
//  - Em produção: precisa de ZCC_GODMODE_TOKEN + INTERNAL_ENDPOINT_TOKEN
//  - Em dev: bypass automático (WEBHOOK_ALLOW_NO_SECRET=true)
// ============================================================================

import { PERSONAS, type PersonaId, type GuestNiche } from '../src/lib/zlab/synthetic-guests';
import {
  generateMetaWebhookPayload,
  generateWebhookSignature,
  generateTestTenantName,
  generateTestTenantEmail,
  generateTestWhatsAppNumber,
} from '../src/lib/zlab/synthetic-guests';
import { PrismaClient } from '@prisma/client';

// ── Config ────────────────────────────────────────────────────────────────

const BASE_URL = process.env.ZLAB_BASE_URL || 'http://localhost:3000';
const MESSAGE_DELAY_MS = parseInt(process.env.ZLAB_MESSAGE_DELAY || '500', 10);
const PLAN = process.env.ZLAB_PLAN || 'pro';

const db = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────

interface TestResult {
  personaId: PersonaId;
  personaName: string;
  niche: GuestNiche;
  messagesSent: number;
  messagesSucceeded: number;
  messagesFailed: number;
  totalDurationMs: number;
  avgResponseMs: number;
  metaCostUsd: number;
  passed: boolean;
  errors: string[];
}

function log(icon: string, message: string): void {
  const timestamp = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function logSuccess(message: string): void {
  log('✅', `\x1b[32m${message}\x1b[0m`);
}

function logError(message: string): void {
  log('❌', `\x1b[31m${message}\x1b[0m`);
}

function logInfo(message: string): void {
  log('ℹ️', `\x1b[34m${message}\x1b[0m`);
}

function logWarn(message: string): void {
  log('⚠️', `\x1b[33m${message}\x1b[0m`);
}

// ── Create Test Tenant ────────────────────────────────────────────────────

async function createTestTenant(niche: GuestNiche): Promise<{ tenantId: string; whatsappNumber: string; tenantName: string }> {
  const tenantName = generateTestTenantName(niche, PLAN);
  const email = generateTestTenantEmail(niche);

  const tenant = await db.tenant.create({
    data: {
      name: tenantName,
      email,
      plan: PLAN,
      status: 'active',
      niche,
      isTestTenant: true,
      subscriptionAt: new Date(),
      whatsappPhoneNumber: generateTestWhatsAppNumber(),
    },
  });

  // Create Property
  await db.property.create({
    data: {
      tenantId: tenant.id,
      name: `Propriedade Teste ${tenantName}`,
      type: niche === 'pousada' ? 'pousada' : 'apartamento',
      city: 'São Paulo',
      state: 'SP',
      description: 'Propriedade de teste criada pelo Z-Lab CLI.',
      slug: `zlab-cli-${tenant.id.substring(0, 8)}`,
      pixKey: 'teste@zella.com',
      pixKeyType: 'email',
    },
  });

  // Create Subscription
  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      status: 'active',
      planType: PLAN,
      paymentMethod: 'pix',
      amount: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    tenantId: tenant.id,
    whatsappNumber: tenant.whatsappPhoneNumber || '',
    tenantName,
  };
}

// ── Send Synthetic Messages ───────────────────────────────────────────────

async function sendMessages(
  persona: typeof PERSONAS[number],
  whatsappNumber: string
): Promise<{ results: Array<{ status: number; durationMs: number; error?: string }>; totalDurationMs: number }> {
  const destinationNumber = whatsappNumber.replace(/\D/g, '');
  const results: Array<{ status: number; durationMs: number; error?: string }> = [];
  const startTime = Date.now();

  for (let i = 0; i < persona.messages.length; i++) {
    const payload = generateMetaWebhookPayload(persona, i, destinationNumber);
    const payloadStr = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadStr);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (signature) {
      headers['X-Hub-Signature-256'] = signature;
    }

    const msgStart = Date.now();

    try {
      const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
        method: 'POST',
        headers,
        body: payloadStr,
      });

      results.push({
        status: res.status,
        durationMs: Date.now() - msgStart,
      });

      logInfo(`  [${persona.name}] Msg ${i + 1}/${persona.messages.length}: "${persona.messages[i].substring(0, 40)}..." → ${res.status} (${Date.now() - msgStart}ms)`);
    } catch (err) {
      results.push({
        status: 0,
        durationMs: Date.now() - msgStart,
        error: err instanceof Error ? err.message : String(err),
      });
      logError(`  [${persona.name}] Msg ${i + 1}: fetch error — ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < persona.messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
    }
  }

  return { results, totalDurationMs: Date.now() - startTime };
}

// ── Collect Metrics ───────────────────────────────────────────────────────

async function collectMetrics(tenantId: string): Promise<{ metaCostUsd: number; messagesExchanged: number }> {
  const costAggregate = await db.metaCostLog.aggregate({
    _sum: { costUsd: true },
    _count: true,
    where: { tenantId },
  });

  const messages = await db.conversationMessage.count({
    where: { conversation: { tenantId } },
  });

  return {
    metaCostUsd: costAggregate._sum.costUsd ?? 0,
    messagesExchanged: messages,
  };
}

// ── Cleanup ────────────────────────────────────────────────────────────────

async function cleanupTenant(tenantId: string): Promise<boolean> {
  try {
    await db.tenant.delete({ where: { id: tenantId } });
    return true;
  } catch (err) {
    if (String(err).includes('Record to delete does not exist')) {
      return true;
    }
    logError(`Cleanup failed for ${tenantId}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ── Run Single Persona Test ───────────────────────────────────────────────

async function runPersonaTest(persona: typeof PERSONAS[number]): Promise<TestResult> {
  logInfo(`\n${'═'.repeat(70)}`);
  logInfo(`Testando persona: ${persona.name} (${persona.niche})`);
  logInfo(`Descrição: ${persona.description}`);
  logInfo(`Esperado: ${persona.expectedBehavior}`);
  logInfo(`${'─'.repeat(70)}`);

  // 1. Create test tenant
  const { tenantId, whatsappNumber, tenantName } = await createTestTenant(persona.niche);
  logSuccess(`Tenant criado: ${tenantName} (${tenantId})`);
  logInfo(`WhatsApp: ${whatsappNumber}`);

  // 2. Send synthetic messages
  logInfo('Enviando mensagens sintéticas...');
  const { results, totalDurationMs } = await sendMessages(persona, whatsappNumber);

  // 3. Collect metrics
  const metrics = await collectMetrics(tenantId);
  logInfo(`Métricas: ${metrics.messagesExchanged} mensagens trocadas, $${metrics.metaCostUsd.toFixed(4)} custo Meta`);

  // 4. Cleanup
  const cleaned = await cleanupTenant(tenantId);
  if (cleaned) {
    logSuccess(`Tenant removido: ${tenantName}`);
  } else {
    logError(`Falha ao remover tenant: ${tenantName}`);
  }

  // 5. Build result
  const succeeded = results.filter(r => r.status === 200).length;
  const failed = results.filter(r => r.status !== 200).length;
  const avgResponseMs = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.durationMs, 0) / results.length)
    : 0;

  return {
    personaId: persona.id,
    personaName: persona.name,
    niche: persona.niche,
    messagesSent: results.length,
    messagesSucceeded: succeeded,
    messagesFailed: failed,
    totalDurationMs,
    avgResponseMs,
    metaCostUsd: metrics.metaCostUsd,
    passed: succeeded === results.length && cleaned,
    errors: results.filter(r => r.error).map(r => r.error || ''),
  };
}

// ── Print Report ──────────────────────────────────────────────────────────

function printReport(results: TestResult[]): void {
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RELATÓRIO FINAL — Z-LAB E2E Battery');
  console.log('═'.repeat(70));
  console.log();

  // Table header
  console.log(
    'Persona'.padEnd(20) +
    'Niche'.padEnd(10) +
    'Msgs'.padEnd(6) +
    'OK'.padEnd(5) +
    'Fail'.padEnd(6) +
    'Avg ms'.padEnd(8) +
    'Cost $'.padEnd(10) +
    'Status'
  );
  console.log('─'.repeat(70));

  let totalPassed = 0;
  let totalMessages = 0;
  let totalCost = 0;

  for (const r of results) {
    const status = r.passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
    console.log(
      r.personaName.padEnd(20) +
      r.niche.padEnd(10) +
      String(r.messagesSent).padEnd(6) +
      String(r.messagesSucceeded).padEnd(5) +
      String(r.messagesFailed).padEnd(6) +
      String(r.avgResponseMs).padEnd(8) +
      r.metaCostUsd.toFixed(4).padEnd(10) +
      status
    );

    if (r.passed) totalPassed++;
    totalMessages += r.messagesSent;
    totalCost += r.metaCostUsd;
  }

  console.log('─'.repeat(70));
  console.log(
    'TOTAL'.padEnd(20) +
    ''.padEnd(10) +
    String(totalMessages).padEnd(6) +
    ''.padEnd(5) +
    ''.padEnd(6) +
    ''.padEnd(8) +
    totalCost.toFixed(4).padEnd(10) +
    `${totalPassed}/${results.length} aprovados`
  );
  console.log();

  // Errors detail
  const allErrors = results.flatMap(r => r.errors.map(e => ({ persona: r.personaName, error: e })));
  if (allErrors.length > 0) {
    console.log('⚠️  Erros encontrados:');
    for (const err of allErrors) {
      console.log(`  [${err.persona}] ${err.error}`);
    }
    console.log();
  }

  // Final verdict
  if (totalPassed === results.length) {
    console.log('🎉 TODOS OS TESTES PASSARAM — Sistema operacional!');
  } else if (totalPassed > 0) {
    console.log(`⚠️  ${totalPassed}/${results.length} testes passaram — revisar falhas acima`);
  } else {
    console.log('❌ TODOS OS TESTES FALHARAM — sistema não operacional');
  }
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 Z-LAB — Simulation & Training Harness (CLI)');
  console.log('═'.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Plan: ${PLAN}`);
  console.log(`Message delay: ${MESSAGE_DELAY_MS}ms`);
  console.log(`Personas: ${PERSONAS.length}`);
  console.log();

  // Check if server is running
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!healthRes.ok) {
      logWarn(`Health check retornou ${healthRes.status} — servidor pode estar com problemas`);
    } else {
      logSuccess('Servidor acessível');
    }
  } catch (err) {
    logError(`Não foi possível conectar ao servidor em ${BASE_URL}`);
    logError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    logInfo('Inicie o dev server com: bun run dev');
    process.exit(1);
  }

  // Run tests for each persona
  const results: TestResult[] = [];

  for (const persona of PERSONAS) {
    try {
      const result = await runPersonaTest(persona);
      results.push(result);

      if (result.passed) {
        logSuccess(`Persona ${persona.name}: APROVADA`);
      } else {
        logError(`Persona ${persona.name}: REPROVADA`);
      }
    } catch (err) {
      logError(`Erro fatal ao testar persona ${persona.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({
        personaId: persona.id,
        personaName: persona.name,
        niche: persona.niche,
        messagesSent: 0,
        messagesSucceeded: 0,
        messagesFailed: 0,
        totalDurationMs: 0,
        avgResponseMs: 0,
        metaCostUsd: 0,
        passed: false,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

  // Print final report
  printReport(results);

  // Exit code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// ── Run ───────────────────────────────────────────────────────────────────

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
