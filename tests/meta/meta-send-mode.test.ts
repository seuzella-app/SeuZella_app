// ==============================================================================
// WhatsApp Send Mode — Fase 20.10 (unit tests)
// ==============================================================================
// REGRA CRÍTICA: mock NUNCA passa como sucesso real em produção.
//  - Produção sem credenciais → FALHA OPERACIONAL (success=false, isMock=false)
//  - Dev/teste sem credenciais → mock permitido explicitamente
//  - Credenciais presentes → live
// ==============================================================================
import { describe, it, expect } from 'vitest';
import { resolveSendMode } from '@/lib/whatsapp-send';

describe('🚦 resolveSendMode — mock rejection em produção (Fase 20)', () => {
  it('produção SEM credenciais → fail (nunca mock, nunca sucesso falso)', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'production',
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      ZELLA_ALLOW_WHATSAPP_MOCK: undefined,
    });
    expect(mode.mode).toBe('fail');
    if (mode.mode === 'fail') {
      expect(mode.reason).toBe('missing_credentials_in_production');
    }
  });

  it('dev SEM credenciais → mock permitido explicitamente', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'development',
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      ZELLA_ALLOW_WHATSAPP_MOCK: undefined,
    });
    expect(mode.mode).toBe('mock');
  });

  it('teste SEM credenciais → mock permitido', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'test',
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      ZELLA_ALLOW_WHATSAPP_MOCK: undefined,
    });
    expect(mode.mode).toBe('mock');
  });

  it('credenciais completas → live (produção)', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'production',
      WHATSAPP_ACCESS_TOKEN: 'EAAG-token',
      WHATSAPP_PHONE_NUMBER_ID: 'PN123',
      ZELLA_ALLOW_WHATSAPP_MOCK: undefined,
    });
    expect(mode.mode).toBe('live');
  });

  it('token sem phoneNumberId → NÃO é live (falha em produção)', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'production',
      WHATSAPP_ACCESS_TOKEN: 'EAAG-token',
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      ZELLA_ALLOW_WHATSAPP_MOCK: undefined,
    });
    expect(mode.mode).toBe('fail');
  });

  it('mock forçado em produção exige env explícita ZELLA_ALLOW_WHATSAPP_MOCK=true', () => {
    const mode = resolveSendMode({
      NODE_ENV: 'production',
      WHATSAPP_ACCESS_TOKEN: undefined,
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      ZELLA_ALLOW_WHATSAPP_MOCK: 'true',
    });
    // Apenas com opt-in explícito é que o mock é aceito (demo isolada).
    expect(mode.mode).toBe('mock');
  });
});
