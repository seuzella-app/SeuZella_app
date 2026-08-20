/**
 * ============================================================================
 * 🛡️ SECURITY CONTEXT — Modelo Unificado de Contexto de Segurança
 * ============================================================================
 * Centraliza a identidade do chamador, tenant autenticado, role, IP e metadados
 * imutáveis para todo o ciclo de vida da requisição.
 *
 * Princípio Zero Trust:
 * "Nenhuma API confia em tenantId fornecido pelo cliente. O tenant emana
 *  estritamente da sessão autenticada ou do token criptográfico."
 * ============================================================================
 */

export const TENANT_ROLES = ['owner', 'admin', 'staff', 'client'] as const;
export type TenantRole = typeof TENANT_ROLES[number];

export const AUTH_TYPES = ['session', 'zcc-admin', 'm2m', 'webhook', 'public'] as const;
export type AuthType = typeof AUTH_TYPES[number];

export interface SecurityContext {
  requestId: string;
  userId: string | null;
  tenantId: string | null;
  role: TenantRole | null;
  authType: AuthType;
  clientIp: string;
  userAgent: string | null;
  issuedAt: string;
}

export function createAnonymousContext(clientIp = '127.0.0.1', userAgent?: string | null, requestId?: string): SecurityContext {
  return {
    requestId: requestId || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    userId: null,
    tenantId: null,
    role: null,
    authType: 'public',
    clientIp,
    userAgent: userAgent || null,
    issuedAt: new Date().toISOString(),
  };
}

export function createAuthenticatedContext(params: {
  userId: string;
  tenantId: string;
  role: TenantRole;
  authType: AuthType;
  clientIp: string;
  userAgent?: string | null;
  requestId?: string;
}): SecurityContext {
  return {
    requestId: params.requestId || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    userId: params.userId,
    tenantId: params.tenantId,
    role: params.role,
    authType: params.authType,
    clientIp: params.clientIp,
    userAgent: params.userAgent || null,
    issuedAt: new Date().toISOString(),
  };
}
