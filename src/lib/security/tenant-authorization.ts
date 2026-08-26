/**
 * ============================================================================
 * 🛡️ TENANT AUTHORIZATION — Autorização Estrita Multi-Tenant
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { SecurityContext, TenantRole, createAuthenticatedContext, createAnonymousContext } from './security-context';
import { logger } from '@/lib/logger';

const ROLE_HIERARCHY: Record<TenantRole, number> = { owner: 4, admin: 3, staff: 2, client: 1 };

export interface TenantAuthOptions { requiredRole?: TenantRole; allowPublic?: boolean; }
export interface TenantAuthResult { allowed: boolean; context: SecurityContext; response?: NextResponse; }

export async function requireTenantAccess(request: NextRequest, options?: TenantAuthOptions): Promise<TenantAuthResult> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const userAgent = request.headers.get('user-agent');
  const requestId = request.headers.get('x-request-id') || `req_${Date.now().toString(36)}`;

  let session: any = null;
  try {
    session = await getServerSession(authOptions);
  } catch (err) {
    logger.error('[TENANT_AUTH] Falha ao obter sessão; fail-closed:', { error: (err as any)?.message, requestId });
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'AUTHENTICATION_UNAVAILABLE', requestId }, { status: 503 }) };
    }
  }

  const authHeader = request.headers.get('authorization');
  if (!session && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (process.env.ZCC_ADMIN_TOKEN && token === process.env.ZCC_ADMIN_TOKEN) {
      return { allowed: true, context: createAuthenticatedContext({ userId: 'zcc-admin-system', tenantId: 'system', role: 'owner', authType: 'zcc-admin', clientIp, userAgent, requestId }) };
    }
  }

  const userEmail = session?.user?.email;
  const sessionTenantId = session?.user?.tenantId;
  if (!userEmail && !sessionTenantId) {
    if (options?.allowPublic) return { allowed: true, context: createAnonymousContext(clientIp, userAgent, requestId) };
    return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHENTICATED' }, { status: 401 }) };
  }

  let tenantId = sessionTenantId as string | undefined;
  const userRole: TenantRole = (session?.user?.role as TenantRole) || 'client';
  const sessionUserId = session?.user?.id as string | undefined;

  try {
    if (!tenantId) {
      const tenant = userEmail ? await db.tenant.findUnique({ where: { email: userEmail.trim().toLowerCase() } }) : null;
      tenantId = tenant?.id;
    } else {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) tenantId = undefined;
      else if (tenant.status === 'suspended' || tenant.status === 'churned') {
        return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'Tenant suspenso ou inativo.', code: 'TENANT_SUSPENDED' }, { status: 403 }) };
      }
    }

    // A JWT tenantId is not sufficient by itself. For ordinary sessions,
    // verify that the persisted user record still belongs to the same tenant.
    // This prevents a stale/reassigned account from carrying an old tenantId.
    if (tenantId && sessionUserId && userRole !== ('system_admin' as TenantRole)) {
      const persistedUser = await db.user.findUnique({ where: { id: sessionUserId }, select: { tenantId: true } });
      if (!persistedUser?.tenantId || persistedUser.tenantId !== tenantId) {
        logger.warn('[TENANT_AUTH] Session/user tenant mismatch; denying access', { requestId, sessionUserId, tenantId, persistedTenantId: persistedUser?.tenantId });
        return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'Tenant inválido.', code: 'TENANT_MISMATCH', requestId }, { status: 403 }) };
      }
    }
  } catch (err) {
    logger.error('[TENANT_AUTH] Falha ao validar tenant; fail-closed:', { error: (err as any)?.message, requestId });
    return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'TENANT_AUTH_UNAVAILABLE', requestId }, { status: 503 }) };
  }

  if (!tenantId) {
    return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'Tenant não encontrado.', code: 'TENANT_NOT_FOUND' }, { status: 403 }) };
  }

  if (options?.requiredRole && ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[options.requiredRole]) {
    return { allowed: false, context: createAnonymousContext(clientIp, userAgent, requestId), response: NextResponse.json({ error: 'Permissão insuficiente.', code: 'INSUFFICIENT_ROLE' }, { status: 403 }) };
  }

  return { allowed: true, context: createAuthenticatedContext({ userId: session?.user?.id || userEmail || 'user_authenticated', tenantId, role: userRole, authType: 'session', clientIp, userAgent, requestId }) };
}
