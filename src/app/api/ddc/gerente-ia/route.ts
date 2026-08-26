// ==============================================================================
// ZEHLA SmartHotel — Zellador (Gerente de Treinamento IA) API
// ==============================================================================
// POST /api/ddc/gerente-ia
//
// Camadas de segurança (em ordem de execução):
//   1. Autenticação: getServerSession → 401 se sem sessão
//   2. Plano MAX:    requireMaxPlan  → 403 se não for MAX ativo
//   3. Rate Limit:   checkRateLimit  → 429 se excedido
//   4. Sanitização:  sanitizeInput   → 400 se injection detectado
//   5. LLM Call:     ZaosNeuroRouter → Tier 3 (premium)
//   6. Filtragem:    filterOutput    → Remove conteúdo sensível do output
//   7. Auditoria:    Persiste conversa no banco
//   8. SecurityAlert: Loga tentativas suspeitas
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, isDatabaseAvailable } from '@/lib/db';
import { getNeuroRouter } from '@/lib/ai/zaos-neuro-router';
import { retrieveRelevantKnowledge, formatRAGContext } from '@/lib/ai/semantic-rag';
import { requireMaxPlan } from '@/lib/ddc/require-max-plan';
import { checkZelladorRateLimit } from '@/lib/ddc/rate-limiter';
import {
  sanitizeZelladorInput,
  buildZelladorSystemPrompt,
  filterZelladorOutput,
  ZELLADOR_MAX_MESSAGE_LENGTH,
  ZELLADOR_SECURITY_RESPONSE,
  ZELLADOR_CONTEXT_MESSAGES,
  type SanitizationResult,
} from '@/lib/ddc/zellador-security';

// ── Tipos ───────────────────────────────────────────────────────────────────────

interface ZelladorRequestBody {
  message: string;
  conversationId?: string;
}

// ── Helper: extrair IP e User-Agent ────────────────────────────────────────────

function getClientInfo(request: NextRequest): { ip: string; userAgent: string } {
  return {
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

// ── Helper: buscar histórico de conversa ────────────────────────────────────────

async function getConversationHistory(
  tenantId: string,
  conversationId: string,
) {
  return db.zelladorMessage.findMany({
    where: { tenantId, conversationId },
    orderBy: { createdAt: 'asc' },
    take: ZELLADOR_CONTEXT_MESSAGES,
    select: {
      role: true,
      content: true,
    },
  });
}

// ── POST Handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Check DB availability first (Vercel serverless compatibility)
  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE', message: 'Banco de dados indisponível no momento. Tente novamente mais tarde.' },
      { status: 503 },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 1: Autenticação (session NextAuth)
  // ──────────────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Sessão de autenticação requerida.' },
      { status: 401 },
    );
  }

  const {tenantId} = session.user;
  const { ip, userAgent } = getClientInfo(request);

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 2: Verificação de Plano MAX (Subscription.planType)
  // ──────────────────────────────────────────────────────────────────────────
  const planCheck = await requireMaxPlan(tenantId);
  if (!planCheck.authorized) {
    return NextResponse.json(
      {
        error: 'FORBIDDEN_PLAN',
        message: 'O Zellador está disponível apenas no plano MAX.',
        currentPlan: planCheck.planType,
        subscriptionStatus: planCheck.subscriptionStatus,
        reason: planCheck.error,
      },
      { status: 403 },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 3: Rate Limiting
  // ──────────────────────────────────────────────────────────────────────────
  const rateLimit = await checkZelladorRateLimit(tenantId);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      {
        error: 'RATE_LIMITED',
        message: 'Limite de requisições excedido. Aguarde antes de tentar novamente.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      { status: 429 },
    );
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds || 60));
    return response;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Parse e validação do body
  // ──────────────────────────────────────────────────────────────────────────
  let body: ZelladorRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Corpo da requisição inválido (JSON esperado).' },
      { status: 400 },
    );
  }

  const { message, conversationId } = body;
  const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!message || typeof message !== 'string') {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'O campo "message" é obrigatório e deve ser uma string.' },
      { status: 400 },
    );
  }

  if (message.trim().length === 0) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'A mensagem não pode estar vazia.' },
      { status: 400 },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 4: Sanitização de Input (anti-injection)
  // ──────────────────────────────────────────────────────────────────────────
  const sanitization: SanitizationResult = sanitizeZelladorInput(message, tenantId, ip, userAgent);
  if (!sanitization.safe) {
    // Persistir a tentativa bloqueada como mensagem do usuário
    await db.zelladorMessage.create({
      data: {
        tenantId,
        conversationId: convId,
        role: 'user',
        content: message,
        blocked: true,
        blockReason: sanitization.reason,
      },
    });

    return NextResponse.json(
      {
        error: 'SECURITY_BLOCK',
        message: sanitization.reason || ZELLADOR_SECURITY_RESPONSE,
      },
      { status: 400 },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Preparar contexto: histórico + mensagem atual
  // ──────────────────────────────────────────────────────────────────────────
  const history = conversationId
    ? await getConversationHistory(tenantId, convId)
    : [];

  // Montar o array de mensagens para o LLM
  const contextMessages: Array<{ role: string; content: string }> = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  // Buscar nome do tenant para personalizar o system prompt
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name || 'Pousada';

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 5: Chamada ao LLM via ZaosNeuroRouter enriquecido com RAG Semântico (Fase 2)
  // IMPORTANTE: Chamar via import direto, NÃO via fetch para /api/brain
  // ──────────────────────────────────────────────────────────────────────────
  
  // Buscar conhecimento relevante para enriquecer o prompt do suporte técnico
  let ragContext = '';
  try {
    const ragResult = await retrieveRelevantKnowledge(tenantId, message);
    if (ragResult.entries && ragResult.entries.length > 0) {
      ragContext = formatRAGContext(ragResult);
    }
  } catch (error) {
    console.error('[gerente-ia RAG] Error retrieving knowledge entries:', error);
  }

  // Construir o system prompt blindado com informações da base de conhecimento da pousada (RAG)
  const baseSystemPrompt = buildZelladorSystemPrompt(tenantName, 'max');
  const systemPrompt = ragContext
    ? `${baseSystemPrompt}\n\n=== BASE DE CONHECIMENTO DA POUSADA (RAG) ===\nUse as informações abaixo para ajudar a responder às dúvidas de suporte do usuário:\n${ragContext}`
    : baseSystemPrompt;

  // Formatar o contexto histórico
  const formattedContext = contextMessages
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Zellador'}: ${m.content}`)
    .join('\n\n');

  const fullPrompt = `${formattedContext}\n\nUsuário: ${message}`;

  let rawResponse = '';
  let providerName = 'mock';
  let latencyMs = 0;
  let tier = 3;
  let costUsd = 0.001;

  const router = await getNeuroRouter();
  const llmResult = await router.generate({
    message: fullPrompt,
    systemPrompt,
    tier: 3, // Premium: GPT-4o, Claude, etc.
    noCache: true, // Nunca cachear respostas do Zellador
  });

  rawResponse = llmResult.response;
  providerName = llmResult.providerName;
  tier = llmResult.tier;
  latencyMs = llmResult.latencyMs;
  costUsd = llmResult.costUsd;

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 6: Filtragem de Output
  // ──────────────────────────────────────────────────────────────────────────
  const outputResult = filterZelladorOutput(rawResponse);
  const finalResponse = outputResult.fullyBlocked
    ? ZELLADOR_SECURITY_RESPONSE
    : outputResult.filtered;

  // ──────────────────────────────────────────────────────────────────────────
  // CAMADA 7: Persistir conversa no banco (auditoria)
  // ──────────────────────────────────────────────────────────────────────────
  await db.zelladorMessage.createMany({
    data: [
      {
        tenantId,
        conversationId: convId,
        role: 'user',
        content: message,
        blocked: false,
      },
      {
        tenantId,
        conversationId: convId,
        role: 'assistant',
        content: finalResponse,
        blocked: outputResult.fullyBlocked,
        blockReason: outputResult.fullyBlocked ? 'output_filtered' : undefined,
      },
    ],
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Retornar resposta
  // ──────────────────────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    data: {
      conversationId: convId,
      response: finalResponse,
      provider: providerName,
      tier: tier,
      latencyMs: latencyMs,
      costUsd: costUsd,
      outputWasFiltered: outputResult.fullyBlocked || outputResult.blockCount > 0,
    },
  });
}
