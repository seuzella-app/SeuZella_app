# JEV SHAPES — RUN21-A (recon read-only de formas para o ARCH/CONTRACT)

Gerado: 2026-09-22T19:16:14.523Z
Diretiva: JEV MASTER — fiação precisa do adapter kind=DECISION (sem adivinhar shapes).

## A) Estado git
- branch: feat/meta-zella-foundation | HEAD: ffa3902b (ffa3902b54a50b0adfd0d286ddef8281f5e80327)
- árvore: modified=0 untracked=15 staged=0 (fora de 99_AUDITS: 0)

## B) zaos-neuro-router.ts (1926 linhas)
- ProviderRegistration: BLOCO EXTRAÍDO (L156, 23 linhas)
```ts
export interface ProviderRegistration {
  id: string;
  name: string;
  tier: number;
  /** Cost per 1K input tokens in USD */
  costPer1kInput: number;
  /** Cost per 1K output tokens in USD */
  costPer1kOutput: number;
  /** Average expected latency in ms */
  expectedLatencyMs: number;
  /** Maximum context window in tokens */
  maxContextTokens: number;
  /** Whether provider supports JSON mode */
  supportsJson: boolean;
  /** Whether provider supports tool/function calling */
  supportsTools: boolean;
  /** Base URL for API calls (null for local) */
  baseUrl: string | null;
  /** Initial alpha for Beta posterior (default: 1.0) */
  initialAlpha?: number;
  /** Initial beta for Beta posterior (default: 1.0) */
  initialBeta?: number;
}
```
- DEFAULT_PROVIDERS: BLOCO EXTRAÍDO (L194, 15 linhas)
```ts
const DEFAULT_PROVIDERS: ProviderRegistration[] = [
  {
    id: 'ollama-llama3',
    name: 'Ollama Llama 3.1 8B (Local)',
    tier: 1,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    expectedLatencyMs: 120,
    maxContextTokens: 8192,
    supportsJson: true,
    supportsTools: false,
    baseUrl: null,
    initialAlpha: 3.0,
    initialBeta: 1.0,
  },
```
- Registro de providers: 1 ocorrência(s) de registro
  - L1039: `registerProvider(registration: ProviderRegistration): void {`
- kind/DECISION/GENERATIVE: sem kind/DECISION/GENERATIVE no zaos
- Exportações (14):
  - L58: `export type ContextBucket = (typeof CONTEXT_BUCKETS)[number];`
  - L61: `export interface LLMRequest {`
  - L87: `export interface LLMResponse {`
  - L125: `export interface LLMToolCall {`
  - L132: `export interface LLMToolResponse extends LLMResponse {`
  - L140: `export interface LLMToolRequest {`
  - L156: `export interface ProviderRegistration {`
  - L181: `export interface RouterProviderState {`
  - L386: `export interface AgentFallbackChain {`
  - L397: `export const AGENT_FALLBACK_CHAINS: Record<string, AgentFallbackChain> = {`
  - L452: `export function getAgentChain(agentId: string): AgentFallbackChain {`
  - L483: `export class ZaosNeuroRouter {`
  - L1913: `export async function getNeuroRouter(): Promise<ZaosNeuroRouter> {`
  - L1924: `export function resetNeuroRouter(): void {`

## C) Domínio decision (src/domain/decision)
- presente: SIM (13 arquivos .ts)
  - src/domain/decision/adapters/InMemoryRouterStateAdapter.ts (72 linhas)
  - src/domain/decision/models/BetaBinomialPosterior.ts (137 linhas)
  - src/domain/decision/models/BudgetGuard.ts (76 linhas)
  - src/domain/decision/models/CircuitBreakerState.ts (132 linhas)
  - src/domain/decision/models/PosteriorKey.ts (5 linhas)
  - src/domain/decision/models/ProviderCapabilityProfile.ts (52 linhas)
  - src/domain/decision/models/RoutingContext.ts (36 linhas)
  - src/domain/decision/models/RoutingDecision.ts (47 linhas)
  - src/domain/decision/ports/IRouterStatePort.ts (44 linhas)
  - src/domain/decision/services/AdaptiveStickiness.ts (45 linhas)
  - src/domain/decision/services/ContextDiscretizer.ts (148 linhas)
  - src/domain/decision/services/ParetoMultiObjectiveSelector.ts (88 linhas)
- ProviderCapabilityProfile (src/domain/decision/models/ProviderCapabilityProfile.ts): bloco extraído (9 linhas)
```ts
export interface ICapabilityVector {
  readonly reasoning: number; // [0, 1]
  readonly conversation: number; // [0, 1]
  readonly code: number; // [0, 1]
  readonly json: number; // [0, 1]
  readonly creative: number; // [0, 1]
  readonly multilingual: number; // [0, 1]
  readonly safety: number; // [0, 1]
}
```
- src/domain/decision/adapters/InMemoryRouterStateAdapter.ts:
  - L3: `export class InMemoryRouterStateAdapter implements IRouterStatePort {`
- src/domain/decision/models/BetaBinomialPosterior.ts:
  - L1: `export class BetaBinomialPosterior {`
- src/domain/decision/models/BudgetGuard.ts:
  - L1: `export interface BudgetSnapshot {`
  - L8: `export enum BudgetLevel {`
  - L14: `export class BudgetGuard {`
- src/domain/decision/models/CircuitBreakerState.ts:
  - L1: `export enum CircuitState {`
  - L7: `export interface CircuitBreakerConfig {`
  - L14: `export const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {`
  - L21: `export class CircuitBreakerState {`
- src/domain/decision/models/PosteriorKey.ts:
  - L1: `export interface PosteriorKey {`
- src/domain/decision/models/ProviderCapabilityProfile.ts:
  - L1: `export interface ICapabilityVector {`
  - L11: `export class ProviderCapabilityProfile {`
- src/domain/decision/models/RoutingContext.ts:
  - L1: `export class RoutingContext {`
- src/domain/decision/models/RoutingDecision.ts:
  - L1: `export class RoutingDecision {`
- src/domain/decision/ports/IRouterStatePort.ts:
  - L1: `export interface IRouterStatePort {`
- src/domain/decision/services/AdaptiveStickiness.ts:
  - L4: `export interface IStickinessSessionState {`
  - L10: `export class AdaptiveStickiness {`
- src/domain/decision/services/ContextDiscretizer.ts:
  - L1: `export class ContextDiscretizer {`
- src/domain/decision/services/ParetoMultiObjectiveSelector.ts:
  - L3: `export interface IBucketRequirement {`
  - L9: `export class ParetoMultiObjectiveSelector {`

## D) llm-adapters.ts (797 linhas) e llm-router.ts (244 linhas)
- adapter convention: bloco extraído (L6)
```ts
export interface AdapterResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}
```
- llm-adapters exports:
  - L6: `export interface AdapterResponse {`
  - L12: `export interface AdapterMessage {`
  - L22: `export interface AdapterToolDef {`
  - L36: `export interface AdapterToolCallDef {`
  - L65: `export async function callOpenAICompatible(params: {`
  - L121: `export async function callAnthropic(params: {`
  - L171: `export async function callGemini(params: {`
  - L240: `export interface AdapterToolResponse extends AdapterResponse {`
  - L262: `export async function callOpenAIWithTools(params: {`
  - L362: `export async function callGeminiWithTools(params: {`
  - L522: `export async function callAnthropicWithTools(params: {`
  - L704: `export async function callGeminiWithAudio(params: {`
  - L777: `export function mapWhatsappAudioToGemini(whatsappMime: string): {`
- llm-router exports:
  - L3: `export interface MLInteractionLog {`
  - L93: `export class LLMRouter {`
  - L243: `export const llmRouter = new LLMRouter()`

## E) Módulos de suporte (src/lib/ai)
- src/lib/ai/budget-guard.ts: 374 linhas, 8 export(s)
  - L17: `export enum BudgetLevel {`
  - L23: `export enum ProviderTier {`
  - L29: `export interface BudgetGuardConfig {`
  - L40: `export interface BudgetGuardSnapshot {`
  - L60: `export class BudgetGuard {`
  - L268: `export class TenantBudgetGuard {`
  - L332: `export const tenantBudgetGuard = new TenantBudgetGuard();`
  - L334: `export async function getTotalSpendReport(tenantId: string) {`
- src/lib/ai/circuit-breaker.ts: 227 linhas, 4 export(s)
  - L16: `export enum CircuitState {`
  - L22: `export interface CircuitBreakerConfig {`
  - L31: `export interface CircuitBreakerSnapshot {`
  - L46: `export class CircuitBreaker {`
- src/lib/ai/llm-timeout.ts: 99 linhas, 3 export(s)
  - L29: `export interface LlmTimeoutContext {`
  - L46: `export async function withLlmTimeout<T>(`
  - L85: `export async function withLlmFallback<T>(`
- src/lib/ai/cost-logger.ts: 108 linhas, 3 export(s)
  - L3: `export interface LLMCostLogEntry {`
  - L18: `export class CostLogger {`
  - L107: `export const costLogger = new CostLogger();`
- src/lib/ai/pii-guard.ts: 139 linhas, 1 export(s)
  - L92: `export const piiGuard = {`
- src/lib/ai/tier-distributor.ts: 291 linhas, 5 export(s)
  - L39: `export type TierLevel = 1 | 2 | 3;`
  - L41: `export interface TierDecision {`
  - L115: `export function decideTier(`
  - L258: `export function estimateWeightedCost(`
  - L284: `export function getTierDistributionStats() {`

## F) src/lib/infra (11 arquivos)
  - src/lib/infra/audit.ts (93 linhas)
  - src/lib/infra/cache.ts (202 linhas)
  - src/lib/infra/health.ts (74 linhas)
  - src/lib/infra/internal-secret.ts (63 linhas)
  - src/lib/infra/logger.ts (65 linhas)
  - src/lib/infra/optional-require.ts (33 linhas)
  - src/lib/infra/queue.ts (208 linhas)
  - src/lib/infra/rate-limit.ts (128 linhas)
  - src/lib/infra/ssrf-guard.ts (60 linhas)
  - src/lib/infra/wiring-registry.ts (36 linhas)
  - src/lib/infra/wiring.ts (64 linhas)
- internal-secret.ts:
  - L16: `export function internalEnforced(): boolean {`
  - L20: `export function providedInternalSecret(req: unknown): string | null {`
  - L42: `export function requireInternalSecret(req: unknown): Response | null {`
- ssrf-guard.ts:
  - L15: `export function ssrfAllowlist(): string[] {`
  - L22: `export function ssrfEnforced(): boolean {`
  - L26: `export function hostOf(targetUrl: string): string | null {`
  - L46: `export function ssrfGuard(targetUrl: string): Response | null {`
- wiring.ts:
  - L20: `export type GuardPolicy = RateLimitPolicy;`
  - L22: `export function clientIp(req: Request): string {`
  - L29: `export function hashIp(ip: string): string {`
  - L34: `export function guardRequest(`
  - L61: `export function auditRouteEvent(event: AuditEvent): string {`

## G) Convenção de env (nomes apenas; valores nunca lidos)
- process.env direto em 47 chave(s)
  - NODE_ENV x2 (ex.: `if (!context.userId || !context.tenantId || (process.env.NODE_ENV === 'production' && context.tenantId.includes('demo'))) {` em src/lib/ai/backend-tool-authorizer.ts)
  - BATCH_API_ENABLED x1 (ex.: `enabled: process.env.BATCH_API_ENABLED === 'true',` em src/lib/ai/batch-queue.ts)
  - USE_DSPY_COMPILED_PROMPTS x1 (ex.: `const USE_DSPY_COMPILED_PROMPTS = process.env.USE_DSPY_COMPILED_PROMPTS === 'true';` em src/lib/ai/cognitive-router.ts)
  - HEADROOM_PROXY_ENABLED x2 (ex.: `/** Whether Headroom Proxy is enabled (default: process.env.HEADROOM_PROXY_ENABLED) */` em src/lib/ai/headroom-client.ts)
  - OLLAMA_URL x1 (ex.: `const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'` em src/lib/ai/llm-router.ts)
  - DEEPSEEK_API_KEY x5 (ex.: `const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - ZHIPU_API_KEY x5 (ex.: `const GLM_KEY = process.env.ZHIPU_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - OPENROUTER_API_KEY x5 (ex.: `const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - GROQ_API_KEY x5 (ex.: `const GROQ_KEY = process.env.GROQ_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - OPENAI_API_KEY x3 (ex.: `const OPENAI_KEY = process.env.OPENAI_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - GEMINI_API_KEY x8 (ex.: `const GEMINI_KEY = process.env.GEMINI_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - ANTHROPIC_API_KEY x4 (ex.: `const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''` em src/lib/ai/llm-router.ts)
  - CLAUDE_MODEL x1 (ex.: `const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'` em src/lib/ai/llm-router.ts)
  - NEXTAUTH_URL x1 (ex.: `headers['HTTP-Referer'] = process.env.NEXTAUTH_URL || 'http://localhost:3000'` em src/lib/ai/llm-router.ts)
  - UPSTASH_REDIS_REST_URL x2 (ex.: `enabled: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),` em src/lib/ai/redis-cache.ts)
  - UPSTASH_REDIS_REST_TOKEN x2 (ex.: `enabled: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),` em src/lib/ai/redis-cache.ts)
  - TF_SIDECAR_URL x1 (ex.: `const TF_SIDECAR_URL = process.env.TF_SIDECAR_URL || 'http://127.0.0.1:8501';` em src/lib/ai/tf-client.ts)
  - TF_API_KEY x1 (ex.: `const TF_API_KEY = process.env.TF_API_KEY || '';` em src/lib/ai/tf-client.ts)
  - TF_TIMEOUT_MS x1 (ex.: `const TF_TIMEOUT_MS = parseInt(process.env.TF_TIMEOUT_MS || '3000', 10);` em src/lib/ai/tf-client.ts)
  - USE_TF_INTENT x1 (ex.: `intent: process.env.USE_TF_INTENT === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_CHURN x1 (ex.: `churn: process.env.USE_TF_CHURN === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_LEAD x1 (ex.: `lead: process.env.USE_TF_LEAD === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_ANOMALY x1 (ex.: `anomaly: process.env.USE_TF_ANOMALY === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_OCCUPANCY x1 (ex.: `occupancy: process.env.USE_TF_OCCUPANCY === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_SENTIMENT x1 (ex.: `sentiment: process.env.USE_TF_SENTIMENT === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_PRICE x1 (ex.: `price: process.env.USE_TF_PRICE === 'true',` em src/lib/ai/tf-client.ts)
  - USE_TF_UPSELL x1 (ex.: `upsell: process.env.USE_TF_UPSELL === 'true',` em src/lib/ai/tf-client.ts)
  - GLM_5_2_API_KEY x4 (ex.: `process.env.GLM_5_2_API_KEY || process.env.ZHIPU_API_KEY,` em src/lib/ai/tool-calling.ts)
  - KIMI_K2_6_API_KEY x4 (ex.: `process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY,` em src/lib/ai/tool-calling.ts)
  - MOONSHOT_API_KEY x4 (ex.: `process.env.KIMI_K2_6_API_KEY || process.env.MOONSHOT_API_KEY,` em src/lib/ai/tool-calling.ts)
- padrões de helper/schema de env:
  - src/lib/ai/tool-registry.ts:L19: `*     inputSchema: z.object({ checkIn: z.string(), checkOut: z.string() }),`
  - src/lib/cerebro/ze-code/gap-detector.ts:L92: `suggestedCode: '// Adicione:\nimport { z } from "zod";\nconst schema = z.object({ /* ... */ });\nconst parsed = schema.safeParse(await req.json());\nif (!parsed.success) return Response.json({ error: "Invalid input" }...`
  - src/lib/env.ts:L5: `function getEnv(key: string, fallback?: string): string {`
  - src/lib/env.ts:L27: `export const DATABASE_URL = getEnv('DATABASE_URL', 'file:./db/custom.db');`
  - src/lib/env.ts:L28: `export const NEXTAUTH_URL = getEnv('NEXTAUTH_URL', 'http://localhost:3000');`
  - src/lib/infra/health.ts:L44: `export function getEnvAllowlist(): string[] {`
  - src/lib/metagpt/sops/experience-distiller.sop.ts:L13: `const NPSFeedbackInputSchema = z.object({`
  - src/lib/metagpt/sops/experience-distiller.sop.ts:L20: `const NPSFeedbackOutputSchema = z.object({`
  - src/lib/metagpt/sops/experience-distiller.sop.ts:L26: `const DistillKnowledgeInputSchema = z.object({`
  - src/lib/metagpt/sops/experience-distiller.sop.ts:L32: `const DistillKnowledgeOutputSchema = z.object({`

## H) Amostra de chamada da pilha de IA
- src/app/api/cron/cerebro-analyze/route.ts (233 linhas)
- imports:
  - `import { NextRequest, NextResponse } from 'next/server';`
  - `import { verifyCronAuth } from '@/lib/security/cron-auth-unified';`
  - `import { logSink } from '@/lib/cerebro/log-sink';`
  - `import { getCerebroMode } from '@/lib/cerebro/types';`
  - `import { runAnomalyDetection } from '@/lib/cerebro/anomaly-detector';`
  - `import { bridgeCerebroAlert } from '@/lib/notifications/bridges';`
  - `import { getGlmCerebroService } from '@/lib/cerebro/glm-service';`
  - `import { dispatchAlert } from '@/lib/cerebro/alert-bus';`
  - `import { verifyCronM2MToken, auditCronExecution } from '@/lib/security/cron-auth';`
  - `import { db } from '@/lib/db';`
- corpo (até 55 linhas, scrubbed):
```ts
// ============================================================================
// ZÉLLA — Cron: Cérebro Analyze (15 min)
// ============================================================================
// Endpoint chamado a cada 15 min via Vercel Cron.
//
// FUNÇÃO:
//  1. Puxa anomalias não-acknowledged dos últimos 15 min (do AnomalyDetector)
//  2. Se há anomalias, chama GlmCerebroService.analyzeAnomalies()
//  3. Persiste análise em CerebroAnalysis
//  4. Se severity >= critical, dispara AlertBus (em live mode)
//  5. Em mock mode: gera análises sintéticas mas NÃO envia alertas
//
// AUTH:
//  - Em produção: CRON_SECRET (header Authorization: Bearer <token>)
//  - Em dev: sem auth (para teste manual)
//
// CUSTO LLM:
//  - Em mock: $0 (não chama GLM)
//  - Em live: ~$0.002 por análise × 4/hora × 24h × 30d = ~$5.76/mês
//  - Hard cap: CEREBRO_MONTHLY_BUDGET_USD (default $20) — fallback para mock se estourar
//
// INTEGRAÇÃO COM VERCEL CRON:
//  Adicionar em vercel.json:
//  { "path": "/api/cron/cerebro-analyze", "schedule": "*/15 * * * *" }
// ============================================================================
// Notification bridge — Phase 2: pushes analysis anomalies into DDC for the tenant
export async function GET(request: NextRequest): Promise<NextResponse> {
  return runAnalysis(request);
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  return runAnalysis(request);
}
async function runAnalysis(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const mode = getCerebroMode();
  // ── Auth M2M EdDSA (V11-P0) — fail-closed ──
  const auth = await verifyCronM2MToken(request, 'cerebro:read');
  if (!auth.ok) {
    return auth.response;
  }
  const {principal} = auth;
  try {
    // ── 1. Roda AnomalyDetector para coletar anomalias atuais ──
    const anomalies = await runAnomalyDetection();
    if (anomalies.length === 0) {
      const processingTime = Date.now() - startTime;
      logSink.info({
        module: 'cerebro-analyze',
        event: 'no_anomalies_to_analyze',
        message: `Nenhuma anomalia detectada — análise não necessária (${processingTime}ms)`,
        context: { processingTimeMs: processingTime, mode },
      });
      return NextResponse.json({
        ok: true,
        mode,
```

## I) middleware.ts (39 linhas)
- presente (39 linhas)
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { wafMiddleware } from '@/lib/security/waf-middleware';

// FIX (onda Meta Foundation — auditoria): '/api/webhooks/whatsapp' é o webhook
// canônico da Meta Cloud API (HMAC fail-closed + idempotência + pricing). Ele
// DEVE ser público como os demais webhooks (/api/webhook-whatsapp, asaas,
// mercadopago): a autenticação aqui é a assinatura HMAC X-Hub-Signature-256,
// verificada dentro do handler — não a sessão NextAuth.
const PUBLIC_API_PREFIXES = ['/api/health','/api/readiness','/api/auth','/api/webhook-whatsapp','/api/webhooks/whatsapp','/api/webhooks/asaas','/api/webhooks/mercadopago','/api/webhooks/payment','/api/checkout/webhook...
const BLOCKED_API_PREFIXES = ['/api/debug-agent','/api/proxy','/api/diagnose'];
const PROTECTED_PAGE_PREFIXES = ['/zcc','/dashboard','/config','/tenants','/campaigns','/leads','/targets','/agents','/roi','/swipe-templates'];
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function startsWithAny(pathname: string, prefixes: string[]): boolean { return prefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)); }
function isPublicApi(pathname: string): boolean { return startsWithAny(pathname, PUBLIC_API_PREFIXES); }
function getSessionCookie(request: NextRequest): string | undefined { return request.cookies.get('__Secure-next-auth.session-token')?.value || request.cookies.get('next-auth.session-token')?.value; }
function createRequestId(request: NextRequest): string { const supplied = request.headers.get('x-request-id') || request.headers.get('x-vercel-id'); return supplied && REQUEST_ID_RE.test(supplied) ? supplied : `mid-${...
function securityHeaders(response: NextResponse, requestId: string): NextResponse { response.headers.set('X-Request-ID', requestId); response.headers.set('X-Content-Type-Options','nosniff'); response.headers.set('X-Fr...
async function getAuthenticatedToken(request: NextRequest) { const secret = process.env.NEXTAUTH_SECRET; if (!secret) throw new Error('NEXTAUTH_SECRET environment variable is required'); return getToken({ req: request...
async function authorizeZcc(request: NextRequest): Promise<boolean> { const token = await getAuthenticatedToken(request); if (!token) return false; const email = typeof token.email === 'string' ? token.email.trim().to...
function timingSafeEqualStr(a: string,b: string): boolean { if (a.length !== b.length) return false; let mismatch = 0; for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i); return mismatch === 0; }
function isMachineAuthorized(request: NextRequest): boolean { const authHeader = request.headers.get('authorization'); if (!authHeader) return false; const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7...

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = createRequestId(request);
  const wafResponse = wafMiddleware(request);
  if (wafResponse) return securityHeaders(wafResponse, requestId);
  if (startsWithAny(pathname,BLOCKED_API_PREFIXES) && process.env.NODE_ENV === 'production') return securityHeaders(NextResponse.json({ error:'NOT_FOUND', requestId },{status:404}),requestId);
  if (pathname === '/zcc/login') return securityHeaders(NextResponse.next(),requestId);
  if (pathname === '/ddc' || pathname.startsWith('/ddc/')) { if (pathname === '/ddc' || pathname === '/ddc/') { try { const token = await getAuthenticatedToken(request); const niche = (token as any)?.niche; return sec...
  if (pathname === '/zcc' || pathname.startsWith('/zcc/')) { try { if (await authorizeZcc(request)) return securityHeaders(NextResponse.next(),requestId); } catch { /* fail closed */ } const loginUrl = new URL('/zcc/l...
  if (pathname.startsWith('/api/')) { if (isPublicApi(pathname)) return securityHeaders(NextResponse.next(),requestId); /* RUN7-W2 (RES-01): presenca de cookie != sessao valida - o JWT e verificado de fato no perimetr...
  if (startsWithAny(pathname,PROTECTED_PAGE_PREFIXES) && !getSessionCookie(request)) { const loginUrl = new URL('/login',request.url); loginUrl.searchParams.set('callbackUrl',pathname); return securityHeaders(NextResp...
  return securityHeaders(NextResponse.next(),requestId);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)'] };

```

## J) tsconfig
- {"parseError":true}

## K) PERGUNTAS DE SHAPE (respondidas por este recon)
1. Shape de ProviderRegistration? -> BLOCO EXTRAÍDO (L156, 23 linhas)
2. Como providers se registram? -> 1 ocorrência(s) de registro
3. Há typing de kind (DECISION/GENERATIVE)? -> sem kind/DECISION/GENERATIVE no zaos
4. Shape de ProviderCapabilityProfile? -> bloco extraído (9 linhas)
5. Convenção de adapter (interface/complete)? -> bloco extraído (L6)
6. Convenção de env? -> process.env direto em 47 chave(s)
7. Como uma rota chama a pilha? -> src/app/api/cron/cerebro-analyze/route.ts (233 linhas)
8. Middleware/isolamento de tenant? -> presente (39 linhas)

NADA foi editado nesta onda (read-only). Próxima: JEV ARCH/CONTRACT (decision
contract + adapter + registry kind=DECISION + SHADOW_ONLY), kit fail-closed.
STOP=RED se: registry não estendível / tenant isolation comprometida / secret
handling inadequado / migração destrutiva / push necessário.
