/**
 * ============================================================================
 * SEU ZELLA — E2E REAL GATE (KIT POSV2 v1) — E2E-REAL-001..010
 * ============================================================================
 * Cronograma Mestre, Fase F6 (Business E2E real). Regra do dono:
 *   "INDEPENDENTE DE TER CREDENCIAIS, CONCLUIR OS CÓDIGOS PARA DEPOIS EDITAR
 *    COM TUDO QUE ESTIVER FALTANDO."
 *
 * Como isto funciona (FAIL-CLOSED EM DUPLA PORTA):
 *   PORTA 1 (credencial): cada suite só é executada se E2E_REAL=1 E as
 *     credenciais daquela frente estão presentes no ambiente. Sem isso,
 *     os testes são PULADOS (suite permanece verde — nada finge).
 *   PORTA 2 (edição do dono): cada E2E termina num passo marcado
 *     PREENCHER_APOS_CREDENCIAL que lança E2E_PENDING_OWNER_EDIT se o dono
 *     ainda não editou o bloco indicado. Ou seja: MESMO com credencial
 *     exportada, o teste não "meio-roda" — ele para num marcador claro,
 *     esperando a edição final do dono (payload específico da conta, etc.).
 *
 * PARA ATIVAR UM E2E (após ter as credenciais):
 *   1. Exporte as credenciais da frente (ver runbook 04_RUNBOOK_CREDENCIAIS).
 *   2. Rode com E2E_REAL=1.
 *   3. Edite os blocos marcados PREENCHER_APOS_CREDENCIAL conforme a conta
 *      real (número de teste, plano real, payload do gateway contratado).
 *   4. Remova o throw E2E_PENDING_OWNER_EDIT do bloco que editou.
 * ============================================================================
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  CredentialMissingError,
  requireCredential,
} from "../../src/lib/credentials/credential-registry";

// ---------- Porta 1: gate ambiental ----------
const E2E_REAL_ENABLED = process.env.E2E_REAL === "1";

function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Suite só roda se E2E_REAL=1 E todas as envs exigidas presentes. */
function describeReal(name: string, requiredEnvs: string[], body: () => void) {
  const ready = E2E_REAL_ENABLED && requiredEnvs.every(hasEnv);
  const scoped = ready ? describe : describe.skip;
  return scoped(name, () => {
    // Defesa extra: mesmo que alguém remova o .skip, sem E2E_REAL nada roda.
    beforeEach(() => {
      if (!E2E_REAL_ENABLED) {
        throw new Error("E2E real exige E2E_REAL=1 (fail-closed)");
      }
    });
    body();
  });
}

/** Porta 2: marcador de edição do dono. */
class E2E_PENDING_OWNER_EDIT extends Error {
  constructor(bloco: string, instrucao: string) {
    super(
      `[PREENCHER_APOS_CREDENCIAL] Bloco: ${bloco}. ` +
        `Edite o teste conforme a instrução e remova este throw. ` +
        `Instrução: ${instrucao}`,
    );
    this.name = "E2E_PENDING_OWNER_EDIT";
  }
}

beforeEach(() => {
  // (defesa movida para dentro de describeReal — suites guarda-chuva rodam sempre)
});

// ============================================================================
// E2E-REAL-001 — Handshake do webhook Meta (GET hub.challenge)
// Frente: WhatsApp/Meta · Credenciais: META_APP_SECRET, META_VERIFY_TOKEN,
//         WHATSAPP_PHONE_NUMBER_ID
// ============================================================================
describeReal(
  "E2E-REAL-001: handshake webhook Meta",
  ["META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  () => {
    it("verify token bate e hub.challenge é ecoado", async () => {
      const verifyToken = requireCredential("META_VERIFY_TOKEN");
      const base = process.env.E2E_BASE_URL; // ex.: https://staging.seuzella.com.br
      if (!base) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-001/base-url", "defina E2E_BASE_URL apontando para o ambiente com o webhook Meta real");
      const res = await fetch(`${base}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=DesafioReal123`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("DesafioReal123");
    });
  },
);

// ============================================================================
// E2E-REAL-002 — Envio real WhatsApp Cloud API
// ============================================================================
describeReal("E2E-REAL-002: envio WhatsApp Cloud API", ["META_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], () => {
  it("mensagem de teste chega no número aprovado", async () => {
    const token = requireCredential("META_ACCESS_TOKEN");
    const phoneId = requireCredential("WHATSAPP_PHONE_NUMBER_ID");
    const to = process.env.E2E_WHATSAPP_TO; // número aprovado do dono
    if (!to) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-002/destino", "defina E2E_WHATSAPP_TO com o número de teste aprovado na Meta");
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: "[E2E-REAL-002] smoke test Seu Zélla" },
      }),
    });
    expect(res.status).toBeLessThan(300);
    const json = (await res.json()) as { messages?: unknown[] };
    expect(Array.isArray(json.messages)).toBe(true);
  });
});

// ============================================================================
// E2E-REAL-003 — Assinatura X-Hub-Signature-256 (webhook de mensagem)
// ============================================================================
describeReal("E2E-REAL-003: assinatura X-Hub-Signature-256", ["META_APP_SECRET"], () => {
  it("payload não assinado é REJEITADO (fail-closed) e assinado aceito", async () => {
    const appSecret = requireCredential("META_APP_SECRET");
    const base = process.env.E2E_BASE_URL;
    if (!base) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-003/base-url", "defina E2E_BASE_URL");
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    // Fail-closed primeiro: sem assinatura => 401/403
    const bad = await fetch(`${base}/api/webhooks/meta`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    expect([401, 403]).toContain(bad.status);
    // Assinado (HMAC SHA-256 do payload com o app secret)
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", appSecret).update(payload).digest("hex");
    const good = await fetch(`${base}/api/webhooks/meta`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${sig}` },
      body: payload,
    });
    expect(good.status).toBeLessThan(300);
  });
});

// ============================================================================
// E2E-REAL-004 — Checkout real no gateway contratado
// ============================================================================
describeReal("E2E-REAL-004: checkout real gateway", ["PAYMENT_GATEWAY_NAME", "PAYMENT_GATEWAY_API_KEY"], () => {
  it("cria sessão/checkout real para o PARCEIRO R$247 (valor canônico intocado)", async () => {
    const gateway = requireCredential("PAYMENT_GATEWAY_NAME");
    const apiKey = requireCredential("PAYMENT_GATEWAY_API_KEY");
    const base = process.env.E2E_BASE_URL;
    if (!base) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-004/base-url", "defina E2E_BASE_URL");
    if (gateway === "mock") throw new Error("gateway mock é PROIBIDO em E2E real (F-03: MOCK_GATEWAY_FORBIDDEN)");
    // PREENCHER_APOS_CREDENCIAL: adapte ao gateway contratado (endpoint/payload).
    // Regra canônica: PARCEIRO = R$247 — não alterar; UPSELL não toca aqui.
    void apiKey;
    throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-004/payload", `implemente a chamada de checkout do gateway "${gateway}" com valor 24700 (centavos) e confirme redirect/URL de pagamento`);
  });
});

// ============================================================================
// E2E-REAL-005 — Webhook de pagamento: normalização → idempotência →
//                state machine → subscription → tenant access (corrente única)
// ============================================================================
describeReal("E2E-REAL-005: webhook pagamento ponta a ponta", ["PAYMENT_GATEWAY_WEBHOOK_SECRET"], () => {
  it("replay do mesmo evento NÃO estende período (invariante financeiro)", async () => {
    requireCredential("PAYMENT_GATEWAY_WEBHOOK_SECRET");
    const base = process.env.E2E_BASE_URL;
    if (!base) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-005/base-url", "defina E2E_BASE_URL");
    throw new E2E_PENDING_OWNER_EDIT(
      "E2E-REAL-005/evento",
      "gere 1 pagamento real de teste no gateway, capture o payload do webhook, envie 2x para o endpoint real e prove: 2ª entrega é idempotente, planType/paymentStatus/period consistentes e periodEnd inalterado",
    );
  });
});

// ============================================================================
// E2E-REAL-006 — Provisionamento (provisionNewCustomer) ≠ ativação financeira
// ============================================================================
describeReal("E2E-REAL-006: provisionamento sem ativação", ["PAYMENT_GATEWAY_API_KEY"], () => {
  it("novo cliente provisionado fica SEM acesso financeiro até webhook confirmar", async () => {
    requireCredential("PAYMENT_GATEWAY_API_KEY");
    if (!process.env.E2E_BASE_URL) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-006/base-url", "defina E2E_BASE_URL");
    throw new E2E_PENDING_OWNER_EDIT(
      "E2E-REAL-006/fluxo",
      "crie assinatura por checkout real abandonado (sem pagamento) e prove que tenant existe provisionado mas sem recursos financeiros ativos",
    );
  });
});

// ============================================================================
// E2E-REAL-007 — Bundler: claim LPOP atômico + requeue (multi-instância)
// ============================================================================
describeReal("E2E-REAL-007: bundler LPOP atômico", ["QSTASH_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"], () => {
  it("duas instâncias nunca processam o mesmo item da fila", async () => {
    requireCredential("QSTASH_TOKEN");
    const redisUrl = requireCredential("UPSTASH_REDIS_REST_URL");
    const redisToken = requireCredential("UPSTASH_REDIS_REST_TOKEN");
    // LPOP é atômico por definição — o E2E prova o claim contra o Redis real
    const res = await fetch(`${redisUrl}/lpop/e2e_bundle_queue_test`, { headers: { Authorization: `Bearer ${redisToken}` } });
    // Fila de teste vazia => resposta esperada é null/404-ish; o que NÃO pode é 5xx de auth
    expect(res.status).toBeLessThan(500);
    throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-007/duas-instâncias", "popule a fila com 1 item, dispare 2 workers reais em paralelo e prove 1 processamento + 1 requeue no ttl BUNDLE_WINDOW_MS");
  });
});

// ============================================================================
// E2E-REAL-008 — WhatsApp fail-closed em produção (só VERIFIED/HEALTHY envia)
// ============================================================================
describeReal("E2E-REAL-008: WhatsApp fail-closed", ["META_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], () => {
  it("status degradado BLOQUEIA envio (não existe envio best-effort)", async () => {
    requireCredential("META_ACCESS_TOKEN");
    if (!process.env.E2E_BASE_URL) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-008/base-url", "defina E2E_BASE_URL");
    throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-008/health", "force o health do WhatsApp para DEGRADED no ambiente real e prove que a rota de envio responde fail-closed (sem envio, erro claro)");
  });
});

// ============================================================================
// E2E-REAL-009 — ZéLLM/Cérebro real
// ============================================================================
describeReal("E2E-REAL-009: ZéLLM-Cérebro", ["ZELLM_API_KEY"], () => {
  it("conversa real produce resposta dentro do contrato", async () => {
    requireCredential("ZELLM_API_KEY");
    if (!process.env.E2E_BASE_URL) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-009/base-url", "defina E2E_BASE_URL");
    throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-009/contrato", "envie 1 mensagem real pelo canal e valide o contrato de resposta do Cérebro (intenção, tenant, sem vazamento entre tenants)");
  });
});

// ============================================================================
// E2E-REAL-010 — Cron expiry-check com CRON_SECRET real (fail-closed)
// ============================================================================
describeReal("E2E-REAL-010: cron expiry-check autenticado", ["CRON_SECRET"], () => {
  it("sem header => 401; com header => 200 e job roda", async () => {
    const secret = requireCredential("CRON_SECRET");
    const base = process.env.E2E_BASE_URL;
    if (!base) throw new E2E_PENDING_OWNER_EDIT("E2E-REAL-010/base-url", "defina E2E_BASE_URL");
    const noAuth = await fetch(`${base}/api/cron/expiry-check`);
    expect([401, 403]).toContain(noAuth.status);
    const ok = await fetch(`${base}/api/cron/expiry-check`, { headers: { Authorization: `Bearer ${secret}` } });
    expect(ok.status).toBeLessThan(300);
  });
});

// ============================================================================
// Fechamento: CredentialMissingError nunca deve vazar como 500 opaco em E2E —
// é o marcador de que a PORTA 1 foi burlada. Teste guarda-chuva (roda SEMPRE).
// ============================================================================
describe("E2E gate guarda-chuva (roda sempre)", () => {
  it("sem E2E_REAL=1 o gate é fechado por construção", () => {
    if (process.env.E2E_REAL === "1") return; // em modo real, nada a provar aqui
    expect(E2E_REAL_ENABLED).toBe(false);
  });

  it("CredentialMissingError é o marcador da Porta 1 (mensagem acionável)", () => {
    const saved = process.env.META_ACCESS_TOKEN;
    delete process.env.META_ACCESS_TOKEN;
    try {
      requireCredential("META_ACCESS_TOKEN");
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(CredentialMissingError);
    } finally {
      if (saved !== undefined) process.env.META_ACCESS_TOKEN = saved;
    }
  });
});
