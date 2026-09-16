import { describe, expect, it } from 'vitest';
import { TENANT_MODELS } from '@/lib/db/tenant-prisma';

describe('Tenant isolation matrix enforcement', () => {
  // Onda correção/hardening: 68 → 70 — MetaConnection e MetaAttributionEvent
  // passam a ter guard de tenant no Prisma extension (auditoria FASE 4).
  it('enforces exactly the 70 approved tenant-scoped models', () => {
    expect(TENANT_MODELS).toHaveLength(70);
    expect(new Set(TENANT_MODELS).size).toBe(70);
  });

  it('includes newly classified operational tenant models', () => {
    for (const model of [
      'CostLog',
      'Booking',
      'TrainingPrompt',
      'Notification',
      'PushSubscription',
      'GraphNode',
      'GraphEdge',
      'CerebroWorkflow',
      'PolicyAudit',
      'MetaConnection',
      'MetaAttributionEvent',
      'MetaCostLog',
    ]) {
      expect(TENANT_MODELS).toContain(model);
    }
  });

  it('does not auto-scope explicitly global administration/auth models or removed phantoms', () => {
    for (const model of ['User', 'ZCCAccessLog', 'GuestRegistration']) {
      expect(TENANT_MODELS).not.toContain(model);
    }
  });
});
