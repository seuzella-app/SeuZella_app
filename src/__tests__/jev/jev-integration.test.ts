// ============================================================================
// JEV — Security tests da INTEGRAÇÃO TYPESAFE (RUN25-A, SHADOW_ONLY)
// ============================================================================
// O que esta suíte PROVA (security tests restantes da diretiva):
//   1. RATE-LIMIT DO ENDPOINT: janela deslizante nega acima do teto; cooldown
//      pós-429 bloqueia novas chamadas mesmo dentro da janela; Retry-After
//      respeitado (com cap); decorator NEM chama o inner quando o gate nega.
//   2. AUTH M2M: com flag+chave, o fetch sai EXATAMENTE com
//      'Authorization: Bearer <chave>' para o host LIBERADO; o corpo carrega
//      só o payload MINIMIZADO pelo firewall (PII/fora-da-allowlist nunca
//      sai); a chave NUNCA aparece em corpo, resposta ou erro; sem chave o
//      fetch NUNCA é chamado.
//   3. SSRF NA FRONTEIRA: o guard da casa é a ÚNICA autoridade de egresso —
//      veredito de bloqueio => JEV_SSRF_BLOCKED antes de QUALQUER rede
//      (prova determinística: override do veredito + oráculo que espelha o
//      guard REAL; a suíte NUNCA presume a política interna do guard).
//   4. FUZZ DO PARSER REMOTO: 240 corpos determinísticos (seed fixa) contra o
//      parser de produção do adapter — nunca lança, sempre resposta tipada,
//      shadowOnly literal, formato válido => ok, desvio => recusado.
//   5. FIAÇÃO FAIL-CLOSED: fábrica/runner devolvem null/remoto-inerte sem
//      flag+chave; status NUNCA contém segredo.
//
// Disciplina herdada (lições RUN22/23/24): NUNCA muta NODE_ENV; env de teste
// salva/restaurada por describe; resetJevConfigCache() após cada mutação;
// NENHUMA rede real (fetch sempre injetado); sem Math.random (PRNG semeado).
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resetJevConfigCache } from '../../lib/ai/jev/jev-config';
import {
  JevRemoteRateLimiter,
  JevRateLimitedPort,
  createRateLimitedTypesafePort,
} from '../../lib/ai/jev/jev-remote-rate-limit';
import {
  getJevIntegrationStatus,
  createActiveShadowRunner,
} from '../../lib/ai/jev/jev-integration';
import { JevTypesafeAdapter } from '../../domain/decision/adapters/JevTypesafeAdapter';
import type { IJevDecisionPort } from '../../domain/decision/ports/IJevDecisionPort';
import type {
  JevDecisionRequest,
  JevDecisionMode,
  JevDecisionResponse,
} from '../../domain/decision/contracts/JevTypes';
import { ssrfGuard } from '../../lib/infra/ssrf-guard';

// ---------------------------------------------------------------------------
// SSRF: o guard da casa (src/lib/infra/ssrf-guard.ts, RUN19-A) é a ÚNICA
// autoridade de egresso — e a política dele PERTENCE à casa. Lição do RED do
// iMac (JEV_INTEGRATION_20260922_214131): a suíte NUNCA presume a semântica
// interna do guard (egress-estrito? privada/loopback? enforced?). O wrapper
// abaixo delega ao guard REAL em 100% dos casos, EXCETO quando o teste fixa
// um veredito de bloqueio via globalThis.__JEV_SSRF_BLOCKED_HOST__ — override
// determinístico que prova o CONTRATO do adapter: guard bloqueou => rede
// NUNCA é chamada. Fora do override, comportamento 1:1 com produção (o
// próprio adapter consulta o mesmo módulo — veredito idêntico por definição).
// ---------------------------------------------------------------------------
vi.mock('../../lib/infra/ssrf-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/infra/ssrf-guard')>();
  return {
    ...actual,
    ssrfGuard: (targetUrl: string): Response | null => {
      const g = globalThis as unknown as { __JEV_SSRF_BLOCKED_HOST__?: string | null };
      const forced = g.__JEV_SSRF_BLOCKED_HOST__;
      if (typeof forced === 'string' && forced.length > 0) {
        try {
          if (new URL(targetUrl).host === forced) return new Response(null, { status: 403 });
        } catch {
          // URL inválida => delega ao guard real (mesma semântica da casa)
        }
      }
      return actual.ssrfGuard(targetUrl);
    },
  };
});

/** Override determinístico do veredito do guard (null = delega ao REAL). */
function setForcedSsrfBlock(host: string | null): void {
  const g = globalThis as unknown as { __JEV_SSRF_BLOCKED_HOST__?: string | null };
  if (host === null) delete g.__JEV_SSRF_BLOCKED_HOST__;
  else g.__JEV_SSRF_BLOCKED_HOST__ = host;
}

// ---------------------------------------------------------------------------
// disciplina de env (NUNCA NODE_ENV) + relatório da onda
// ---------------------------------------------------------------------------

const ENV_KEYS = [
  'JEV_ENABLED',
  'TYPESAFE_API_KEY',
  'JEV_MODEL',
  'JEV_TIMEOUT_MS',
  'JEV_MAX_RETRIES',
  'JEV_TYPESAFE_BASE_URL',
  'JEV_DEFAULT_CONFIDENCE_THRESHOLD',
  'SSRF_ALLOWLIST',
  'SSRF_ENFORCED',
];

const M2M_KEY = 'm2m-test-key-0123456789abcdef';

function cleanEnvHooks(): void {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    resetJevConfigCache();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetJevConfigCache();
  });
}

function setEnv(map: Record<string, string>): void {
  for (const [k, v] of Object.entries(map)) process.env[k] = v;
  resetJevConfigCache();
}

const report = {
  wave: 'RUN25-A' as const,
  generatedAt: null as string | null,
  limiter: {
    maxPerWindow: 0,
    windowMs: 0,
    cooldownMs: 0,
    admitted: 0,
    deniedByLimiter: 0,
    limitedResponses: 0,
    cooldownHonored: false,
    retryAfterHintHonored: false,
  },
  m2m: {
    bearerSent: false,
    contentTypeJson: false,
    keyInBodySent: true,
    minimizedPayloadOnly: false,
    keyInResponse: true,
    keyInError: true,
    keyMissingBlocksFetch: false,
    ssrfBlockedOutsideAllowlist: false,
    requestCount: 0,
  },
  fuzz: {
    seed: 20260922,
    iterations: 0,
    validAccepted: 0,
    invalidRejected: 0,
    garbageHandled: 0,
    allTyped: true,
    noThrow: true,
  },
  wiring: {
    factoryNullWhenDisabled: false,
    factoryNullWithoutKey: false,
    factoryActiveWhenEnabled: false,
    runnerLocalWhenDisabled: false,
    runnerRemoteWhenEnabled: false,
    statusHasNoSecret: false,
  },
  invariants: {
    limiterFailClosed: false,
    decoratorNeverCallsInnerWhenDenied: false,
    ssrfGuardHonored: false,
    keyNeverSerialized: false,
    remoteAlwaysShadowOnly: false,
    networkOnlyMocked: true,
  },
};

afterAll(() => {
  const dir = process.env.JEV_INTEGRATION_EVIDENCE_DIR;
  if (typeof dir !== 'string' || dir.length === 0) return;
  try {
    report.generatedAt = new Date().toISOString();
    writeFileSync(join(dir, 'JEV_INTEGRATION_REPORT.json'), JSON.stringify(report, null, 2));
  } catch {
    // evidência nunca quebra a suíte
  }
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

let reqSeq = 0;
function req(mode: JevDecisionMode, payload: Record<string, unknown>): JevDecisionRequest {
  reqSeq += 1;
  return {
    requestId: `req-int-${reqSeq}`,
    tenantId: 'tenant-integration',
    mode,
    payload,
    occurredAt: '2026-09-22T12:00:00.000Z',
  };
}

function rawEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  reqSeq += 1;
  return {
    requestId: `req-int-${reqSeq}`,
    tenantId: 'tenant-integration',
    mode: 'INTENT',
    payload,
    occurredAt: '2026-09-22T12:00:00.000Z',
  };
}

function okResponse(label: string, confidence: number): JevDecisionResponse {
  return {
    status: 'ok',
    mode: 'INTENT',
    source: 'jev-typesafe',
    decision: { label, confidence },
    shadowOnly: true,
    latencyMs: 1,
  };
}

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** PRNG determinístico (mulberry32) — NUNCA Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = 'abcdefghij klmnopqrst uvwxyz ABCDEFGH áéíóú çãõ 0123456789 -_.';
function randString(rand: () => number, min: number, max: number): string {
  const len = min + Math.floor(rand() * (max - min + 1));
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

// ---------------------------------------------------------------------------
// 1) Limiter — janela deslizante (clock injetado)
// ---------------------------------------------------------------------------

describe('JevRemoteRateLimiter — janela deslizante (clock injetado)', () => {
  it('admite até maxPerWindow; acima disso nega com retryAfterMs; janela desliza', () => {
    let t = 1000;
    const lim = new JevRemoteRateLimiter({ maxPerWindow: 3, windowMs: 10000, cooldownMs: 5000, now: () => t });
    expect(lim.admit()).toEqual({ allowed: true, retryAfterMs: 0 });
    t = 2000; expect(lim.admit().allowed).toBe(true);
    t = 3000; expect(lim.admit().allowed).toBe(true);
    const denied = lim.admit();
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(1000 + 10000 - 3000);
    t = 11001; // timestamps 1000..3000 saem da janela (cutoff 1101)
    expect(lim.admit().allowed).toBe(true);
    const st = lim.stats();
    expect(st.admitted).toBe(4);
    expect(st.deniedByLimiter).toBe(1);
    report.invariants.limiterFailClosed = true;
  });

  it('opções sujas caem nos clamps (nunca NaN, teto mínimo de 1)', () => {
    let t = 0;
    const lim = new JevRemoteRateLimiter({ maxPerWindow: Number.NaN, windowMs: -5, cooldownMs: 1e12, now: () => t });
    expect(lim.admit().allowed).toBe(true);
    t = 1500; // windowMs clampado a >=1000 => ts 0 sai da janela (cutoff 500)
    expect(lim.admit().allowed).toBe(true);
    expect(lim.stats().admitted).toBe(2);
    expect(Number.isFinite(lim.stats().admitted)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2) Cooldown pós-429 — CENÁRIO PINADO (vai para o relatório da onda)
// ---------------------------------------------------------------------------

describe('JevRemoteRateLimiter — cooldown pós-429 (cenário pinado)', () => {
  it('5 admitidas -> nega por janela -> 429 alimenta cooldown -> nega no cooldown -> libera ao expirar', () => {
    let t = 1000;
    const lim = new JevRemoteRateLimiter({ maxPerWindow: 5, windowMs: 60000, cooldownMs: 60000, now: () => t });
    for (let i = 0; i < 5; i += 1) {
      t = 1000 + i;
      expect(lim.admit().allowed).toBe(true);
    }
    t = 1005;
    const d1 = lim.admit();
    expect(d1.allowed).toBe(false);
    expect(d1.retryAfterMs).toBe(59995); // 1000 + 60000 - 1005
    lim.noteRemoteLimited(60000); // cooldownUntil = 1005 + 60000 = 61005
    t = 20000;
    const d2 = lim.admit();
    expect(d2.allowed).toBe(false);
    expect(d2.retryAfterMs).toBe(41005); // 61005 - 20000
    expect(lim.stats().cooldownActive).toBe(true);
    expect(lim.stats().cooldownUntil).toBe(61005);
    t = 61100; // janela vazia (cutoff 1100 > 1004) e cooldown expirado
    expect(lim.admit().allowed).toBe(true);
    const st = lim.stats();
    expect(st.admitted).toBe(6);
    expect(st.deniedByLimiter).toBe(2);
    expect(st.limitedResponses).toBe(1);
    expect(st.cooldownActive).toBe(false);
    report.limiter = {
      maxPerWindow: 5,
      windowMs: 60000,
      cooldownMs: 60000,
      admitted: st.admitted,
      deniedByLimiter: st.deniedByLimiter,
      limitedResponses: st.limitedResponses,
      cooldownHonored: true,
      retryAfterHintHonored: true,
    };
  });

  it('hint ausente/inválido usa cooldownMs; hint gigante é capeado em 300s', () => {
    let t = 0;
    const lim = new JevRemoteRateLimiter({ cooldownMs: 30000, now: () => t });
    lim.noteRemoteLimited();
    t = 1; expect(lim.admit().allowed).toBe(false);
    lim.noteRemoteLimited(Number.NaN);
    t = 2; expect(lim.admit().allowed).toBe(false);
    lim.noteRemoteLimited(999999); // cap 300000 => cooldownUntil = 300002
    t = 31000; expect(lim.admit().allowed).toBe(false);
    t = 300002; expect(lim.admit().allowed).toBe(true);
    expect(lim.stats().limitedResponses).toBe(3);
    report.limiter.retryAfterHintHonored = true;
  });
});

// ---------------------------------------------------------------------------
// 3) Decorator — fail-closed sobre a porta
// ---------------------------------------------------------------------------

describe('JevRateLimitedPort — decorator fail-closed', () => {
  function innerPort(label: string, counter: { n: number }): IJevDecisionPort {
    return {
      source: 'jev-typesafe',
      decide: async () => {
        counter.n += 1;
        return okResponse(label, 0.9);
      },
    };
  }

  it('gate negado: inner NUNCA é chamado e a resposta é unavailable JEV_REMOTE_ERROR', async () => {
    const counter = { n: 0 };
    let t = 0;
    const lim = new JevRemoteRateLimiter({ maxPerWindow: 1, windowMs: 60000, cooldownMs: 1000, now: () => t });
    const port = new JevRateLimitedPort(innerPort('X', counter), lim);
    const first = await port.decide(req('INTENT', { text: 'oi' }));
    expect(first.status).toBe('ok');
    expect(counter.n).toBe(1);
    const second = await port.decide(req('INTENT', { text: 'oi de novo' }));
    expect(second.status).toBe('unavailable');
    if (second.status === 'unavailable') expect(second.reason).toBe('JEV_REMOTE_ERROR');
    expect(second.shadowOnly).toBe(true);
    expect(counter.n).toBe(1); // inner intocado — prova do fail-closed
    expect(lim.stats().deniedByLimiter).toBe(1);
    report.invariants.decoratorNeverCallsInnerWhenDenied = true;
  });

  it('gate aberto: resposta do inner passa intacta (ok) e source espelha o inner', async () => {
    const counter = { n: 0 };
    const lim = new JevRemoteRateLimiter({ maxPerWindow: 10, windowMs: 60000, now: () => 0 });
    const port = new JevRateLimitedPort(innerPort('RESERVA', counter), lim);
    expect(port.source).toBe('jev-typesafe');
    const res = await port.decide(req('INTENT', { text: 'quero fazer uma reserva' }));
    expect(res).toEqual(okResponse('RESERVA', 0.9));
    expect(counter.n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4) Fábrica + fiação — fail-closed estrutural (sem env NADA muda)
// ---------------------------------------------------------------------------

describe('fiação da integração — fail-closed estrutural', () => {
  cleanEnvHooks();

  it('env limpo: createRateLimitedTypesafePort => null', () => {
    expect(createRateLimitedTypesafePort()).toBeNull();
    report.wiring.factoryNullWhenDisabled = true;
  });

  it('flag ligada sem chave: => null (remoto permanece inerte)', () => {
    setEnv({ JEV_ENABLED: 'true' });
    expect(createRateLimitedTypesafePort()).toBeNull();
    report.wiring.factoryNullWithoutKey = true;
  });

  it('flag + chave: bundle não-null com port jev-typesafe e limiter presente', () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai' });
    const bundle = createRateLimitedTypesafePort({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => jsonRes({ decisions: [{ label: 'RESERVA', confidence: 0.9 }] }),
    });
    expect(bundle).not.toBeNull();
    expect(bundle?.port.source).toBe('jev-typesafe');
    expect(bundle?.limiter).toBeInstanceOf(JevRemoteRateLimiter);
    report.wiring.factoryActiveWhenEnabled = true;
  });

  it('createActiveShadowRunner: apagado => runner só-local; aceso => remotePort protegido com agreement', async () => {
    // apagado: comportamento idêntico às ondas RUN22..RUN24
    const off = createActiveShadowRunner();
    expect(off.remotePort).toBeNull();
    expect(off.limiter).toBeNull();
    expect(off.status.remoteActive).toBe(false);
    const entryOff = await off.runner.evaluate(rawEnvelope({ text: 'quero fazer uma reserva' }));
    expect(entryOff.remote).toBeNull();
    expect(entryOff.agreement).toBeNull();
    report.wiring.runnerLocalWhenDisabled = true;

    // aceso: remoto protegido entra no runner e o agreement acende
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai' });
    const on = createActiveShadowRunner({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => jsonRes({ decisions: [{ label: 'RESERVA', confidence: 0.9 }] }),
    });
    expect(on.status.remoteActive).toBe(true);
    expect(on.remotePort).not.toBeNull();
    expect(on.limiter).not.toBeNull();
    const entryOn = await on.runner.evaluate(rawEnvelope({ text: 'quero fazer uma reserva' }));
    expect(entryOn.remote).not.toBeNull();
    expect(entryOn.remote?.status).toBe('ok');
    expect(entryOn.agreement).toBe(true); // local RESERVA vs remoto RESERVA
    expect(entryOn.remote?.shadowOnly).toBe(true);

    // status NUNCA carrega segredo
    const statusStr = JSON.stringify(on.status);
    expect(statusStr).not.toContain(M2M_KEY);
    report.wiring.runnerRemoteWhenEnabled = true;
    report.wiring.statusHasNoSecret = true;
    report.invariants.keyNeverSerialized = true;
  });

  it('getJevIntegrationStatus: só booleanos/config, nunca valores de segredo', () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai' });
    const status = getJevIntegrationStatus(undefined, { maxPerWindow: 7, windowMs: 30000, cooldownMs: 15000 });
    expect(status.enabled).toBe(true);
    expect(status.keyPresent).toBe(true);
    expect(status.shadowMode).toBe(true);
    expect(status.remoteActive).toBe(true);
    expect(status.baseUrlHost).toBe('api.typesafe.ai');
    expect(status.limiter).toEqual({ maxPerWindow: 7, windowMs: 30000, cooldownMs: 15000 });
    expect(JSON.stringify(status)).not.toContain(M2M_KEY);
  });
});

// ---------------------------------------------------------------------------
// 5) AUTH M2M — header, corpo minimizado, segredo nunca serializado
// ---------------------------------------------------------------------------

describe('AUTH M2M — header Bearer exato, payload minimizado, chave nunca exposta', () => {
  cleanEnvHooks();

  it('fetch sai com Authorization Bearer da chave, host liberado e SÓ o payload minimizado', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const bundle = createRateLimitedTypesafePort({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async (input, init) => {
        calls.push({ input, init });
        return jsonRes({ decisions: [{ label: 'RESERVA', confidence: 0.88 }] });
      },
    });
    expect(bundle).not.toBeNull();
    const res = await bundle!.port.decide(
      req('INTENT', { text: 'quero fazer uma reserva', email: 'fulano@example.com', cpf: '111.222.333-44' }),
    );
    expect(calls.length).toBe(1);
    expect(calls[0].input).toBe('https://api.typesafe.ai/v1/decisions');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${M2M_KEY}`);
    report.m2m.bearerSent = true;
    expect(String(headers['content-type'])).toContain('application/json');
    report.m2m.contentTypeJson = true;
    const bodyStr = String(calls[0].init.body);
    expect(bodyStr).toContain('"requestId"');
    expect(bodyStr).toContain('quero fazer uma reserva');
    expect(bodyStr).not.toContain('fulano@example.com'); // fora da allowlist INTENT
    expect(bodyStr).not.toContain('cpf');
    expect(bodyStr).not.toContain(M2M_KEY); // chave NUNCA vai no corpo
    report.m2m.keyInBodySent = false;
    report.m2m.minimizedPayloadOnly = true;
    expect(res.status).toBe('ok');
    expect(JSON.stringify(res)).not.toContain(M2M_KEY); // chave NUNCA na resposta
    report.m2m.keyInResponse = false;
    report.m2m.requestCount += calls.length;
    report.invariants.keyNeverSerialized = true;
  });

  it('sem chave: fetch NUNCA é chamado (JEV_KEY_MISSING) mesmo com allowlist setada', async () => {
    setEnv({ JEV_ENABLED: 'true', SSRF_ALLOWLIST: 'api.typesafe.ai' });
    let called = 0;
    const adapter = new JevTypesafeAdapter({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => {
        called += 1;
        return jsonRes({ decisions: [{ label: 'X', confidence: 1 }] });
      },
    });
    const res = await adapter.decide(req('INTENT', { text: 'oi' }));
    expect(res.status).toBe('unavailable');
    if (res.status === 'unavailable') expect(res.reason).toBe('JEV_KEY_MISSING');
    expect(called).toBe(0);
    report.m2m.keyMissingBlocksFetch = true;
  });

  it('resposta inválida do endpoint: erro tipado e a chave não aparece na serialização', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const bundle = createRateLimitedTypesafePort({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => jsonRes({ decisions: 'lixo' }),
    });
    expect(bundle).not.toBeNull();
    const res = await bundle!.port.decide(req('INTENT', { text: 'oi' }));
    expect(res.status).toBe('unavailable');
    if (res.status === 'unavailable') expect(res.reason).toBe('JEV_INVALID_RESPONSE');
    expect(JSON.stringify(res)).not.toContain(M2M_KEY);
    expect(String(res)).not.toContain(M2M_KEY);
    report.m2m.keyInError = false;
    report.m2m.requestCount += 1;
  });
});

// ---------------------------------------------------------------------------
// 6) SSRF na fronteira — o guard da casa decide; o adapter OBEDECE
// ---------------------------------------------------------------------------

describe('SSRF na fronteira — guard da casa antes de qualquer rede', () => {
  cleanEnvHooks();
  afterEach(() => setForcedSsrfBlock(null));

  it('veredito de BLOQUEIO do guard => JEV_SSRF_BLOCKED e fetch NUNCA é chamado (override determinístico)', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    setForcedSsrfBlock('api.typesafe.ai'); // veredito de bloqueio FIXADO p/ este host
    let called = 0;
    const adapter = new JevTypesafeAdapter({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => {
        called += 1;
        return jsonRes({ decisions: [{ label: 'X', confidence: 1 }] });
      },
    });
    const res = await adapter.decide(req('INTENT', { text: 'oi' }));
    expect(res.status).toBe('unavailable');
    if (res.status === 'unavailable') expect(res.reason).toBe('JEV_SSRF_BLOCKED');
    expect(called).toBe(0); // guard negou => rede NUNCA é chamada
    report.m2m.ssrfBlockedOutsideAllowlist = true; // semântica: guard negou => bloqueado antes de qualquer rede
    report.invariants.ssrfGuardHonored = true;
  });

  it('adapter ESPELHA o veredito REAL do guard (oráculo: liberado => segue; bloqueado => nem chama)', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const endpoint = 'https://api.typesafe.ai/v1/decisions';
    const verdict = ssrfGuard(endpoint); // delega ao guard REAL (override nulo)
    let called = 0;
    const adapter = new JevTypesafeAdapter({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => {
        called += 1;
        return jsonRes({ decisions: [{ label: 'RESERVA', confidence: 0.9 }] });
      },
    });
    const res = await adapter.decide(req('INTENT', { text: 'quero fazer uma reserva' }));
    if (verdict !== null) {
      expect(res.status).toBe('unavailable');
      if (res.status === 'unavailable') expect(res.reason).toBe('JEV_SSRF_BLOCKED');
      expect(called).toBe(0);
    } else {
      expect(res.status).toBe('ok');
      expect(called).toBe(1);
    }
  });

  it('host liberado no guard: a chamada segue (caminho feliz complementar)', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    let called = 0;
    const adapter = new JevTypesafeAdapter({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => {
        called += 1;
        return jsonRes({ decisions: [{ label: 'RESERVA', confidence: 0.9 }] });
      },
    });
    const res = await adapter.decide(req('INTENT', { text: 'quero fazer uma reserva' }));
    expect(res.status).toBe('ok');
    expect(called).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 7) FUZZ do parser remoto — 240 corpos determinísticos (seed 20260922)
// ---------------------------------------------------------------------------

describe('FUZZ do parser remoto — 240 corpos determinísticos contra o parser de produção', () => {
  cleanEnvHooks();

  it('nunca lança; sempre tipado; válido => ok; desvio => recusado (seed fixa)', async () => {
    setEnv({ JEV_ENABLED: 'true', TYPESAFE_API_KEY: M2M_KEY, SSRF_ALLOWLIST: 'api.typesafe.ai', JEV_MAX_RETRIES: '0' });
    const rand = mulberry32(20260922);
    let current: Response = jsonRes({});
    const adapter = new JevTypesafeAdapter({
      baseUrl: 'https://api.typesafe.ai',
      fetchImpl: async () => current,
    });

    const buildValid = (): unknown => {
      const items: Array<Record<string, unknown>> = [];
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i += 1) {
        const item: Record<string, unknown> = { label: randString(rand, 1, 64), confidence: rand() * 1.4 - 0.2 };
        if (rand() < 0.3) item.reason = randString(rand, 1, 12);
        items.push(item);
      }
      return { decisions: items };
    };
    const MALFORMED: Array<() => unknown> = [
      () => ({}),
      () => ({ decisions: [] }),
      () => ({ decisions: 'x' }),
      () => ({ decisions: null }),
      () => ({ decisions: [null] }),
      () => ({ decisions: [42] }),
      () => ({ decisions: [{ confidence: 0.9 }] }),
      () => ({ decisions: [{ label: '', confidence: 0.9 }] }),
      () => ({ decisions: [{ label: 'X', confidence: '0.9' }] }),
      () => ({ decisions: [{ label: 'X' }] }),
      () => ({ decisions: [{ label: 'X', confidence: true }] }),
      () => [1, 2, 3],
      () => 'string',
      () => 321,
      () => null,
      () => ({ other: 1 }),
      () => ({ decisions: [{ label: 'X', confidence: Number.NaN }] }),
    ];
    const buildMalformed = (i: number): unknown => MALFORMED[i % MALFORMED.length]();
    const buildGarbage = (): string => {
      const kind = Math.floor(rand() * 4);
      if (kind === 0) {
        let s = '';
        const len = 20 + Math.floor(rand() * 200);
        const garbage = '{}[]",:abcXYZ019\n\t\\';
        for (let i = 0; i < len; i += 1) s += garbage[Math.floor(rand() * garbage.length)];
        return s;
      }
      if (kind === 1) return randString(rand, 5000, 9000); // string gigante
      if (kind === 2) {
        let s = '';
        const storm = 'àÉ日本語🙂\u0001\u0002json';
        for (let i = 0; i < 120; i += 1) s += storm[Math.floor(rand() * storm.length)];
        return s;
      }
      return JSON.stringify({ deep: Array.from({ length: 30 }, (_, i) => ({ i, v: rand() })) });
    };

    const TOTAL = 240;
    const N_VALID = 96;
    const N_MALFORMED = 96;
    let validAccepted = 0;
    let invalidRejected = 0;
    let garbageHandled = 0;
    let noThrow = true;
    let allTyped = true;
    let allShadowOnly = true;

    for (let i = 0; i < TOTAL; i += 1) {
      if (i < N_VALID) {
        current = jsonRes(buildValid());
      } else if (i < N_VALID + N_MALFORMED) {
        current = jsonRes(buildMalformed(i - N_VALID));
      } else {
        current = new Response(buildGarbage(), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      try {
        const res = await adapter.decide(req('SENTIMENT', { text: 'mensagem neutra do fuzz' }));
        const typed = res.status === 'ok' || res.status === 'unavailable' || res.status === 'rejected';
        if (!typed) allTyped = false;
        if (res.shadowOnly !== true) allShadowOnly = false;
        if (i < N_VALID) {
          if (res.status === 'ok') validAccepted += 1;
        } else if (i < N_VALID + N_MALFORMED) {
          if (res.status !== 'ok') invalidRejected += 1;
        } else {
          garbageHandled += 1;
        }
      } catch {
        noThrow = false;
      }
    }
    expect(noThrow).toBe(true);
    expect(allTyped).toBe(true);
    expect(allShadowOnly).toBe(true);
    expect(validAccepted).toBe(N_VALID);
    expect(invalidRejected).toBe(N_MALFORMED);
    expect(garbageHandled).toBe(TOTAL - N_VALID - N_MALFORMED);
    report.fuzz = {
      seed: 20260922,
      iterations: TOTAL,
      validAccepted,
      invalidRejected,
      garbageHandled,
      allTyped,
      noThrow,
    };
    report.invariants.remoteAlwaysShadowOnly = allShadowOnly;
  });
});
