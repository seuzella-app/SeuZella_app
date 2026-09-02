import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync('src/lib/locks/system-pin-service.ts', 'utf8');

describe('reservation lock PIN service regression', () => {
  it('uses the canonical provider registry module API', () => {
    expect(source).toContain('const provider = getProviderModule(brand);');
    expect(source).toContain('const moduleInstance = provider?.module;');
    expect(source).toContain("typeof moduleInstance.generatePin !== 'function'");
    expect(source).toContain('await moduleInstance.generatePin({');
    expect(source).not.toContain('await provider.generatePin({');
  });

  it('keeps the generated PIN tenant-scoped', () => {
    expect(source).toContain('where: { id: input.deviceId, tenantId: input.tenantId, status: \'active\' }');
    expect(source).toContain('tenantId: input.tenantId');
  });

  it('records a lock audit event after reservation PIN creation', () => {
    expect(source).toContain("eventType: 'generated'");
    expect(source).toContain('reservationId: input.reservationId');
  });
});
