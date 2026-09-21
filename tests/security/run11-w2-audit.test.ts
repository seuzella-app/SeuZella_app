import { describe, it, expect } from 'vitest';
import { audit, redactValue } from '../../src/lib/infra/audit';

/**
 * RUN11-W2 — invariantes da trilha de auditoria (cronograma 11D):
 * who/what/when/tenant/resource/result/correlationId presentes;
 * senha/token/segredo/PII REDIGIDOS por chave e por valor.
 */

describe('RUN11-W2 audit — shape do evento', () => {
  it('emite JSON line com todos os campos do contrato 11D', () => {
    const lines: string[] = [];
    audit(
      {
        who: 'user:u-1',
        what: 'booking.create',
        tenantId: 'tenant-9',
        resource: 'booking/42',
        result: 'ALLOW',
        meta: { ip: '10.0.0.1' },
      },
      (l) => lines.push(l),
    );
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]) as Record<string, unknown>;
    for (const k of ['ts', 'who', 'what', 'tenantId', 'resource', 'result', 'correlationId']) {
      expect(rec[k], `campo ${k} presente`).toBeTruthy();
    }
    expect(String(rec.ts)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(String(rec.correlationId)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('correlationId informado é preservado (rastreabilidade ponta a ponta)', () => {
    const lines: string[] = [];
    audit({ who: 'system', what: 'cron.tick', result: 'OK', correlationId: 'corr-abc' }, (l) => lines.push(l));
    expect(JSON.parse(lines[0]).correlationId).toBe('corr-abc');
  });

  it('when informado é respeitado; meta ausente não quebra', () => {
    const lines: string[] = [];
    audit({ who: 'x', what: 'y', result: 'DENY', when: '2026-09-19T10:00:00.000Z' }, (l) => lines.push(l));
    expect(JSON.parse(lines[0]).meta).toBeUndefined();
    expect(JSON.parse(lines[0]).ts).toBe('2026-09-19T10:00:00.000Z');
  });
});

describe('RUN11-W2 audit — redação por chave e por valor', () => {
  it('campos sensíveis por NOME viram [REDACTED:key]', () => {
    const out = redactValue({
      password: 'supersecret',
      accessToken: 'eyJhbGciOi.abc.def',
      api_key: 'qualquer',
      Authorization: 'Bearer abc.def.ghi',
      SessionCookie: 'x',
      nested: { SECRET: 'y', safe: 'ok' },
    }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED:key]');
    expect(out.accessToken).toBe('[REDACTED:key]');
    expect(out.api_key).toBe('[REDACTED:key]');
    expect(out.Authorization).toBe('[REDACTED:key]');
    expect(out.SessionCookie).toBe('[REDACTED:key]');
    expect((out.nested as Record<string, unknown>).SECRET).toBe('[REDACTED:key]');
    expect((out.nested as Record<string, unknown>).safe).toBe('ok');
  });

  it('padrões vendor no VALOR são mascarados (sk-, eyJ, AIza, gsk_, Bearer)', () => {
    const out = redactValue({
      note: 'chave exposta sk-proj-4vZh8sTkQ2mNe7RbXw1YcD9fGhJ3kLp no log',
      jwt: 'payload eyJhbGciOiJIUzI1NiJ9.e30.assim',
      gkey: 'AIzaSyA1234567890abcdefghijklmnopqrstuv',
      groq: 'gsk_1234567890abcdefghij',
      auth: 'Bearer abcdefghijklmnop',
    }) as Record<string, string>;
    expect(out.note).not.toContain('sk-proj-4vZh');
    expect(out.note).toContain('[REDACTED:vendor-key]');
    expect(out.jwt).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(out.jwt).toContain('[REDACTED:jwt-like]');
    expect(out.gkey).toContain('[REDACTED:google-key]');
    expect(out.groq).toContain('[REDACTED:groq-key]');
    expect(out.auth).toContain('[REDACTED:bearer]');
  });

  it('linhas auditadas NUNCA contêm o segredo original (prova ponta a ponta)', () => {
    const lines: string[] = [];
    audit(
      {
        who: 'user:u-2',
        what: 'ai.chat',
        result: 'ERROR',
        meta: { err: 'Falhou com sk-proj-4vZh8sTkQ2mNe7RbXw1YcD9fGhJ3kLp em trânsito' },
      },
      (l) => lines.push(l),
    );
    expect(lines[0]).not.toContain('sk-proj-4vZh8sTkQ2mNe7RbXw1YcD9fGhJ3kLp');
    expect(lines[0]).toContain('[REDACTED:vendor-key]');
  });

  it('strings gigantes são truncadas; ciclos não travam', () => {
    const big = 'a'.repeat(10_000);
    const out = redactValue({ big }) as { big: string };
    expect(out.big.length).toBeLessThanOrEqual(4096 + 20);
    const cyc: Record<string, unknown> = { name: 'n' };
    cyc.self = cyc;
    const out2 = redactValue(cyc) as Record<string, unknown>;
    expect(out2.self).toBe('[CIRCULAR]');
  });
});
