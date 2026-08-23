// src/lib/locks/alexa-adapter.ts
import { db } from '@/lib/db';
import { LockOrchestrator } from '@/lib/locks/orchestrator';
import crypto from 'crypto';

export interface AlexaDirectiveHeader {
  namespace: string;
  name: string;
  payloadVersion: string;
  messageId: string;
  correlationToken?: string;
}

export interface AlexaSmartHomeDirective {
  header: AlexaDirectiveHeader;
  endpoint?: {
    endpointId: string; // lockId no banco do Seu Zélla
    scope?: {
      type: 'BearerToken';
      token: string;
    };
    cookie?: Record<string, string>;
  };
  payload: any;
}

export class AlexaLockService {
  /**
   * 1. Alexa.Discovery — Retorna a lista de fechaduras do Tenant
   */
  static async handleDiscovery(tenantId: string, correlationToken?: string) {
    const locks = await db.lockDevice.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, nickname: true, location: true, brand: true },
    });

    const endpoints = (locks || []).map((lock: any) => ({
      endpointId: lock.id,
      manufacturerName: lock.brand || 'Seu Zélla Smart Lock',
      friendlyName: lock.location ? `Fechadura ${lock.location}` : lock.nickname,
      description: `Fechadura Inteligente controlada pelo Cérebro Zélla - Quarto ${lock.location || ''}`,
      displayCategories: ['SMARTLOCK'],
      capabilities: [
        {
          type: 'AlexaInterface',
          interface: 'Alexa.LockController',
          version: '3',
          properties: {
            supported: [{ name: 'lockState' }],
            proactivelyReported: true,
            retrievable: true,
          },
        },
        {
          type: 'AlexaInterface',
          interface: 'Alexa.EndpointHealth',
          version: '3',
          properties: {
            supported: [{ name: 'connectivity' }],
            proactivelyReported: true,
            retrievable: true,
          },
        },
      ],
    }));

    return {
      event: {
        header: {
          namespace: 'Alexa.Discovery',
          name: 'Discover.Response',
          payloadVersion: '3',
          messageId: crypto.randomUUID(),
        },
        payload: { endpoints },
      },
    };
  }

  /**
   * 2. Alexa.LockController — Trancar / Destrancar Fechadura
   */
  static async handleControl(
    directive: AlexaSmartHomeDirective,
    tenantId: string,
    userId: string
  ) {
    const lockId = directive.endpoint?.endpointId;
    const action = directive.header.name; // 'Lock' | 'Unlock'
    const correlationToken = directive.header.correlationToken;

    if (!lockId) {
      throw new Error('EndpointId ausente na diretiva Alexa');
    }

    // Validação de isolamento do dispositivo (Anti-IDOR / Multi-tenant)
    const lock = await db.lockDevice.findFirst({
      where: { id: lockId, tenantId },
    });

    if (!lock) {
      return this.buildErrorResponse(directive, 'NO_SUCH_ENDPOINT', 'Fechadura não encontrada');
    }

    let targetState: 'LOCKED' | 'UNLOCKED' = 'LOCKED';

    if (action === 'Lock') {
      await LockOrchestrator.remoteLock({
        lockId,
        tenantId,
        actor: `ALEXA_VOICE:${userId}`,
      });
      targetState = 'LOCKED';
    } else if (action === 'Unlock') {
      await LockOrchestrator.remoteUnlock({
        lockId,
        tenantId,
        actor: `ALEXA_VOICE:${userId}`,
      });
      targetState = 'UNLOCKED';
    }

    return {
      context: {
        properties: [
          {
            namespace: 'Alexa.LockController',
            name: 'lockState',
            value: targetState,
            timeOfSample: new Date().toISOString(),
            uncertaintyInMilliseconds: 200,
          },
        ],
      },
      event: {
        header: {
          namespace: 'Alexa',
          name: 'Response',
          payloadVersion: '3',
          messageId: crypto.randomUUID(),
          correlationToken,
        },
        endpoint: { endpointId: lockId },
        payload: {},
      },
    };
  }

  private static buildErrorResponse(
    directive: AlexaSmartHomeDirective,
    type: string,
    message: string
  ) {
    return {
      event: {
        header: {
          namespace: 'Alexa',
          name: 'ErrorResponse',
          payloadVersion: '3',
          messageId: crypto.randomUUID(),
          correlationToken: directive.header.correlationToken,
        },
        endpoint: { endpointId: directive.endpoint?.endpointId || 'unknown' },
        payload: { type, message },
      },
    };
  }

  /**
   * 3. Alexa State Report — Proactively reports lock state to Alexa.
   *
   * Called after a lock state change (lock/unlock via PIN or remote).
   * Alexa requires this to keep the Alexa app UI in sync with the physical
   * lock state.
   *
   * @param tenantId The tenant the lock belongs to
   * @param lockId The lock device ID
   * @param lockState 'LOCKED' | 'UNLOCKED'
   */
  static async handleStateReport(
    tenantId: string,
    lockId: string,
    lockState: 'LOCKED' | 'UNLOCKED',
  ) {
    return {
      event: {
        header: {
          namespace: 'Alexa',
          name: 'StateReport',
          payloadVersion: '3',
          messageId: crypto.randomUUID(),
        },
        endpoint: { endpointId: lockId },
        payload: {},
        context: {
          properties: [
            {
              namespace: 'Alexa.LockController',
              name: 'lockState',
              value: lockState,
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 0,
            },
            {
              namespace: 'Alexa.EndpointHealth',
              name: 'connectivity',
              value: { value: 'OK' },
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 0,
            },
          ],
        },
      },
    };
  }

  /**
   * 4. Alexa Health Check — Returns the connectivity state of a lock.
   * Called by Alexa when the user asks "is the lock connected?"
   */
  static async handleHealthCheck(tenantId: string, lockId: string) {
    const lock = await db.lockDevice.findFirst({
      where: { id: lockId, tenantId },
      select: { id: true, status: true },
    });

    if (!lock) {
      return {
        event: {
          header: {
            namespace: 'Alexa',
            name: 'ErrorResponse',
            payloadVersion: '3',
            messageId: crypto.randomUUID(),
          },
          payload: { type: 'NO_SUCH_ENDPOINT', message: 'Lock not found' },
        },
      };
    }

    const isOnline = lock.status === 'active';
    return {
      event: {
        header: {
          namespace: 'Alexa',
          name: 'StateReport',
          payloadVersion: '3',
          messageId: crypto.randomUUID(),
        },
        endpoint: { endpointId: lockId },
        payload: {},
        context: {
          properties: [
            {
              namespace: 'Alexa.EndpointHealth',
              name: 'connectivity',
              value: { value: isOnline ? 'OK' : 'UNREACHABLE' },
              timeOfSample: new Date().toISOString(),
              uncertaintyInMilliseconds: 0,
            },
          ],
        },
      },
    };
  }
}
