// tests/locks/alexa-adapter.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlexaLockService, AlexaSmartHomeDirective } from '@/lib/locks/alexa-adapter';
import { db } from '@/lib/db';
import { LockOrchestrator } from '@/lib/locks/orchestrator';

vi.mock('@/lib/db', () => ({
  db: {
    lockDevice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/locks/orchestrator', () => ({
  LockOrchestrator: {
    remoteLock: vi.fn(),
    remoteUnlock: vi.fn(),
  },
}));

describe('🔒 Alexa Smart Home Skill — LockController Tests', () => {
  const tenantA = 'tenant_pousada_rosa';
  const tenantB = 'tenant_airbnb_juquehy';
  const mockUserId = 'user_alexa_001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar apenas as fechaduras do tenant autenticado no Discovery', async () => {
    vi.mocked(db.lockDevice.findMany).mockResolvedValueOnce([
      { id: 'lock_01', nickname: 'Suíte Master', location: 'Quarto 01', brand: 'Nuki' },
      { id: 'lock_02', nickname: 'Chalé Mar', location: 'Chalé 02', brand: 'TTLock' },
    ] as any);

    const result = await AlexaLockService.handleDiscovery(tenantA, 'corr-token-123');

    expect(db.lockDevice.findMany).toHaveBeenCalledWith({
      where: { tenantId: tenantA, status: 'active' },
      select: { id: true, nickname: true, location: true, brand: true },
    });

    expect(result.event.header.name).toBe('Discover.Response');
    expect(result.event.payload.endpoints).toHaveLength(2);
    expect(result.event.payload.endpoints[0].endpointId).toBe('lock_01');
    expect(result.event.payload.endpoints[0].friendlyName).toBe('Fechadura Quarto 01');
  });

  it('deve executar o comando Lock com sucesso e emitir evento LOCKED', async () => {
    vi.mocked(db.lockDevice.findFirst).mockResolvedValueOnce({
      id: 'lock_01',
      tenantId: tenantA,
      nickname: 'Suíte Master',
    } as any);

    const directive: AlexaSmartHomeDirective = {
      header: {
        namespace: 'Alexa.LockController',
        name: 'Lock',
        payloadVersion: '3',
        messageId: 'msg-001',
        correlationToken: 'corr-001',
      },
      endpoint: { endpointId: 'lock_01' },
      payload: {},
    };

    const response = await AlexaLockService.handleControl(directive, tenantA, mockUserId) as any;

    expect(LockOrchestrator.remoteLock).toHaveBeenCalledWith({
      lockId: 'lock_01',
      tenantId: tenantA,
      actor: `ALEXA_VOICE:${mockUserId}`,
    });

    expect(response.context?.properties[0].value).toBe('LOCKED');
  });

  it('deve bloquear a tentativa de controlar fechadura de outro Tenant (Anti-IDOR)', async () => {
    // Fechadura pertence ao Tenant B, mas a sessão é do Tenant A
    vi.mocked(db.lockDevice.findFirst).mockResolvedValueOnce(null);

    const directive: AlexaSmartHomeDirective = {
      header: {
        namespace: 'Alexa.LockController',
        name: 'Unlock',
        payloadVersion: '3',
        messageId: 'msg-002',
      },
      endpoint: { endpointId: 'lock_tenant_b' },
      payload: {},
    };

    const response = await AlexaLockService.handleControl(directive, tenantA, mockUserId) as any;

    expect(LockOrchestrator.remoteUnlock).not.toHaveBeenCalled();
    expect(response.event.header.name).toBe('ErrorResponse');
    expect(response.event.payload.type).toBe('NO_SUCH_ENDPOINT');
  });
});
