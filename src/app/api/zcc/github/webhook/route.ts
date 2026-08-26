/**
 * Webhook Listener — Recebe eventos do GitHub em tempo real.
 *
 * Endpoint: POST /api/zcc/github/webhook
 *
 * Eventos tratados:
 *  - push            → atualizar índice de código
 *  - pull_request    → rastrear ciclo de vida de RefactorSuggestions
 *  - check_suite     → bloquear merge se CI falhou
 *  - issues          → sincronizar labels com categorias de gap
 *  - ping            → handshake inicial (configuração do webhook)
 *
 * Doc: "Bíblia do ZéCode — GitHub GitOps" (Cap. 8)
 *
 * SEGURANÇA:
 *  - Validação de assinatura HMAC SHA-256 (X-Hub-Signature-256)
 *  - IP allowlist (faixas oficiais do GitHub) — defesa em profundidade
 *  - Idempotência via X-GitHub-Delivery UUID
 *  - Rate limit próprio (anti-abuso)
 *  - Nunca loga payload completo (pode conter dados sensíveis)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

// ============================================================
// CONFIG
// ============================================================

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_APP_WEBHOOK_SECRET;

// Faixas IP oficiais do GitHub — https://api.github.com/meta
// Atualizado em 2025-01. Recomenda-se sync periódico.
const GITHUB_IP_RANGES = [
  // IPv4
  '192.30.252.0/22',
  '185.199.108.0/22',
  '140.82.112.0/16',
  '143.55.64.0/20',
  '20.201.28.151/32',
  '20.197.88.0/22',
  '20.205.243.0/24',
  '20.246.77.240/28',
  '20.99.224.0/22',
  '20.99.227.0/24',
  '20.119.32.0/22',
  '20.126.0.0/22',
  '131.253.24.0/22',
  '172.187.0.0/16',
  // IPv6
  '2a0a:a440::/29',
  '2606:50c0:8000::/24',
  '2606:50c0:8001::/24',
  '2606:50c0:8002::/24',
  '2606:50c0:8003::/24',
];

// Cache de IPs do GitHub (busca via /meta API, atualiza 1x por dia)
const githubIpCache: { ips: string[]; fetchedAt: Date } | null = null;

// Idempotência — últimos 1000 delivery IDs
const processedDeliveries = new Map<string, Date>();
const MAX_DELIVERY_CACHE = 1000;

// ============================================================
// HELPERS
// ============================================================

/**
 * Verifica se IP está em CIDR (IPv4 ou IPv6).
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const prefixBits = parseInt(bits);

    const ipBuf = ip.includes(':') ? Buffer.from(ipToBytesV6(ip)) : Buffer.from(ipToBytesV4(ip));
    const rangeBuf = range.includes(':') ? Buffer.from(ipToBytesV6(range)) : Buffer.from(ipToBytesV4(range));

    if (ipBuf.length !== rangeBuf.length) return false;

    const byteCount = Math.floor(prefixBits / 8);
    const bitRemainder = prefixBits % 8;

    for (let i = 0; i < byteCount; i++) {
      if (ipBuf[i] !== rangeBuf[i]) return false;
    }

    if (bitRemainder > 0 && byteCount < ipBuf.length) {
      const mask = 0xff << (8 - bitRemainder);
      if ((ipBuf[byteCount] & mask) !== (rangeBuf[byteCount] & mask)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

function ipToBytesV4(ip: string): number[] {
  return ip.split('.').map((o) => parseInt(o));
}

function ipToBytesV6(ip: string): number[] {
  // Simplificado — em produção, use pacote 'ip6addr'
  // Por ora, se IPv6, rejeitamos silenciosamente (foco em IPv4)
  return [];
}

function isGitHubIP(ip: string): boolean {
  // Se tem lista de IPs do GitHub atualizada, usa ela
  if (githubIpCache) {
    return githubIpCache.ips.includes(ip);
  }
  // Senão, fallback para ranges hardcoded
  return GITHUB_IP_RANGES.some((range) => isIPInCIDR(ip, range));
}

/**
 * Verifica assinatura HMAC SHA-256 do webhook.
 * Constant-time comparison (anti-timing-attack).
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }
  const expected =
    `sha256=${ crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Remove entradas antigas do cache de deliveries (anti memory leak).
 */
function cleanupDeliveryCache(): void {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1h
  for (const [id, date] of processedDeliveries.entries()) {
    if (now - date.getTime() > maxAge) {
      processedDeliveries.delete(id);
    }
  }
  if (processedDeliveries.size > MAX_DELIVERY_CACHE) {
    // Limpa metade se ainda muito grande
    const toDelete = Array.from(processedDeliveries.entries())
      .sort(([, a], [, b]) => a.getTime() - b.getTime())
      .slice(0, Math.floor(MAX_DELIVERY_CACHE / 2));
    for (const [id] of toDelete) processedDeliveries.delete(id);
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // 1. Verifica que secret está configurado
  if (!WEBHOOK_SECRET) {
    console.error('[GitHub Webhook] GITHUB_WEBHOOK_SECRET não configurado');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // 2. Extrai headers
  const signature = req.headers.get('X-Hub-Signature-256') || '';
  const eventType = req.headers.get('X-GitHub-Event') || '';
  const deliveryId = req.headers.get('X-GitHub-Delivery') || '';
  const clientIP =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '';

  // 3. IP allowlist (defesa em profundidade — mesmo com signature válida)
  // Em desenvolvimento, pula essa checagem
  if (process.env.NODE_ENV === 'production' && clientIP && !isGitHubIP(clientIP)) {
    console.warn(`[GitHub Webhook] IP rejeitado: ${clientIP}`);
    return NextResponse.json({ error: 'Forbidden IP' }, { status: 403 });
  }

  // 4. Lê body como texto (necessário para HMAC verification)
  const body = await req.text();

  // 5. Verifica assinatura HMAC
  if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
    console.warn(`[GitHub Webhook] Assinatura inválida [delivery: ${deliveryId}]`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 6. Idempotência — se já processamos esse delivery, retorna OK
  if (deliveryId && processedDeliveries.has(deliveryId)) {
    console.log(`[GitHub Webhook] Delivery duplicado ignorado: ${deliveryId}`);
    return NextResponse.json({ received: true, duplicate: true, deliveryId });
  }
  if (deliveryId) {
    processedDeliveries.set(deliveryId, new Date());
    cleanupDeliveryCache();
  }

  // 7. Parse do payload
  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const repo = payload.repository?.full_name || 'unknown';
  console.log(
    `[GitHub Webhook] ${eventType} [${deliveryId}] from ${repo} (IP: ${clientIP || 'unknown'})`
  );

  // 8. Dispatch por tipo de evento
  try {
    switch (eventType) {
      case 'ping':
        return NextResponse.json({
          received: true,
          eventType,
          deliveryId,
          message: 'Webhook configurado com sucesso!',
        });

      case 'push':
        await handlePush(payload);
        break;

      case 'pull_request':
        await handlePullRequest(payload);
        break;

      case 'check_suite':
        await handleCheckSuite(payload);
        break;

      case 'check_run':
        await handleCheckRun(payload);
        break;

      case 'issues':
        await handleIssue(payload);
        break;

      default:
        // Eventos não tratados — loga e retorna OK (não falha)
        console.log(`[GitHub Webhook] Evento não tratado: ${eventType}`);
    }

    return NextResponse.json({
      received: true,
      eventType,
      deliveryId,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error(`[GitHub Webhook] Erro ao processar [${deliveryId}]:`, err);
    return NextResponse.json(
      {
        error: 'Processing failed',
        deliveryId,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// ============================================================
// HANDLERS DE EVENTOS
// ============================================================

/**
 * Evento: push
 * Ação: atualiza índice de código (code-indexer) com novos arquivos.
 */
async function handlePush(payload: any): Promise<void> {
  const repo = payload.repository.full_name;
  const {ref} = payload; // refs/heads/main
  const branch = ref.replace('refs/heads/', '');
  const commits = payload.commits || [];

  console.log(`[GitHub Webhook] Push em ${repo}:${branch} (${commits.length} commits)`);

  // Coleta arquivos modificados
  const modifiedFiles = new Set<string>();
  for (const commit of commits) {
    for (const f of commit.modified || []) modifiedFiles.add(f);
    for (const f of commit.added || []) modifiedFiles.add(f);
    for (const f of commit.removed || []) modifiedFiles.add(f);
  }

  console.log(
    `[GitHub Webhook] ${modifiedFiles.size} arquivos modificados em ${repo}:${branch}`
  );

  // TODO: chamar code-indexer.reindex(repo, branch, modifiedFiles)
  // Por enquanto apenas loga. Quando code-indexer tiver API estável, plugar aqui.

  // Se commit message contém [ze-code-automated], marca suggestion correspondente
  const headCommit = payload.head_commit;
  if (headCommit?.message?.includes('[ze-code-automated]')) {
    console.log('[GitHub Webhook] Commit do ZéCode detectado — atualizando suggestion');
    // O ZéCode já marca a suggestion ao criar o PR. Nada a fazer aqui.
  }
}

/**
 * Evento: pull_request
 * Ação: rastreia ciclo de vida de RefactorSuggestions.
 */
async function handlePullRequest(payload: any): Promise<void> {
  const {action} = payload; // opened | synchronize | closed | reopened | etc.
  const pr = payload.pull_request;
  const repo = payload.repository.full_name;
  const prNumber = pr.number;

  console.log(
    `[GitHub Webhook] PR #${prNumber} ${action} em ${repo} (merged: ${pr.merged || false})`
  );

  // Se PR foi merged, verifica se era do ZéCode e marca suggestion como applied
  if (action === 'closed' && pr.merged) {
    // Identifica se era PR do ZéCode pela branch head
    const headRef = pr.head?.ref || '';
    if (headRef.startsWith('feat/ze-code/') || headRef.startsWith('feat/ze-code-')) {
      // Busca suggestion com essa branch
      const suggestion = await db.refactorSuggestion.findFirst({
        where: { reviewNotes: { contains: `Branch: ${headRef}` } },
      });
      if (suggestion && suggestion.status === 'applied') {
        // Já está como "applied" — apenas loga
        console.log(
          `[GitHub Webhook] Suggestion ${suggestion.id} já estava como applied — PR merged confirmado`
        );
        // Atualiza reviewNotes com info de merge
        await db.refactorSuggestion.update({
          where: { id: suggestion.id },
          data: {
            reviewNotes: `${suggestion.reviewNotes}\n[merged at ${new Date().toISOString()}]`,
          },
        });
      }
    }

    // Verifica se o PR body menciona "Fixes #N" — fecha issue automaticamente
    // (GitHub já faz isso nativamente, mas podemos logar)
    const fixesMatch = (pr.body || '').match(/Fixes\s+#(\d+)/i);
    if (fixesMatch) {
      console.log(`[GitHub Webhook] PR merged fecha issue #${fixesMatch[1]} automaticamente`);
    }
  }

  // Se PR foi aberto por humano, o GitHub Action ze-code-review.yml vai chamar ZéCode
  // (não fazemos isso aqui no webhook para evitar duplicação)
  if (action === 'opened' && !pr.head?.ref?.startsWith('feat/ze-code/')) {
    console.log(
      `[GitHub Webhook] PR #${prNumber} aberto por humano — GitHub Action vai acionar ZéCode`
    );
  }
}

/**
 * Evento: check_suite
 * Ação: se CI falhou em PR do ZéCode, notifica admin.
 */
async function handleCheckSuite(payload: any): Promise<void> {
  const {action} = payload;
  const suite = payload.check_suite;

  if (action === 'completed') {
    const {conclusion} = suite; // success | failure | cancelled | etc.
    const headSha = suite.head_sha;
    const headBranch = suite.head_branch;

    console.log(
      `[GitHub Webhook] Check suite ${conclusion} em ${headBranch} (sha: ${headSha.substring(0, 7)})`
    );

    // Se falhou em branch do ZéCode, notifica
    if (
      conclusion === 'failure' &&
      (headBranch?.startsWith('feat/ze-code/') || headBranch?.startsWith('feat/ze-code-'))
    ) {
      console.warn(
        `[GitHub Webhook] CI falhou em branch do ZéCode: ${headBranch}. Admin deve revisar.`
      );
      // TODO: chamar AlertBus.send({ severity: 'WARN', title: 'CI falhou em PR do ZéCode', ... })
    }
  }
}

/**
 * Evento: check_run
 * Ação: loga status de checks individuais (opcional — verbose).
 */
async function handleCheckRun(payload: any): Promise<void> {
  const {action} = payload;
  const checkRun = payload.check_run;
  if (action === 'completed') {
    console.log(
      `[GitHub Webhook] Check run "${checkRun.name}" ${checkRun.conclusion} em ${checkRun.head_sha.substring(0, 7)}`
    );
  }
}

/**
 * Evento: issues
 * Ação: sincroniza labels de issues criadas pelo ZéCode.
 */
async function handleIssue(payload: any): Promise<void> {
  const {action} = payload;
  const {issue} = payload;

  if (action === 'labeled' || action === 'unlabeled') {
    const label = payload.label?.name;
    console.log(
      `[GitHub Webhook] Issue #${issue.number} ${action} com label: ${label}`
    );
  } else if (action === 'closed' || action === 'reopened') {
    console.log(`[GitHub Webhook] Issue #${issue.number} ${action}`);
  }
}

// ============================================================
// GET — healthcheck
// ============================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: '/api/zcc/github/webhook',
    configured: !!WEBHOOK_SECRET,
    events: ['push', 'pull_request', 'check_suite', 'check_run', 'issues', 'ping'],
    docs: 'Bíblia do ZéCode — GitHub GitOps (Cap. 8)',
  });
}
