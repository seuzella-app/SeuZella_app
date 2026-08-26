import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('DELTA-2 / C1 — Checkout Paths & Code Contract Audit', () => {
  it('26. /api/checkout/cancel: enforces session tenant isolation', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/checkout/cancel/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('session.user.tenantId');
    expect(code).toContain('subscription.tenantId !== session.user.tenantId');
  });

  it('27. /api/checkout/upgrade: enforces session tenant boundary', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/checkout/upgrade/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('session.user.tenantId');
    expect(code).toContain('tenantId !== session.user.tenantId');
  });

  it('28. /api/checkout/pix-status: enforces payment ownership verification against tenant', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/checkout/pix-status/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('subscription.tenantId !== tenantId');
  });

  it('29. /api/checkout/success: enforces HMAC signature and session tenant verification', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/checkout/success/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('subscription.tenantId !== session.user.tenantId');
    expect(code).toContain('timingSafeEqual');
  });

  it('30. /api/properties/[id]: GET combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('session.user.tenantId');
    expect(code).toContain('tenantId: session.user.tenantId');
  });

  it('31. /api/properties/[id]: PUT combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
    expect(code).toContain('findFirst');
    expect(code).toContain('where: { id, tenantId: session.user.tenantId }');
  });

  it('32. /api/properties/[id]: DELETE combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
    expect(code).toContain('findFirst');
    expect(code).toContain('where: { id, tenantId: session.user.tenantId }');
  });

  it('33. /api/targets/[id]: GET combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
    expect(code).toContain('getServerSession');
    expect(code).toContain('where: { id, tenantId: session.user.tenantId }');
  });

  it('34. /api/targets/[id]: PUT combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
    expect(code).toContain('findFirst');
    expect(code).toContain('tenantId: session.user.tenantId');
  });

  it('35. /api/targets/[id]: DELETE combines resource id and session tenantId', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
    expect(code).toContain('findFirst');
    expect(code).toContain('tenantId: session.user.tenantId');
  });

  it('36. /api/ddc/conversations/[id]: GET scopes query to tenant context', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/ddc/conversations/[id]/route.ts'), 'utf8');
    expect(code).toContain('guard()');
    expect(code).toContain('tenantId: g');
  });

  it('37. /api/ddc/conversations/[id]: PATCH checks tenant ownership before mutation', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/ddc/conversations/[id]/route.ts'), 'utf8');
    expect(code).toContain('findFirst');
    expect(code).toContain('where: { id, tenantId: g }');
  });

  it('38. No raw findUnique on multi-tenant property detail in /api/properties/[id]', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
    expect(code).not.toContain('db.airBProperty.findUnique');
  });

  it('39. No raw findUnique on multi-tenant target detail in /api/targets/[id]', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
    expect(code).not.toContain('db.target.findUnique');
  });

  it('40. No raw findUnique on multi-tenant conversation detail in /api/ddc/conversations/[id]', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'src/app/api/ddc/conversations/[id]/route.ts'), 'utf8');
    expect(code).not.toContain('db.conversationLog.findUnique');
  });

  it('41. Error responses do not leak cross-tenant existence across C1 endpoints', () => {
    const propCode = fs.readFileSync(path.join(process.cwd(), 'src/app/api/properties/[id]/route.ts'), 'utf8');
    const targetCode = fs.readFileSync(path.join(process.cwd(), 'src/app/api/targets/[id]/route.ts'), 'utf8');
    const convCode = fs.readFileSync(path.join(process.cwd(), 'src/app/api/ddc/conversations/[id]/route.ts'), 'utf8');
    expect(propCode).toContain('status: 404');
    expect(targetCode).toContain('status: 404');
    expect(convCode).toContain('NOT_FOUND');
  });
});
