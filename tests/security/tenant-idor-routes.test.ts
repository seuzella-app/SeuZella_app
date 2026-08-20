import { describe, it, expect } from 'vitest';
import { assertResourceBelongsToTenant, ResourceAccessDeniedError } from '@/lib/security/resource-authorization';
import { requireTenantId, runWithTenant } from '@/lib/security/tenant-context';

describe('🏢 Tenant Isolation & Anti-IDOR Route Security (P1)', () => {
  it('deve bloquear com ResourceAccessDeniedError quando tenant A tenta acessar recurso de tenant B', () => {
    const bookingTenantB = {
      id: 'book_123',
      tenantId: 'tenant_pousada_mar',
      guestName: 'Hóspede B',
      totalValue: 1200,
    };

    expect(() => {
      assertResourceBelongsToTenant({
        resource: bookingTenantB,
        tenantId: 'tenant_pousada_sol',
        resourceName: 'Reserva',
      });
    }).toThrow(ResourceAccessDeniedError);
  });

  it('deve autorizar com sucesso quando tenant acessa seus próprios recursos', () => {
    const bookingTenantA = {
      id: 'book_456',
      tenantId: 'tenant_pousada_sol',
      guestName: 'Hóspede A',
      totalValue: 800,
    };

    expect(() => {
      assertResourceBelongsToTenant({
        resource: bookingTenantA,
        tenantId: 'tenant_pousada_sol',
        resourceName: 'Reserva',
      });
    }).not.toThrow();
  });

  it('deve isolar o tenantId no contexto assíncrono via runWithTenant', async () => {
    await runWithTenant('tenant_scoped_xyz', async () => {
      const activeTenant = await requireTenantId();
      expect(activeTenant).toBe('tenant_scoped_xyz');
    });
  });
});
