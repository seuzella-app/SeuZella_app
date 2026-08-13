/**
 * ZÉLLA — withApiGuard: Handler Padronizado (Wrapper) para API Routes
 *
 * Camada de proteção CENTRAL que garante:
 * 1. Autenticação obrigatória (NextAuth session)
 * 2. Validação de role (ADMIN | TENANT_USER)
 * 3. Extração obrigatória do tenantId da sessão
 * 4. Validação Zod do body (se schema fornecido)
 * 5. Sanitização de input (delegada para api-shield)
 *
 * DIFERENÇA vs withSecurity:
 * - withSecurity: proteção genérica (rate limit, payload size, sanitization)
 * - withApiGuard: proteção de AUTENTICAÇÃO + TENANT ISOLATION + SCHEMA
 *
 * USO RECOMENDADO: Combinar ambos:
 *   export const POST = withSecurity(
 *     withApiGuard({ schema: mySchema }, async ({ tenantId, body }) => { ... }),
 *     { routeLabel: 'my-route' }
 *   );
 *
 * Ou usar comApiGuard standalone (sem withSecurity) para rotas internas:
 *   export const POST = withApiGuard({ schema: mySchema }, async ({ tenantId, body }) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// ── Types ──────────────────────────────────────────────────────

export interface GuardOptions<T = any> {
  /** Role exigida para acessar a rota. Se não especificado, qualquer usuário autenticado pode acessar */
  role?: 'ADMIN' | 'TENANT_USER';
  /** Schema Zod para validação do body (opcional) */
  schema?: z.ZodSchema<T>;
  /** Se true, permite acesso sem tenantId (apenas para rotas ADMIN globais) */
  allowGlobalAccess?: boolean;
  /** Label para logging */
  routeLabel?: string;
}

export interface GuardContext<T = any> {
  req: NextRequest;
  session: any;
  tenantId: string | null;
  body: T;
  requestId: string;
}

type GuardedHandler<T> = (context: GuardContext<T>) => Promise<NextResponse | Response>;

// ── Wrapper Principal ──────────────────────────────────────────

/**
 * Envolve um handler de API com proteção completa:
 * - Autenticação (NextAuth)
 * - Autorização (role check)
 * - Tenant isolation (tenantId obrigatório)
 * - Schema validation (Zod)
 *
 * @example
 * export const POST = withApiGuard(
 *   { schema: z.object({ name: z.string() }) },
 *   async ({ tenantId, body }) => {
 *     const item = await db.item.create({ data: { ...body, tenantId } });
 *     return NextResponse.json(item);
 *   }
 * );
 */
export function withApiGuard<T = any>(
  options: GuardOptions<T>,
  handler: GuardedHandler<T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const requestId = req.headers.get('x-request-id')
      || req.headers.get('x-vercel-id')
      || `guard-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // ── 1. VALIDAÇÃO DE SESSÃO (AUTENTICAÇÃO) ──────────────────
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Sessão não encontrada. Faça login.' },
          { status: 401, headers: { 'X-Request-ID': requestId } }
        );
      }

      // ── 2. VALIDAÇÃO DE ROLE (AUTORIZAÇÃO) ─────────────────────
      if (options.role === 'ADMIN' && session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Acesso restrito a administradores.' },
          { status: 403, headers: { 'X-Request-ID': requestId } }
        );
      }

      // ── 3. EXTRAÇÃO OBRIGATÓRIA DO TENANT ID ────────────────────
      const tenantId = (session.user as any).tenantId || null;
      if (!tenantId && !options.allowGlobalAccess) {
        return NextResponse.json(
          { error: 'TENANT_CONTEXT_MISSING', message: 'Contexto de tenant ausente.' },
          { status: 400, headers: { 'X-Request-ID': requestId } }
        );
      }

      // ── 4. VALIDAÇÃO ZOD DO BODY (se schema fornecido) ─────────
      let parsedBody: T = {} as T;
      if (options.schema) {
        let rawBody: unknown;
        try {
          rawBody = await req.json();
        } catch {
          return NextResponse.json(
            { error: 'INVALID_JSON', message: 'Corpo da requisição não é JSON válido.' },
            { status: 400, headers: { 'X-Request-ID': requestId } }
          );
        }

        const result = options.schema.safeParse(rawBody);
        if (!result.success) {
          return NextResponse.json(
            {
              error: 'VALIDATION_ERROR',
              message: 'Dados inválidos',
              details: result.error.format(),
            },
            { status: 422, headers: { 'X-Request-ID': requestId } }
          );
        }
        parsedBody = result.data;
      }

      // ── 5. EXECUTAR HANDLER COM CONTEXTO SEGURO ─────────────────
      return await handler({
        req,
        session,
        tenantId,
        body: parsedBody,
        requestId,
      });

    } catch (error) {
      console.error(`[API_GUARD${options.routeLabel ? `:${options.routeLabel}` : ''}] Error:`, error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Erro interno no servidor' },
        { status: 500, headers: { 'X-Request-ID': requestId } }
      );
    }
  };
}

// ── Variantes especializadas ───────────────────────────────────

/**
 * Guard para rotas que exigem ADMIN (ZCC, operações globais).
 * @example
 * export const GET = withAdminGuard(async ({ session }) => { ... });
 */
export function withAdminGuard<T = any>(
  options: Omit<GuardOptions<T>, 'role'> = {},
  handler: GuardedHandler<T>
) {
  return withApiGuard<T>({ ...options, role: 'ADMIN' }, handler);
}

/**
 * Guard para rotas de tenant (DDC, operações do cliente).
 * Exige tenantId na sessão.
 * @example
 * export const POST = withTenantGuard(
 *   { schema: z.object({ name: z.string() }) },
 *   async ({ tenantId, body }) => { ... }
 * );
 */
export function withTenantGuard<T = any>(
  options: Omit<GuardOptions<T>, 'role'> = {},
  handler: GuardedHandler<T>
) {
  return withApiGuard<T>({ ...options, role: 'TENANT_USER' }, handler);
}

/**
 * Guard para rotas de cron job.
 * Não exige sessão NextAuth, mas exige CRON_SECRET no header Authorization.
 * @example
 * export const GET = withCronGuard(async () => { ... });
 */
export function withCronGuard<T = any>(
  handler: (context: { requestId: string }) => Promise<NextResponse | Response>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const requestId = req.headers.get('x-request-id')
      || `cron-${Date.now().toString(36)}`;

    // Valida CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret && process.env.NODE_ENV === 'production') {
      console.error('[CRON_GUARD] CRON_SECRET não configurado em produção');
      return NextResponse.json(
        { error: 'SERVICE_UNAVAILABLE', message: 'CRON_SECRET não configurado' },
        { status: 503 }
      );
    }

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        // Tenta x-internal-token também (compatibilidade)
        const internalToken = req.headers.get('x-internal-token');
        if (!internalToken || internalToken !== cronSecret) {
          return NextResponse.json(
            { error: 'UNAUTHORIZED' },
            { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
          );
        }
      }
    }

    // Em dev sem CRON_SECRET, permite (para testes manuais)
    try {
      return await handler({ requestId });
    } catch (error) {
      console.error('[CRON_GUARD] Error:', error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}

/**
 * Guard para webhooks (HMAC verification).
 * Não exige sessão, mas valida assinatura HMAC.
 * @example
 * export const POST = withWebhookGuard(
 *   { secretEnv: 'META_APP_SECRET', headerName: 'x-hub-signature-256' },
 *   async ({ req, requestId }) => { ... }
 * );
 */
export function withWebhookGuard(
  options: {
    secretEnv: string;
    headerName?: string;
    format?: 'sha256=' | 'v1=' | 'raw';
  },
  handler: (context: { req: NextRequest; requestId: string }) => Promise<NextResponse | Response>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const requestId = req.headers.get('x-request-id')
      || `webhook-${Date.now().toString(36)}`;

    const secret = process.env[options.secretEnv];
    if (!secret && process.env.NODE_ENV === 'production') {
      console.error(`[WEBHOOK_GUARD] ${options.secretEnv} não configurado`);
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Em dev sem secret, permite
    if (!secret) {
      try {
        return await handler({ req, requestId });
      } catch (error) {
        console.error('[WEBHOOK_GUARD] Error:', error);
        return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
      }
    }

    // Verifica assinatura HMAC
    const headerName = options.headerName || 'x-hub-signature-256';
    const signature = req.headers.get(headerName);

    if (!signature) {
      return NextResponse.json({ error: 'MISSING_SIGNATURE' }, { status: 401 });
    }

    try {
      const rawBody = await req.text();

      // Importa verificador apropriado
      const { verifyWhatsAppWebhook, verifyMercadoPagoWebhook } = await import('./webhook-verify');

      const format = options.format || 'sha256=';
      let valid = false;

      if (format === 'sha256=') {
        valid = verifyWhatsAppWebhook(rawBody, signature, secret).valid;
      } else if (format === 'v1=') {
        valid = verifyMercadoPagoWebhook(rawBody, signature, secret).valid;
      } else {
        // raw comparison (timing-safe)
        const crypto = await import('crypto');
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      }

      if (!valid) {
        console.warn(`[WEBHOOK_GUARD] Assinatura inválida: ${headerName}`);
        return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
      }

      // Re-wrap body para o handler (já foi consumido pelo .text())
      const clonedReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: rawBody,
      });

      return await handler({ req: clonedReq, requestId });
    } catch (error) {
      console.error('[WEBHOOK_GUARD] Error:', error);
      return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
  };
}
