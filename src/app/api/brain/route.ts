import { NextRequest, NextResponse } from 'next/server';
import { getNeuroRouter } from '@/lib/ai/zaos-neuro-router';
import { guardWhatsAppMessage } from '@/lib/ai/whatsapp-guardrails';
import { classifyIntent } from '@/lib/ai/intent-router';
import { retrieveRelevantKnowledge, formatRAGContext } from '@/lib/ai/semantic-rag';
import { executeCognitivePipeline } from '@/lib/ai/cognitive-router';
import { resolveTenantId } from '@/lib/ddc/auth-utils';
import { getLearningStats } from '@/lib/brain/conversation-learner';
import { withSecurity } from '@/lib/security/api-shield';
import { guardRequest } from '@/lib/infra/wiring';

async function postHandler(request: NextRequest) {
  try {
  // RUN11-W3 (11B): rate-limit fail-closed por IP — 30 req/min.
  const rlDeny = guardRequest(request, 'brain.post', { points: 30, windowMs: 60000 });
  if (rlDeny) return rlDeny;
    const tenantId = await resolveTenantId();
    if (!tenantId) return NextResponse.json({ error: 'TENANT_AUTH_REQUIRED' }, { status: 401 });
    const body = await request.json();
    const { message, sessionId, systemPrompt = '' } = body;
    if (typeof message !== 'string' || !message.trim()) return NextResponse.json({ error: 'INVALID_MESSAGE' }, { status: 400 });
    if (message.length > 50000) return NextResponse.json({ error: 'MESSAGE_TOO_LARGE' }, { status: 400 });
    const { searchParams } = new URL(request.url);
    if (searchParams.get('guard') === 'true') return NextResponse.json({ ok: true, guardResult: guardWhatsAppMessage(message) });
    if (searchParams.get('intent') === 'true') return NextResponse.json({ ok: true, intentResult: await classifyIntent(message) });
    if (searchParams.get('rag') === 'true') {
      const ragResult = await retrieveRelevantKnowledge(tenantId, message);
      return NextResponse.json({ ok: true, ragResult, contextText: formatRAGContext(ragResult) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    const result = await executeCognitivePipeline({ message, tenantId, sessionId, systemPrompt });
    return NextResponse.json({ success: result.success, provider: result.providerId, intent: result.intent, confidence: result.confidence, tier: result.tierUsed, latencyMs: 0, isMock: result.isMock, requiresHumanHandover: result.requiresHumanHandover, securityAlerts: result.securityAlerts, toolCalls: result.toolCalls, searchStats: result.searchStats, response: result.response });
  } catch (error) {
    console.error('[BRAIN_ROUTE_ERROR]', error);
    return NextResponse.json({ error: 'BRAIN_REQUEST_FAILED' }, { status: 500 });
  }
}

async function getHandler() {
  try {
    const tenantId = await resolveTenantId();
    const router = await getNeuroRouter();
    let learning;
    if (tenantId) {
      const stats = await getLearningStats(tenantId);
      learning = { totalPatterns: stats.totalPatterns, verifiedPatterns: stats.verifiedPatterns, antiPatternsCount: stats.antiPatternsCount || 0, learningVelocity: stats.learningVelocity || 0, avgSentimentScore: stats.avgSentimentScore || 0 };
    }
    return NextResponse.json({ status: 'online', service: 'ZaosNeuroRouter', version: '5.1.0', engine: 'Thompson Sampling + Circuit Breakers + Budget Guard + Semantic Cache + Self-Learning v2.0', budget: router.getBudgetSnapshot(), cache: router.getCacheStats(), circuitBreakers: router.getCircuitBreakerStates(), learning, providers: router.getProviders().map(p => ({ id: p.registration.id, name: p.registration.name, tier: p.registration.tier, circuitState: p.circuitBreaker.getState(), estimatedSuccessRate: Math.round((p.alpha / (p.alpha + p.beta)) * 10000) / 10000, avgLatencyMs: p.totalRequests > 0 ? Math.round(p.totalLatencyMs / p.totalRequests) : p.registration.expectedLatencyMs, totalRequests: p.totalRequests })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[BRAIN_GET_ERROR]', error);
    return NextResponse.json({ error: 'BRAIN_STATUS_UNAVAILABLE' }, { status: 503 });
  }
}

export const POST = withSecurity(postHandler, { routeLabel: 'brain', maxPayloadBytes: 500_000 });
export const GET = withSecurity(getHandler, { routeLabel: 'brain-status' });
