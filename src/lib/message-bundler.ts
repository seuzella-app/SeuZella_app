// ==============================================================================
// ZÉLLA — Message Bundler (Serverless-Safe via Upstash Redis + QStash)
// ==============================================================================
// CORREÇÃO CRÍTICA v2 — finding 2.1:
//  Versão anterior usava `Map` em memória + `setTimeout` para deferir o
//  processamento de mensagens em 3s. Em Vercel Serverless, depois que a função
//  retorna HTTP 200, o runtime congela o lambda e o setTimeout NUNCA dispara.
//  Resultado: mensagens chegavam ao webhook, IA nunca respondia.
//
// Solução:
//  - Buffer persistido em Upstash Redis (RPUSH + TTL)
//  - Processamento deferido via QStash (delay 3s) que chama um endpoint interno
//  - Fallback: se QStash não configurado, processa SÍNCRONO (bloqueia webhook
//    por 3-8s, mas garante entrega). Aceitável para dev/staging.
// ==============================================================================

export const COST_PER_MESSAGE_USD = 0.0068;
export const COST_PER_MESSAGE_BRL = 0.035;
export const BUNDLE_WINDOW_MS = 3000;
export const BUNDLE_BUFFER_TTL_SECONDS = 30; // Auto-expira buffers órfãos no Redis

export interface BundledMessage {
  tenantId: string;
  messageCount: number;
  costUsd: number;
  costBrl: number;
  savedCostUsd: number;
  savedCostBrl: number;
  bundleWindowMs: number;
  isOneShot: boolean;
  intent?: string;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
}

interface BundleMessageEntry {
  direction: 'inbound' | 'outbound';
  intent?: string;
  timestamp: Date;
  oneShot?: boolean;
}

interface PendingBundle {
  tenantId: string;
  messages: BundleMessageEntry[];
  timer: ReturnType<typeof setTimeout>;
  resolve: (result: BundledMessage) => void;
}

export interface BufferMessagePayload {
  tenantId: string;
  guestPhone: string;
  guestName?: string;
  messageContent: string;
  messageFrom: string;
}

type MessageProcessor = (payload: BufferMessagePayload) => Promise<unknown>;

// ── Estado em memória (apenas para estatísticas e fallback síncrono) ──
const pendingBundles = new Map<string, PendingBundle>();
const guestBuffers = new Map<string, {
  messages: BufferMessagePayload[];
  timer: ReturnType<typeof setTimeout>;
  processor: MessageProcessor;
}>();

let stats = {
  totalBundlesProcessed: 0,
  totalMessagesProcessed: 0,
  totalCostUsd: 0,
  totalSavedUsd: 0,
  totalOneShots: 0,
};

export interface BundlerStats {
  totalBundlesProcessed: number;
  totalMessagesProcessed: number;
  totalCostUsd: number;
  totalSavedUsd: number;
  totalOneShots: number;
  avgMessagesPerBundle: number;
  oneShotRate: number;
  savingsRate: number;
}

export function getBundlerStats(): BundlerStats {
  const avgMsg = stats.totalBundlesProcessed > 0
    ? stats.totalMessagesProcessed / stats.totalBundlesProcessed
    : 0;
  const oneShotRate = stats.totalBundlesProcessed > 0
    ? (stats.totalOneShots / stats.totalBundlesProcessed) * 100
    : 0;
  const totalUnbundledCost = stats.totalMessagesProcessed * COST_PER_MESSAGE_USD;
  const savingsRate = totalUnbundledCost > 0
    ? (stats.totalSavedUsd / totalUnbundledCost) * 100
    : 0;

  return {
    totalBundlesProcessed: stats.totalBundlesProcessed,
    totalMessagesProcessed: stats.totalMessagesProcessed,
    totalCostUsd: Math.round(stats.totalCostUsd * 10000) / 10000,
    totalSavedUsd: Math.round(stats.totalSavedUsd * 10000) / 10000,
    totalOneShots: stats.totalOneShots,
    avgMessagesPerBundle: Math.round(avgMsg * 100) / 100,
    oneShotRate: Math.round(oneShotRate * 100) / 100,
    savingsRate: Math.round(savingsRate * 100) / 100,
  };
}

export function resetBundlerStats(): void {
  stats = {
    totalBundlesProcessed: 0,
    totalMessagesProcessed: 0,
    totalCostUsd: 0,
    totalSavedUsd: 0,
    totalOneShots: 0,
  };
  for (const [, bundle] of pendingBundles) clearTimeout(bundle.timer);
  pendingBundles.clear();
  flushAllGuestBuffers();
}

// ── Custo tracking (mantém setTimeout, pois é apenas estatística, não crítico) ──
// A perda de stats em serverless cold start é aceitável — não afeta entregabilidade.
export function addMessageToBundle(
  tenantId: string,
  direction: 'inbound' | 'outbound',
  options?: { intent?: string; oneShot?: boolean }
): Promise<BundledMessage> {
  return new Promise((resolve) => {
    const existing = pendingBundles.get(tenantId);

    if (existing) {
      existing.messages.push({
        direction,
        intent: options?.intent,
        timestamp: new Date(),
        oneShot: options?.oneShot,
      });
      const oldResolve = existing.resolve;
      existing.resolve = (result) => {
        oldResolve(result);
        resolve(result);
      };
    } else {
      const messages: BundleMessageEntry[] = [{
        direction,
        intent: options?.intent,
        timestamp: new Date(),
        oneShot: options?.oneShot,
      }];

      const timer = setTimeout(() => {
        const bundle = pendingBundles.get(tenantId);
        if (!bundle) return;
        pendingBundles.delete(tenantId);

        const result = computeBundleResult(tenantId, bundle.messages);
        bundle.resolve(result);
      }, BUNDLE_WINDOW_MS);

      pendingBundles.set(tenantId, { tenantId, messages, timer, resolve });
    }
  });
}

/**
 * Computa o resultado de um bundle a partir das mensagens agrupadas.
 * Centraliza a lógica de cálculo de custo Meta.
 */
function computeBundleResult(tenantId: string, messages: BundleMessageEntry[]): BundledMessage {
  const messageCount = messages.length;
  const hasOutbound = messages.some(m => m.direction === 'outbound');
  const isOneShot = messages.some(m => m.oneShot);

  const costUsd = hasOutbound ? COST_PER_MESSAGE_USD : 0;
  const costBrl = hasOutbound ? COST_PER_MESSAGE_USD * 5.15 : 0;
  const outboundCount = messages.filter(m => m.direction === 'outbound').length;
  const unbundledCost = outboundCount * COST_PER_MESSAGE_USD;
  const savedCostUsd = unbundledCost - costUsd;
  const savedCostBrl = savedCostUsd * 5.15;

  stats.totalBundlesProcessed++;
  stats.totalMessagesProcessed += messageCount;
  stats.totalCostUsd += costUsd;
  stats.totalSavedUsd += savedCostUsd;
  if (isOneShot) stats.totalOneShots++;

  return {
    tenantId,
    messageCount,
    costUsd: Math.round(costUsd * 10000) / 10000,
    costBrl: Math.round(costBrl * 10000) / 10000,
    savedCostUsd: Math.round(savedCostUsd * 10000) / 10000,
    savedCostBrl: Math.round(savedCostBrl * 10000) / 10000,
    bundleWindowMs: BUNDLE_WINDOW_MS,
    isOneShot,
    intent: messages[0]?.intent,
    direction: hasOutbound ? 'outbound' : 'inbound',
    timestamp: new Date(),
  };
}

export function flushAllBundles(): BundledMessage[] {
  const results: BundledMessage[] = [];
  for (const [tenantId, bundle] of pendingBundles) {
    clearTimeout(bundle.timer);
    pendingBundles.delete(tenantId);
    results.push(computeBundleResult(tenantId, bundle.messages));
  }
  return results;
}

export function flushAllGuestBuffers(): void {
  for (const [, buffer] of guestBuffers) {
    clearTimeout(buffer.timer);
  }
  guestBuffers.clear();
}

// ── Configuração de runtime ──
function isQStashConfigured(): boolean {
  return !!(process.env.QSTASH_URL && process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL);
}

function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function redisKey(tenantId: string, guestPhone: string): string {
  // Sanitiza para uso como key Redis (sem caracteres especiais)
  const sanitizedPhone = guestPhone.replace(/[^a-zA-Z0-9]/g, '_');
  return `mb:${tenantId}:${sanitizedPhone}`;
}

/**
 * RBW v2 (item 3.8): builder PURO e exportado da Upstash-Deduplication-Id.
 *
 * Janela = BUNDLE_WINDOW_MS (3s) — NÃO mais (a v1 usava 10× = 30s, o que
 * SUPRIMIA publishes legítimos de janelas diferentes: mensagem chegando
 * até ~27s depois herdava o mesmo id e o flush dela nunca era agendado,
 * ficando presa no buffer até o TTL de 30s).
 *
 * Prova de liveness com janela = BUNDLE_WINDOW_MS:
 *   Toda mensagem cujo publish é suprimido (mesmo bucket do criador do
 *   ciclo) chega ANTES do flush do criador disparar (criador + 3s), e por
 *   isso é reclamada atomicamente pelo LPOP desse flush. Mensagem que chega
 *   depois do flush cai em bucket NOVO → publish próprio → flush próprio.
 *   Logo: dedup nunca suprime entrega, apenas jobs redundantes do MESMO
 *   ciclo. Duplicatas residuais são no-op pelo claim atômico (LPOP).
 */
export function buildFlushDeduplicationId(tenantId: string, guestPhone: string, nowMs: number = Date.now()): string {
  const bucket = Math.floor(nowMs / BUNDLE_WINDOW_MS);
  return `rbw-flush:${tenantId}:${guestPhone}:${bucket}`;
}

/**
 * Buffer principal — usado por ambos os webhooks WhatsApp.
 *
 * Estratégia:
 *  1. Se QStash + Redis configurados → buffer distribuído (recomendado para Vercel)
 *  2. Senão → fallback em memória com setTimeout (NÃO funciona em Vercel Serverless,
 *     mas permite rodar em dev/staging e em ambientes long-lived)
 *
 * Em produção sem QStash/Redis, processa SÍNCRONO para garantir entrega (mesmo
 * bloqueando o webhook por alguns segundos).
 */
export async function bufferMessage(
  payload: BufferMessagePayload,
  processor: MessageProcessor
): Promise<BundledMessage> {
  if (!payload.tenantId || !payload.guestPhone) {
    throw new Error(`bufferMessage: payload inválido (tenantId ou guestPhone faltando)`);
  }

  const useQStash = isQStashConfigured() && isRedisConfigured();

  if (useQStash) {
    return await bufferMessageViaQStash(payload, processor);
  }

  // Fallback em memória — apenas para dev/staging/long-lived servers
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[message-bundler] AVISO: Produção sem QStash/Redis. Processando síncrono (webhook vai bloquear). ' +
      'Configure QSTASH_URL, QSTASH_TOKEN, NEXT_PUBLIC_APP_URL e UPSTASH_REDIS_REST_*'
    );
    return await bufferMessageSynchronous(payload, processor);
  }

  return await bufferMessageInMemory(payload, processor);
}

/**
 * Buffer via QStash + Upstash Redis (recomendado Vercel Serverless).
 *
 * 1. Mensagem vai para Lista Redis com TTL de 30s (auto-expira órfãos)
 * 2. QStash é agendado para chamar /api/internal/flush-buffer após 3s
 * 3. O endpoint interno faz LRANGE + DEL, concatena, chama processor
 */
async function bufferMessageViaQStash(
  payload: BufferMessagePayload,
  _processor: MessageProcessor
): Promise<BundledMessage> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const qstashUrl = process.env.QSTASH_URL!;
  const qstashToken = process.env.QSTASH_TOKEN!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const key = redisKey(payload.tenantId, payload.guestPhone);

  // 1. Push para Redis com TTL
  try {
    const pushRes = await fetch(`${redisUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['RPUSH', key, JSON.stringify({ ...payload, ts: Date.now() })],
        ['EXPIRE', key, BUNDLE_BUFFER_TTL_SECONDS],
      ]),
      signal: AbortSignal.timeout(3000),
    });

    if (!pushRes.ok) {
      throw new Error(`Redis push HTTP ${pushRes.status}: ${await pushRes.text().catch(() => 'unknown')}`);
    }
  } catch (error) {
    console.error('[message-bundler] Redis push falhou, processando síncrono:', error);
    return await bufferMessageSynchronous(payload, _processor);
  }

  // 2. Schedule QStash call para flush em 3s
  try {
    const callbackUrl = `${appUrl}/api/internal/flush-buffer`;
    const res = await fetch(`${qstashUrl}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Delay': `${BUNDLE_WINDOW_MS / 1000}s`,
        // ── RBW Fase N + v2: idempotency key determinística por buffer+CICLO ──
        // "publish accepted + HTTP timeout" NÃO significa job não aceito.
        // Janela determinística = BUNDLE_WINDOW_MS (vê builder acima): nunca
        // suprime flush de janela futura; duplicata do MESMO ciclo é absorvida
        // pelo QStash, e flush tardio duplicado encontra buffer vazio (LPOP).
        'Upstash-Deduplication-Id': buildFlushDeduplicationId(payload.tenantId, payload.guestPhone),
      },
      body: JSON.stringify({
        url: callbackUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: payload.tenantId,
          guestPhone: payload.guestPhone,
        }),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`QStash publish HTTP ${res.status}: ${await res.text().catch(() => 'unknown')}`);
    }
  } catch (error) {
    console.error('[message-bundler] QStash agendamento falhou, processando síncrono:', error);
    // Buffer já está no Redis; vamos processar síncrono para garantir entrega imediata.
    // Possível duplicação — endpoint /flush-buffer deve ser idempotente.
    return await flushBufferSynchronous(payload.tenantId, payload.guestPhone, _processor);
  }

  // 3. Estatística de custo (inbound, sem outbound ainda)
  return await addMessageToBundle(payload.tenantId, 'inbound', {
    intent: payload.messageContent?.slice(0, 50),
  });
}

/**
 * Flush síncrono imediato — usado quando QStash falha ou em dev mode sem QStash.
 * Bloqueia o webhook por até 3-8s (acceptable para dev, problemático em prod
 * mas garante entrega da mensagem ao hóspede).
 */
async function bufferMessageSynchronous(
  payload: BufferMessagePayload,
  processor: MessageProcessor
): Promise<BundledMessage> {
  // Aguarda a janela de bundling
  await new Promise<void>((resolve) => setTimeout(resolve, BUNDLE_WINDOW_MS));
  try {
    await processor(payload);
  } catch (err) {
    console.error('[message-bundler] Synchronous processor error:', err);
  }
  return await addMessageToBundle(payload.tenantId, 'inbound', {
    intent: payload.messageContent?.slice(0, 50),
  });
}

/**
 * Flush síncrono de buffer Redis existente — usado como fallback de QStash.
 * Lê todas as mensagens pendentes no Redis, concatena, chama processor.
 */
async function flushBufferSynchronous(
  tenantId: string,
  guestPhone: string,
  processor: MessageProcessor
): Promise<BundledMessage> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const key = redisKey(tenantId, guestPhone);

  // Aguarda janela de bundling
  await new Promise<void>((resolve) => setTimeout(resolve, BUNDLE_WINDOW_MS));

  let intentSnapshot: string | undefined;

  try {
    // ── RBW Fase N: CLAIM ATÔMICO (LPOP count) ────────────────────────────────
    // Antes: LRANGE (leitura) → process → DEL — dois workers liam o MESMO
    // buffer e processavam em dobro. Agora: LPOP remove-e-entrega
    // atomicamente; o segundo worker recebe lista vazia e NÃO reprocessa.
    // Falha do processor → RPUSH de volta (requeue, ordem preservada) + TTL
    // renovado, para o próximo flush tentar de novo.
    const res = await fetch(`${redisUrl}/lpop/${key}/100`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${redisToken}` },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      throw new Error(`Redis LPOP HTTP ${res.status}`);
    }

    const data = (await res.json()) as { result: string[] | null };
    const messageStrings = data.result || [];

    if (messageStrings.length === 0) {
      return await addMessageToBundle(tenantId, 'inbound', {});
    }

    const payloads: BufferMessagePayload[] = messageStrings.map((s) => JSON.parse(s) as BufferMessagePayload);
    intentSnapshot = payloads[0]?.messageContent?.slice(0, 50);

    const concatenatedContent = payloads.map(p => p.messageContent).join('\n');
    const batchPayload: BufferMessagePayload = {
      ...payloads[0],
      messageContent: concatenatedContent,
    };

    try {
      await processor(batchPayload);
    } catch (procErr) {
      // Requeue honesto: devolve as mensagens reclamadas para o próximo flush.
      // (No design antigo o DEL ficava após o process — a falha mantinha as
      // mensagens; preservamos a mesma garantia com o claim atômico.)
      console.error('[message-bundler] processor falhou — requeue do buffer reclamado:', procErr);
      await fetch(`${redisUrl}/rpush/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageStrings.map(s => JSON.parse(s))),
        signal: AbortSignal.timeout(3000),
      }).catch(() => { /* TTL de 30s evita acúmulo infinito */ });
      await fetch(`${redisUrl}/expire/${key}/${BUNDLE_BUFFER_TTL_SECONDS}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(2000),
      }).catch(() => { /* Non-fatal */ });
    }
  } catch (err) {
    console.error('[message-bundler] flushBufferSynchronous falhou:', err);
  }

  return await addMessageToBundle(tenantId, 'inbound', {
    intent: intentSnapshot,
  });
}

/**
 * Buffer em memória (dev mode / long-lived servers como VPS Docker).
 * Mantém a lógica original do bundler para DX local.
 */
async function bufferMessageInMemory(
  payload: BufferMessagePayload,
  processor: MessageProcessor
): Promise<BundledMessage> {
  const bufferKey = `${payload.tenantId}:${payload.guestPhone}`;
  const existing = guestBuffers.get(bufferKey);

  if (existing) {
    existing.messages.push(payload);
    return await addMessageToBundle(payload.tenantId, 'inbound', {
      intent: payload.messageContent?.slice(0, 50),
    });
  }

  const messages: BufferMessagePayload[] = [payload];
  const timer = setTimeout(async () => {
    const buffer = guestBuffers.get(bufferKey);
    if (!buffer) return;
    guestBuffers.delete(bufferKey);

    const allMessages = buffer.messages;
    const concatenatedContent = allMessages.map(m => m.messageContent).join('\n');
    const batchPayload: BufferMessagePayload = {
      ...allMessages[0],
      messageContent: concatenatedContent,
    };

    try {
      await buffer.processor(batchPayload);
    } catch (err) {
      console.error('[message-bundler] In-memory processor error:', err);
    }
  }, BUNDLE_WINDOW_MS);

  guestBuffers.set(bufferKey, { messages, timer, processor });
  return await addMessageToBundle(payload.tenantId, 'inbound', {
    intent: payload.messageContent?.slice(0, 50),
  });
}

// ═══════════════════════════════════════════════════════════════════
// ENDPOINT HELPER — usado por /api/internal/flush-buffer/route.ts
// (criar este endpoint separadamente para receber o callback do QStash)
// ═══════════════════════════════════════════════════════════════════

export interface FlushBufferRequest {
  tenantId: string;
  guestPhone: string;
}

/**
 * Handler para o endpoint /api/internal/flush-buffer — chamado pelo QStash.
 * Lê todas as mensagens pendentes no Redis para (tenantId, guestPhone),
 * concatena, chama o processor, e limpa o buffer.
 *
 * USO (em src/app/api/internal/flush-buffer/route.ts):
 *
 *   import { handleFlushBufferRequest } from '@/lib/message-bundler';
 *   import { processIncomingMessage } from '@/lib/whatsapp-ai-responder';
 *
 *   export async function POST(req: NextRequest) {
 *     const body = await req.json() as FlushBufferRequest;
 *     const result = await handleFlushBufferRequest(body, processIncomingMessage);
 *     return NextResponse.json(result);
 *   }
 */
export async function handleFlushBufferRequest(
  req: FlushBufferRequest,
  processor: MessageProcessor
): Promise<{ success: boolean; messageCount: number; error?: string }> {
  if (!req.tenantId || !req.guestPhone) {
    return { success: false, messageCount: 0, error: 'Missing tenantId or guestPhone' };
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return { success: false, messageCount: 0, error: 'Redis not configured' };
  }

  const key = redisKey(req.tenantId, req.guestPhone);

  try {
    // ── RBW Fase N: CLAIM ATÔMICO (LPOP count) — mesmo contrato do flush
    // síncrono: dois workers/concorrências NUNCA processam o mesmo buffer.
    const [lpopRes] = await Promise.all([
      fetch(`${redisUrl}/lpop/${key}/100`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(3000),
      }),
    ]);

    if (!lpopRes.ok) {
      return { success: false, messageCount: 0, error: `Redis HTTP ${lpopRes.status}` };
    }

    const data = (await lpopRes.json()) as { result: string[] | null };
    const messageStrings = data.result || [];

    if (messageStrings.length === 0) {
      return { success: true, messageCount: 0 };
    }

    const payloads: BufferMessagePayload[] = messageStrings.map((s) => JSON.parse(s) as BufferMessagePayload);
    const concatenatedContent = payloads.map(p => p.messageContent).join('\n');
    const batchPayload: BufferMessagePayload = {
      ...payloads[0],
      messageContent: concatenatedContent,
    };

    try {
      await processor(batchPayload);
    } catch (procErr) {
      // Requeue: mensagens reclamadas voltam para o próximo flush tentar.
      console.error('[message-bundler] processor falhou — requeue do buffer reclamado:', procErr);
      await fetch(`${redisUrl}/rpush/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(messageStrings.map(s => JSON.parse(s))),
        signal: AbortSignal.timeout(3000),
      }).catch(() => { /* TTL evita acúmulo infinito */ });
      await fetch(`${redisUrl}/expire/${key}/${BUNDLE_BUFFER_TTL_SECONDS}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${redisToken}` },
        signal: AbortSignal.timeout(2000),
      }).catch(() => { /* Non-fatal */ });
      return { success: false, messageCount: 0, error: 'PROCESSOR_FAILED_REQUEUED' };
    }

    // Registra estatística de custo
    await addMessageToBundle(req.tenantId, 'inbound', {
      intent: payloads[0]?.messageContent?.slice(0, 50),
    });

    return { success: true, messageCount: messageStrings.length };
  } catch (error) {
    console.error('[message-bundler] handleFlushBufferRequest error:', error);
    return {
      success: false,
      messageCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
