import { assertProductionCredentialsReady } from "./lib/credentials/production-gate";
// ============================================================================
// ZÉLLA — Next.js Instrumentation Hook
// ============================================================================
// Este arquivo é carregado UMA vez quando o servidor Next.js inicia (tanto
// em dev quanto em produção na Vercel). É o ponto correto para:
//  - Inicializar singletons (LogSink interceptação, caches, etc)
//  - Registrar handlers de processo (unhandledRejection, uncaughtException)
//  - Iniciar tarefas em background
//
// Documentação: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
// ============================================================================

export async function register(): Promise<void> {
// W1_GATE_MARKER:BEGIN — WAVE 1 FASE 1: production credential gate (fail-closed)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertProductionCredentialsReady();
  }
// W1_GATE_MARKER:END

  // Só executa no server (Node.js runtime)
  if (typeof window !== 'undefined') return;

  // ── 1. Inicializa LogSink (intercepta console.error/warn globalmente) ──
  // Em modo mock: apenas console + ring buffer in-memory
  // Em modo live: console + ring buffer + Redis Stream
  try {
    const { logSink } = await import('./lib/cerebro/log-sink');
    logSink.interceptConsole();
    // Log de boot confirma que interceptação está ativa
    const { getCerebroMode } = await import('./lib/cerebro/types');
    console.log(`[Instrumentation] Cérebro mode: ${getCerebroMode()}`);
  } catch (error) {
    // Nunca deixa o boot falhar por causa de telemetria
    console.error('[Instrumentation] Falha ao inicializar LogSink (non-fatal):', error);
  }

  // ── 2. Error Reporter (Sentry-compatible, sem SDK dependency) ──
  // Captura unhandledRejection + uncaughtException globalmente
  // Se SENTRY_DSN configurado, envia para Sentry; senão, apenas LogSink
  try {
    const { registerGlobalErrorHandlers } = await import('./lib/cerebro/error-reporter');
    registerGlobalErrorHandlers();
    console.log('[Instrumentation] Error Reporter handlers registered');
  } catch (error) {
    console.error('[Instrumentation] Falha ao registrar error handlers (non-fatal):', error);
  }

  // ── 3. Canary Detector (apenas em Node.js runtime, não Edge) ──
  // O canary detector é um detector de honeypot — detecta se canary records
  // no DB foram tocados. Aqui no boot apenas confirmamos que o módulo está carregável.
  // Em Edge Runtime, pulamos pois não há suporte a Prisma/crypto.
  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    try {
      await import('./lib/security/canary-detector');
      await import('./lib/security/guardian-alert');
      console.log('[Instrumentation] Canary Detector + Guardian Alert modules loaded');
    } catch (error) {
      console.warn('[Instrumentation] Canary Detector não disponível (non-fatal):', error);
    }
  } else {
    console.log('[Instrumentation] Skipping Canary Detector (Edge Runtime)');
  }

  // ── 4. Log de boot com info do ambiente ──
  const bootInfo = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    region: process.env.VERCEL_REGION,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8),
    runtime: process.env.NEXT_RUNTIME || 'nodejs',
    sentryConfigured: !!process.env.SENTRY_DSN,
  };
  console.log('[Instrumentation] Boot info:', JSON.stringify(bootInfo));
}
