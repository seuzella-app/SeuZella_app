import { describe, expect, it } from 'vitest';
import { TENANT_MODELS } from '@/lib/db/tenant-prisma';

describe('Tenant isolation matrix enforcement', () => {
  it('enforces exactly the 72 approved tenant-scoped models', () => {
    expect(TENANT_MODELS).toHaveLength(72);
    expect(new Set(TENANT_MODELS).size).toBe(72);
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
