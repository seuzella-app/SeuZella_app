import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const tenantPrismaSource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/db/tenant-prisma.ts'),
  'utf8',
);
const idempotencySource = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/payments/idempotency.ts'),
  'utf8',
);

describe('Wave R2 — database hardening contracts', () => {
  it('does not classify relational child models without tenantId as direct tenant models', () => {
    const tenantModelsBlock = tenantPrismaSource.match(/const TENANT_MODELS = \[[\s\S]*?\] as const;/)?.[1] ?? '';

    expect(tenantModelsBlock).not.toContain("'PaymentTransaction'");
    expect(tenantModelsBlock).not.toContain("'ConversationMessage'");
    expect(tenantModelsBlock).not.toContain("'GuestMessage'");
    expect(tenantModelsBlock).not.toContain("'SwipeUsage'");
  });

  it('documents parent-derived isolation for child entities', () => {
    expect(tenantPrismaSource).toContain('tenant boundary is inherited through a parent relation');
    expect(tenantPrismaSource).toContain('tenant-bound parent lookups');
  });

  it('fails closed instead of executing billing when the durable idempotency store is unavailable', () => {
    expect(idempotencySource).toContain("throw new Error('BILLING_IDEMPOTENCY_UNAVAILABLE')");
    expect(idempotencySource).not.toContain('const result = await handler();\n    return {\n      success: true,\n      deduplicated: false,\n      status: \'completed\',\n      data: result,\n      key,\n    };');
  });

  it('keeps the production invariant explicit in the billing idempotency source', () => {
    expect(idempotencySource).toContain('Production invariant: absence of the idempotency store is a hard failure.');
    expect(idempotencySource).toContain('Executing a billing handler without durable idempotency can double-charge on retry.');
  });
});
