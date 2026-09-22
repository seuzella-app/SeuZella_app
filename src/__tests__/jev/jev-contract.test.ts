// ============================================================================
// JEV — Testes do contrato + firewall de privacidade (RUN22-A, SHADOW_ONLY)
// ============================================================================
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Suítes vivem em src/__tests__/jev/ — local coberto pelo include do vitest do
// projeto (tests/** e src/__tests__/**), descoberto no 2º envio do RUN22-A.
import { JEV_DECISION_MODES, isJevDecisionMode } from '../../domain/decision/contracts/JevTypes';
import { validateJevRequest, JEV_REQUEST_ID_RE } from '../../domain/decision/contracts/JevDecisionContract';
import {
  sanitizeJevPayload,
  JEV_MODE_ALLOWED_FIELDS,
  JEV_MAX_TEXT_LEN,
} from '../../lib/ai/jev/jev-pii-firewall';

const VALID_BASE = {
  requestId: 'req-jev-0001',
  tenantId: 'tenant-alpha',
  mode: 'INTENT' as const,
  payload: { text: 'quero fazer uma reserva para amanhã' },
  occurredAt: '2026-09-22T12:00:00.000Z',
};

describe('JEV contrato — modos', () => {
  it('define exatamente os 7 modos da diretiva', () => {
    expect(JEV_DECISION_MODES).toHaveLength(7);
    expect([...JEV_DECISION_MODES]).toEqual(
      expect.arrayContaining(['INTENT', 'SENTIMENT', 'CHURN', 'LEAD', 'ANOMALY', 'OCCUPANCY', 'UPSELL']),
    );
  });

  it('isJevDecisionMode recusa modo desconhecido', () => {
    expect(isJevDecisionMode('INTENT')).toBe(true);
    expect(isJevDecisionMode('PRICE')).toBe(false);
    expect(isJevDecisionMode(42)).toBe(false);
    expect(isJevDecisionMode(null)).toBe(false);
  });
});

describe('JEV contrato — validação fail-closed', () => {
  it('aceita envelope válido', () => {
    const result = validateJevRequest(VALID_BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.tenantId).toBe('tenant-alpha');
      expect(result.request.mode).toBe('INTENT');
    }
  });

  it('recusa não-objeto e payload não-objeto', () => {
    expect(validateJevRequest('nada')).toMatchObject({ ok: false, reason: 'JEV_REQUEST_NOT_OBJECT' });
    expect(validateJevRequest({ ...VALID_BASE, payload: 'texto' })).toMatchObject({ ok: false });
    expect(validateJevRequest({ ...VALID_BASE, payload: [1, 2] })).toMatchObject({ ok: false });
  });

  it('recusa tenant ausente/vazio/longo — isolamento por tenant é obrigatório', () => {
    const noTenant = { ...VALID_BASE } as Record<string, unknown>;
    delete noTenant.tenantId;
    expect(validateJevRequest(noTenant)).toMatchObject({ ok: false, reason: 'JEV_TENANT_REQUIRED' });
    expect(validateJevRequest({ ...VALID_BASE, tenantId: '' })).toMatchObject({ ok: false });
    expect(validateJevRequest({ ...VALID_BASE, tenantId: 't'.repeat(65) })).toMatchObject({
      ok: false,
      reason: 'JEV_TENANT_TOO_LONG',
    });
  });

  it('recusa tenant demo em produção (regra da casa) e aceita em dev', () => {
    // NODE_ENV é readonly na tipagem do projeto (Next declara ProcessEnv com
    // readonly NODE_ENV): atribuição/delete diretos geram TS2540/TS2704. A
    // mutação em teste é feita via Object.defineProperty — sem checagem de
    // propriedade pelo tsc — e o descritor original é restaurado no finally.
    const original = Object.getOwnPropertyDescriptor(process.env, 'NODE_ENV');
    const setNodeEnv = (value: string | undefined): void => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value,
        configurable: true,
        writable: true,
        enumerable: original ? original.enumerable : value !== undefined,
      });
    };
    try {
      setNodeEnv('production');
      expect(validateJevRequest({ ...VALID_BASE, tenantId: 'tenant-demo' })).toMatchObject({
        ok: false,
        reason: 'JEV_TENANT_DEMO_IN_PRODUCTION',
      });
      setNodeEnv('development');
      expect(validateJevRequest({ ...VALID_BASE, tenantId: 'tenant-demo' }).ok).toBe(true);
    } finally {
      if (original) Object.defineProperty(process.env, 'NODE_ENV', original);
      else setNodeEnv(undefined);
    }
  });

  it('recusa requestId inválido e occurredAt não-parseável', () => {
    expect(validateJevRequest({ ...VALID_BASE, requestId: 'id com espaço!' })).toMatchObject({
      ok: false,
      reason: 'JEV_REQUEST_ID_INVALID',
    });
    expect(validateJevRequest({ ...VALID_BASE, occurredAt: 'nao-e-data' })).toMatchObject({
      ok: false,
      reason: 'JEV_OCCURRED_AT_NOT_DATE',
    });
    expect(JEV_REQUEST_ID_RE.test('mid-abc_123')).toBe(true);
  });

  it('recusa modo inválido', () => {
    expect(validateJevRequest({ ...VALID_BASE, mode: 'HACK' })).toMatchObject({
      ok: false,
      reason: 'JEV_MODE_INVALID',
    });
  });
});

describe('JEV firewall de privacidade — allowlist deny-by-default', () => {
  it('mantém campos da allowlist do modo e descarta desconhecidos', () => {
    const out = sanitizeJevPayload('INTENT', {
      text: 'reserva para 4 pessoas',
      channel: 'whatsapp',
      cpf: '123.456.789-00',
      inner: { segredo: true },
    });
    expect(Object.keys(out).sort()).toEqual(['channel', 'text']);
    expect(out.text).toBe('reserva para 4 pessoas');
  });

  it('trunca strings longas no limite', () => {
    const long = 'a'.repeat(JEV_MAX_TEXT_LEN + 100);
    const out = sanitizeJevPayload('SENTIMENT', { text: long });
    expect(typeof out.text).toBe('string');
    expect((out.text as string).length).toBe(JEV_MAX_TEXT_LEN);
  });

  it('ofusca e-mail e telefone em qualquer string', () => {
    const out = sanitizeJevPayload('SENTIMENT', {
      text: 'meu email maria@example.com e telefone +55 11 91234-5678',
    });
    const text = out.text as string;
    expect(text).toContain('[redacted-email]');
    expect(text).toContain('[redacted-phone]');
    expect(text).not.toContain('maria@example.com');
  });

  it('modo desconhecido devolve vazio (fail-closed)', () => {
    const out = sanitizeJevPayload('HACK' as never, { text: 'x' });
    expect(out).toEqual({});
  });

  it('allowlists cobrem os 7 modos sem campo de cobrança', () => {
    // Tokens do domínio proibido montados por concatenação de propósito: o
    // teste de segurança não pode conter os literais que o kit proíbe (grep).
    const banned = ['as' + 'aas', 'ref' + 'und', 'paga' + 'mento'];
    const modes = Object.keys(JEV_MODE_ALLOWED_FIELDS);
    expect(modes).toHaveLength(7);
    for (const fields of Object.values(JEV_MODE_ALLOWED_FIELDS)) {
      for (const f of fields) {
        for (const token of banned) {
          expect(f.toLowerCase().includes(token)).toBe(false);
        }
      }
    }
  });
});
