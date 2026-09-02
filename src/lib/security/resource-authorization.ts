/**
 * RESOURCE AUTHORIZATION — IDOR / BOLA boundary.
 * Resource access is valid only when the authenticated tenant owns the resource.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export class ResourceAccessDeniedError extends Error {
  public readonly resourceName: string;
  public readonly expectedTenantId: string;

  constructor(resourceName: string, expectedTenantId: string) {
    super(`Acesso proibido ao recurso ${resourceName}.`);
    this.name = 'ResourceAccessDeniedError';
    this.resourceName = resourceName;
    this.expectedTenantId = expectedTenantId;
  }
}

type TenantOwnedResource = { tenantId?: unknown; tenant_id?: unknown } | null | undefined;

function normalizeTenantId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Fail closed: missing resource or missing/mismatched ownership is never authorized. */
export function assertResourceBelongsToTenant(params: {
  resource: TenantOwnedResource;
  tenantId: string;
  resourceName?: string;
}): true {
  const { resource, tenantId, resourceName = 'Recurso' } = params;
  if (!tenantId || !resource) {
    throw new ResourceAccessDeniedError(resourceName, tenantId);
  }

  const resourceTenantId = normalizeTenantId(resource.tenantId) ?? normalizeTenantId(resource.tenant_id);
  if (!resourceTenantId || resourceTenantId !== tenantId) {
    // Never log the foreign tenant ID. It is sensitive authorization metadata.
    logger.warn('[RESOURCE_AUTH] Cross-tenant resource access blocked', { resourceName });
    throw new ResourceAccessDeniedError(resourceName, tenantId);
  }
  return true;
}

/** Non-throwing predicate for guards that need to branch without exposing ownership. */
export function resourceBelongsToTenant(resource: TenantOwnedResource, tenantId: string): boolean {
  if (!resource || !tenantId) return false;
  const resourceTenantId = normalizeTenantId(resource.tenantId) ?? normalizeTenantId(resource.tenant_id);
  return resourceTenantId === tenantId;
}

export function createResourceForbiddenResponse(resourceName = 'Recurso'): NextResponse {
  return NextResponse.json(
    { error: `${resourceName} não encontrado ou acesso não autorizado para este tenant.`, code: 'FORBIDDEN_RESOURCE_ACCESS' },
    { status: 403 },
  );
}
