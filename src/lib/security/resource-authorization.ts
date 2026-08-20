/**
 * ============================================================================
 * 🛡️ RESOURCE AUTHORIZATION — Prevenção de IDOR / BOLA
 * ============================================================================
 *
 * Garante que qualquer recurso acessado pertença comprovadamente ao tenant
 * do SecurityContext autenticado.
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export class ResourceAccessDeniedError extends Error {
  public resourceName: string;
  public expectedTenantId: string;
  public actualTenantId?: string;

  constructor(resourceName: string, expectedTenantId: string, actualTenantId?: string) {
    super(`Acesso proibido: o recurso ${resourceName} não pertence ao tenant ${expectedTenantId}.`);
    this.name = 'ResourceAccessDeniedError';
    this.resourceName = resourceName;
    this.expectedTenantId = expectedTenantId;
    this.actualTenantId = actualTenantId;
  }
}

/**
 * Valida a posse do recurso contra o tenantId autenticado.
 */
export function assertResourceBelongsToTenant(params: {
  resource: any;
  tenantId: string;
  resourceName?: string;
}): boolean {
  const { resource, tenantId, resourceName = 'Recurso' } = params;

  if (!resource) {
    return false;
  }

  const resourceTenantId = resource.tenantId || resource.tenant_id;

  if (!resourceTenantId || resourceTenantId !== tenantId) {
    logger.warn('[RESOURCE_AUTH] Tentativa de acesso cruzado (IDOR/BOLA) bloqueada', {
      resourceName,
      expectedTenantId: tenantId,
      actualTenantId: resourceTenantId,
    });

    throw new ResourceAccessDeniedError(resourceName, tenantId, resourceTenantId);
  }

  return true;
}

/**
 * Retorna resposta padrão 403 / 404 para violações de posse de recurso
 */
export function createResourceForbiddenResponse(resourceName = 'Recurso'): NextResponse {
  return NextResponse.json(
    {
      error: `${resourceName} não encontrado ou acesso não autorizado para este tenant.`,
      code: 'FORBIDDEN_RESOURCE_ACCESS',
    },
    { status: 403 }
  );
}
