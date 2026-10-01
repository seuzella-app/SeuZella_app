import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import Redis from "ioredis";

// ============================================================================
// W1.1 — E2E-007 REAL v2 — FECHAMENTO CONTRA O CÓDIGO DE PRODUÇÃO
// ----------------------------------------------------------------------------
// Regra desta onda (W1.1 §5/§8): o teste NÃO reimplementa fila, lease, claim,
// requeue ou bundling. Ele atravessa as funções REAIS de produção:
//
//   - bufferMessage()                (src/lib/message-bundler.ts:269)
//       → caminho real da rota canônica /api/webhooks/whatsapp:795
//       → RPUSH + EXPIRE via Upstash REST + publish QStash com
//         Upstash-Delay = BUNDLE_WINDOW_MS/1000 e Upstash-Deduplication-Id
//   - handleFlushBufferRequest()     (src/lib/message-bundler.ts:550)
//       → handler real chamado por /api/internal/flush-buffer (route.ts:21)
//       → CLAIM ATÔMICO LPOP 100 (RBW Fase N) + concatenação '\n' +
//         requeue RPUSH de volta + EXPIRE renovado em falha do processor
//
// Infra REAL:
//   - redis-server REAL (RESP) detectado via E2E_REDIS_URL/TEST_REDIS_URL
//     ou localhost:6379 (equivalente a `redis-cli ping` — §13).
//   - Adaptador de TRANSPORTE local que replica SOMENTE os 4 endpoints
//     Upstash REST usados pelo bundler (pipeline/lpop/rpush/expire),
//     repassando os comandos ao redis-server real via ioredis.
//     A atomicidade do claim vem do ENGINE Redis real — nenhum estado de
//     fila é simulado em JavaScript. QStash é dupla de dependência externa
//     HTTP (invariante T2 do CLAUDE.md: mocks só para dependências externas).
//
// Sem Redis real: BLOCKED-INFRA honesto (skip visível, nunca fake GREEN).
// ============================================================================

// ── Constantes REAIS importadas de produção (proíbe sombra local) ──────────
import {
  BUNDLE_WINDOW_MS,
  BUNDLE_BUFFER_TTL_SECONDS,
  bufferMessage,
  handleFlushBufferRequest,
  buildFlushDeduplicationId,
  redisKey,
  resetBundlerStats,
  type BufferMessagePayload,
} from "@/lib/message-bundler";

// Tipo do processor EXTRAÍDO da assinatura real de produção (nunca redefinido).
type ProductionProcessor = Parameters<typeof bufferMessage>[1];

type RecordedPublish = {
  callbackUrl: string;
  delayHeader: string | undefined;
  deduplicationId: string | undefined;
  bodyTenantId: string | undefined;
  bodyGuestPhone: string | undefined;
};

// Node pode entregar header repetido como array — normaliza (transporte).
function headerFirst(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ── Estado do harness ───────────────────────────────────────────────────────
const RESP_URL_CANDIDATES = [
  process.env.E2E_REDIS_URL,
  process.env.TEST_REDIS_URL,
  "redis://127.0.0.1:6379", // detecção local (§13), sem credencial inventada
].filter((u): u is string => typeof u === "string" && u.length > 0);

const RUN_NS = `e2e007-real-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
const trackedBufferKeys = new Set<string>();

let redis: Redis | null = null;
let redisUrl: string | null = null;
let restServer: http.Server | null = null;
let restBaseUrl = "";
let restToken = "";
let qstashPublishes: RecordedPublish[] = [];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Adaptador Upstash-REST → RESP (TRANSPORTE, não lógica) ─────────────────
async function startRestAdapter(backing: Redis): Promise<number> {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);
      const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

      // Dupla do QStash (dependência externa HTTP — T2): grava e aceita.
      // Autenticação própria: em produção o publish usa QSTASH_TOKEN, não o
      // token do Redis REST — cada superfície valida a SUA credencial.
      if (parts[0] === "qstash") {
        if (req.headers.authorization !== `Bearer ${process.env.QSTASH_TOKEN}`) {
          res.writeHead(401).end(JSON.stringify({ error: "UNAUTHORIZED_QSTASH" }));
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed: { url?: string; body?: string } = {};
        try {
          parsed = JSON.parse(raw) as { url?: string; body?: string };
        } catch {
          parsed = {};
        }
        let inner: { tenantId?: string; guestPhone?: string } = {};
        try {
          inner = JSON.parse(parsed.body ?? "{}") as { tenantId?: string; guestPhone?: string };
        } catch {
          inner = {};
        }
        qstashPublishes.push({
          callbackUrl: parsed.url ?? "",
          delayHeader: headerFirst(req.headers["upstash-delay"]),
          deduplicationId: headerFirst(req.headers["upstash-deduplication-id"]),
          bodyTenantId: inner.tenantId,
          bodyGuestPhone: inner.guestPhone,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ messageId: `qstash-double-${qstashPublishes.length}` }));
        return;
      }

      // Superfície Redis REST: credencial própria (UPSTASH_REDIS_REST_TOKEN).
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${restToken}`) {
        res.writeHead(401).end(JSON.stringify({ error: "UNAUTHORIZED" }));
        return;
      }

      const [cmd, ...args] = parts;
      const readBody = async (): Promise<unknown> => {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString("utf8");
        if (raw.length === 0) return undefined;
        return JSON.parse(raw) as unknown;
      };

      // Somente os comandos usados pelo bundler + diagnóstico do teste.
      switch (cmd) {
        case "pipeline": {
          const body = (await readBody()) as Array<[string, ...string[]]>;
          const out: Array<{ result: unknown }> = [];
          for (const [op, ...opArgs] of body) {
            const value = await backing.call(op, ...opArgs);
            out.push({ result: value });
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(out));
          return;
        }
        case "lpop": {
          const n = Number(args[1]);
          const value = await backing.lpop(args[0], n);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: value }));
          return;
        }
        case "rpush": {
          const body = await readBody();
          if (!Array.isArray(body)) throw new Error("rpush body deve ser array (contrato Upstash REST)");
          const value = await backing.rpush(args[0], ...body.map((el) => JSON.stringify(el)));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: value }));
          return;
        }
        case "expire": {
          const value = await backing.expire(args[0], Number(args[1]));
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: value }));
          return;
        }
        // ── diagnóstico exclusivo do teste (não usados pelo bundler) ──
        case "llen": {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: await backing.llen(args[0]) }));
          return;
        }
        case "ttl": {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: await backing.ttl(args[0]) }));
          return;
        }
        case "exists": {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: await backing.exists(args[0]) }));
          return;
        }
        case "scan": {
          const match = url.searchParams.get("match") ?? "*";
          const out: string[] = [];
          let cursor = args[0] ?? "0";
          do {
            const reply = (await backing.call("SCAN", cursor, "MATCH", match, "COUNT", 200)) as [
              string,
              string[],
            ];
            cursor = reply[0];
            out.push(...reply[1]);
          } while (cursor !== "0");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result: out }));
          return;
        }
        default:
          res.writeHead(404).end(JSON.stringify({ error: `CMD_NAO_SUPORTADO:${String(cmd)}` }));
      }
    } catch (err) {
      res.writeHead(500).end(
        JSON.stringify({ error: err instanceof Error ? err.message : "ADAPTER_ERROR" })
      );
    }
  });
  restServer = server;
  return await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve(addr.port);
    });
  });
}

// ── Detecção de Redis REAL (§13) ────────────────────────────────────────────
async function probeRedis(url: string): Promise<Redis | null> {
  const probe = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  probe.on("error", () => {
    /* ruído de reconexão esperado em detecção */
  });
  try {
    await probe.connect();
    const pong = await probe.ping();
    if (pong === "PONG") return probe;
  } catch {
    // candidato inacessível — tenta próximo
  }
  probe.disconnect();
  return null;
}

// ── Helpers de flush/diagnóstico via o MESMO contrato Upstash REST ─────────
async function restGet<T>(path: string): Promise<T> {
  const res = await fetch(`${restBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${restToken}` },
  });
  if (!res.ok) throw new Error(`REST ${path} HTTP ${res.status}`);
  return (await res.json()) as T;
}
const restResult = async <T>(path: string): Promise<T> =>
  ((await restGet<{ result: T }>(path)) as { result: T }).result;
const llenOf = async (key: string): Promise<number> => restResult<number>(`/llen/${encodeURIComponent(key)}`);
const existsOf = async (key: string): Promise<number> => restResult<number>(`/exists/${encodeURIComponent(key)}`);
const ttlOf = async (key: string): Promise<number> => restResult<number>(`/ttl/${encodeURIComponent(key)}`);
const scanKeys = async (match: string): Promise<string[]> =>
  restResult<string[]>(`/scan/0?match=${encodeURIComponent(match)}`);

// ── Processor instrumentado (ponto de injeção REAL de produção) ────────────
type Recording = { calls: Array<{ content: string; tenant: string; phone: string }> };
function makeProcessor(rec: Recording, opts?: { failFirst?: boolean; delayMs?: number }): ProductionProcessor {
  let n = 0;
  return async (payload: BufferMessagePayload): Promise<unknown> => {
    n += 1;
    if (opts?.delayMs) await sleep(opts.delayMs);
    if (opts?.failFirst === true && n === 1) {
      throw new Error("E2E007_INJECAO_FALHA_PROCESSOR");
    }
    rec.calls.push({
      content: payload.messageContent,
      tenant: payload.tenantId,
      phone: payload.guestPhone,
    });
    return { ok: true };
  };
}
function makePayload(tenantId: string, guestPhone: string, content: string): BufferMessagePayload {
  return {
    tenantId,
    guestPhone,
    guestName: "E2E-007 Real",
    messageContent: content,
    messageFrom: "whatsapp",
  };
}

// ── Contrato REAL do publish QStash (RBW Fase N + v2) ──────────────────────
// O bucket do dedup id é capturado no INSTANTE do publish dentro do bundler
// (Date.now() default); a asserção correta é: formato do builder real +
// bucket dentro da janela de tempo observada da entrega.
function bucketOf(dedupId: string): number {
  return Number(dedupId.slice(dedupId.lastIndexOf(":") + 1));
}
function expectPublishContract(
  pub: RecordedPublish,
  tenantId: string,
  guestPhone: string,
  tStartMs: number,
  tEndMs: number
): void {
  expect(pub.delayHeader).toBe(`${BUNDLE_WINDOW_MS / 1000}s`);
  expect(pub.callbackUrl).toBe(`${restBaseUrl}/api/internal/flush-buffer`);
  expect(pub.bodyTenantId).toBe(tenantId);
  expect(pub.bodyGuestPhone).toBe(guestPhone);
  const prefix = `rbw-flush:${tenantId}:${guestPhone}:`;
  expect(pub.deduplicationId?.startsWith(prefix)).toBe(true);
  const bucket = bucketOf(pub.deduplicationId ?? "");
  expect(Number.isInteger(bucket)).toBe(true);
  expect(bucket).toBeGreaterThanOrEqual(Math.floor(tStartMs / BUNDLE_WINDOW_MS));
  expect(bucket).toBeLessThanOrEqual(Math.floor(tEndMs / BUNDLE_WINDOW_MS));
}

beforeAll(async () => {
  // Invariante: o valor sob teste é o de PRODUÇÃO, não sombra local.
  expect(BUNDLE_WINDOW_MS).toBe(3000);

  // 1) Redis real (RESP) — primeiro candidato que responder PONG.
  for (const candidate of RESP_URL_CANDIDATES) {
    const found = await probeRedis(candidate);
    if (found) {
      redis = found;
      redisUrl = candidate;
      break;
    }
  }
  if (!redis || !redisUrl) {
    console.warn(
      "[E2E-007 REAL v2] BLOQUEADO POR INFRA — nenhum redis-server real acessível " +
        "(E2E_REDIS_URL/TEST_REDIS_URL/127.0.0.1:6379). Skip honesto; " +
        "nenhum GREEN fabricado. Dependência p/ certificar: redis-server >= 6 local."
    );
    return;
  }

  // 2) Adaptador de transporte Upstash-REST sobre o redis-server real.
  restToken = `e2e-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const port = await startRestAdapter(redis);
  restBaseUrl = `http://127.0.0.1:${port}`;

  // 3) Ambiente EXATAMENTE como produção espera (Upstash REST + QStash).
  process.env.UPSTASH_REDIS_REST_URL = restBaseUrl;
  process.env.UPSTASH_REDIS_REST_TOKEN = restToken;
  process.env.QSTASH_URL = `${restBaseUrl}/qstash`;
  process.env.QSTASH_TOKEN = `qstash-${restToken}`;
  process.env.NEXT_PUBLIC_APP_URL = restBaseUrl;
});

afterEach(() => {
  // Nenhum timer/pending bundle vaza entre testes (estado em memória é só
  // estatística em produção; aqui garantimos isolamento entre gates).
  resetBundlerStats();
  qstashPublishes = [];
});

afterAll(async () => {
  // G4 duro: nenhuma chave do namespace do teste sobrevive.
  if (redis) {
    try {
      const leftovers = await scanKeys(`mb:${RUN_NS}*`);
      if (leftovers.length > 0) await redis.del(...leftovers);
    } catch {
      /* best-effort */
    }
    redis.disconnect();
  }
  if (restServer) {
    await new Promise<void>((resolve) => restServer?.close(() => resolve()));
  }
});

describe(`E2E-007 REAL v2 — bundler de produção (namespace ${RUN_NS})`, () => {
  test(
    "G1: 2 entregas reais + 2 flushes concorrentes do handler REAL → 1 processador vencedor, 0 duplicado",
    async (ctx) => {
      if (!redis) {
        ctx.skip();
        throw new Error("unreachable");
      }
      const tenantId = `${RUN_NS}-g1`;
      const guestPhone = "+5511900000001";
      const bufferKey = redisKey(tenantId, guestPhone);
      trackedBufferKeys.add(bufferKey);

      const rec: Recording = { calls: [] };
      const processor = makeProcessor(rec, { delayMs: 40 });

      // ── Duas entregas REAIS de webhook (mesma rota canônica → bufferMessage).
      // RPUSH real de 2 payloads completos na lista Redis real.
      const tStart = Date.now();
      await bufferMessage(makePayload(tenantId, guestPhone, "evento-1"), processor);
      await bufferMessage(makePayload(tenantId, guestPhone, "evento-2"), processor);
      const tEnd = Date.now();
      expect(await llenOf(bufferKey)).toBe(2);

      // ── Contrato QStash REAL provado: delay = janela; dedup id do builder
      // real com bucket dentro da janela observada (publica em ciclo próprio).
      expect(qstashPublishes.length).toBe(2);
      for (const pub of qstashPublishes) {
        expectPublishContract(pub, tenantId, guestPhone, tStart, tEnd);
      }

      // ── Dois workers REAIS: duas invocações CONCORRENTES do handler de
      // produção handleFlushBufferRequest (o mesmo que QStash chama na rota
      // /api/internal/flush-buffer). O que disputa é o CLAIM ATÔMICO LPOP do
      // redis-server real — exatamente o risco de duplicação do RBW Fase N.
      const [workerA, workerB] = await Promise.all([
        handleFlushBufferRequest({ tenantId, guestPhone }, processor),
        handleFlushBufferRequest({ tenantId, guestPhone }, processor),
      ]);

      const winners = [workerA, workerB].filter((r) => r.messageCount > 0);
      expect(winners.length).toBe(1); // um único worker ganhou o claim
      expect(winners[0]?.success).toBe(true);
      expect(winners[0]?.messageCount).toBe(2); // os 2 eventos de UM ciclo
      const losers = [workerA, workerB].filter((r) => r.messageCount === 0);
      expect(losers.length).toBe(1); // o perdedor recebeu buffer vazio (no-op)
      expect(losers[0]?.success).toBe(true);

      // ── EXATAMENTE UMA VEZ: o executor real rodou 1x com o CONTEÚDO dos
      // dois eventos concatenados pelo bundler de produção (join '\n').
      expect(rec.calls.length).toBe(1);
      expect(rec.calls[0]?.tenant).toBe(tenantId);
      expect(rec.calls[0]?.phone).toBe(guestPhone);
      expect(rec.calls[0]?.content).toBe("evento-1\nevento-2");

      // ── Estado final: a fila real foi consumida (lista desaparece no
      // último LPOP do redis-server real).
      expect(await llenOf(bufferKey)).toBe(0);
      expect(await existsOf(bufferKey)).toBe(0);
    },
    30000
  );

  test(
    "G2: requeue REAL — processor falha → handler devolve item à lista (RPUSH+EXPIRE reais) → flush seguinte processa 1x",
    async (ctx) => {
      if (!redis) {
        ctx.skip();
        throw new Error("unreachable");
      }
      const tenantId = `${RUN_NS}-g2`;
      const guestPhone = "+5511900000002";
      const bufferKey = redisKey(tenantId, guestPhone);
      trackedBufferKeys.add(bufferKey);

      const recFail: Recording = { calls: [] };
      const recOk: Recording = { calls: [] };

      // ── Entrega real (RPUSH + QStash publish reais).
      await bufferMessage(makePayload(tenantId, guestPhone, "reserva-sabado"), makeProcessor(recFail));
      expect(await llenOf(bufferKey)).toBe(1);

      // ── Worker A (processor com falha): o handler REAL deve:
      //  1) claimar via LPOP atômico, 2) detectar a falha, 3) RPUSH de volta
      //  com ordem preservada, 4) renovar o EXPIRE, 5) reportar requeue.
      const failed = await handleFlushBufferRequest(
        { tenantId, guestPhone },
        makeProcessor(recFail, { failFirst: true })
      );
      expect(failed.success).toBe(false);
      expect(failed.error).toBe("PROCESSOR_FAILED_REQUEUED");
      expect(recFail.calls.length).toBe(0); // falha ANTES de efeito colateral

      // O item REALMENTE voltou (lista real do redis-server) com TTL renovado.
      expect(await llenOf(bufferKey)).toBe(1);
      expect(await existsOf(bufferKey)).toBe(1);
      const ttlAfterRequeue = await ttlOf(bufferKey);
      expect(ttlAfterRequeue).toBeGreaterThan(0);
      expect(ttlAfterRequeue).toBeLessThanOrEqual(BUNDLE_BUFFER_TTL_SECONDS);

      // ── Worker B: flush seguinte (processor saudável) consome 1x.
      const retry = await handleFlushBufferRequest({ tenantId, guestPhone }, makeProcessor(recOk));
      expect(retry.success).toBe(true);
      expect(retry.messageCount).toBe(1);
      expect(recOk.calls.length).toBe(1);
      expect(recOk.calls[0]?.content).toBe("reserva-sabado"); // mesmo item, íntegro

      // ── Totais: 1 processamento válido, 0 duplicado, fila vazia.
      expect(recFail.calls.length + recOk.calls.length).toBe(1);
      expect(await llenOf(bufferKey)).toBe(0);
      expect(await existsOf(bufferKey)).toBe(0);

      // ── Nota de design (mapa W1.1): produção NÃO possui lease SET NX EX;
      // o claim É o LPOP atômico e o requeue É o RPUSH de retorno — ambos
      // exercitados acima via código de produção, sem primitiva inventada.
    },
    30000
  );

  test(
    "G3: BUNDLE_WINDOW_MS REAL — 2 eventos de um ciclo viram 1 bundle COM OS 2 eventos; ciclo novo vira bundle novo (conteúdo provado)",
    async (ctx) => {
      if (!redis) {
        ctx.skip();
        throw new Error("unreachable");
      }
      const tenantId = `${RUN_NS}-g3`;
      const guestPhone = "+5511900000003";
      const bufferKey = redisKey(tenantId, guestPhone);
      trackedBufferKeys.add(bufferKey);

      const rec: Recording = { calls: [] };
      const processor = makeProcessor(rec);

      // ── Ciclo 1: dois eventos reais DENTRO da janela (mesma rota canônica).
      const tStart1 = Date.now();
      await bufferMessage(makePayload(tenantId, guestPhone, "msg-A"), processor);
      await bufferMessage(makePayload(tenantId, guestPhone, "msg-B"), processor);
      const tEnd1 = Date.now();

      // Contrato do publish + builder REAL com entrada FIXA (determinístico).
      expect(qstashPublishes.length).toBe(2);
      for (const pub of qstashPublishes) {
        expectPublishContract(pub, tenantId, guestPhone, tStart1, tEnd1);
      }
      const fixedMs = 1_750_000_000_000;
      expect(buildFlushDeduplicationId(tenantId, guestPhone, fixedMs)).toBe(
        `rbw-flush:${tenantId}:${guestPhone}:${Math.floor(fixedMs / BUNDLE_WINDOW_MS)}`
      );
      const bucketCycle1 = bucketOf(qstashPublishes[0]?.deduplicationId ?? "0");

      // ── UM flush de produção para o ciclo (o que o QStash entregaria).
      const flush1 = await handleFlushBufferRequest({ tenantId, guestPhone }, processor);
      expect(flush1.success).toBe(true);
      expect(flush1.messageCount).toBe(2);

      // ── CONTEÚDO do bundle provado (regra §11: não basta contagem):
      // o executor recebeu UM batch cujo conteúdo contém OS DOIS eventos,
      // concatenados pelo bundler real com '\n'.
      expect(rec.calls.length).toBe(1);
      expect(rec.calls[0]?.content).toBe("msg-A\nmsg-B");

      // ── Ciclo 2: janela REAL inteira depois → bucket novo → publish com
      // dedup id DIFERENTE (nunca suprime flush de janela futura — RBW v2).
      await sleep(BUNDLE_WINDOW_MS + 250);
      const tStart2 = Date.now();
      await bufferMessage(makePayload(tenantId, guestPhone, "msg-C"), processor);
      const tEnd2 = Date.now();
      expect(qstashPublishes.length).toBe(3);
      expectPublishContract(qstashPublishes[2] as RecordedPublish, tenantId, guestPhone, tStart2, tEnd2);
      const bucketCycle2 = bucketOf(qstashPublishes[2]?.deduplicationId ?? "0");
      expect(bucketCycle2).toBeGreaterThan(bucketCycle1);

      const flush2 = await handleFlushBufferRequest({ tenantId, guestPhone }, processor);
      expect(flush2.success).toBe(true);
      expect(flush2.messageCount).toBe(1);
      expect(rec.calls.length).toBe(2);
      expect(rec.calls[1]?.content).toBe("msg-C"); // bundle separado, payload correto

      // ── Total: 2 bundles distintos, cada um com seu ciclo — e nenhum
      // evento perdido (o teste antigo com INCR perdia o 2º evento).
      expect(rec.calls.reduce((acc, c) => acc + c.content.split("\n").length, 0)).toBe(3);
      expect(await llenOf(bufferKey)).toBe(0);
      expect(await existsOf(bufferKey)).toBe(0);
    },
    40000
  );

  test(
    "G4: estado final — nenhuma chave do namespace sobrevive no Redis real",
    async (ctx) => {
      if (!redis) {
        ctx.skip();
        throw new Error("unreachable");
      }
      // Namespace exclusivo do run: toda chave de buffer criada pelos gates
      // usa redisKey(tenantId, phone) com tenantId = RUN_NS-* (provado pelos
      // gates acima). Nenhuma chave genérica foi usada em nenhum gate.
      for (const key of trackedBufferKeys) {
        expect(key.startsWith(`mb:${RUN_NS}`)).toBe(true);
      }

      // Limpeza pelo MESMO contrato de transporte e re-scan de prova.
      const leftovers = await scanKeys(`mb:${RUN_NS}*`);
      if (leftovers.length > 0) await redis.del(...leftovers);
      const after = await scanKeys(`mb:${RUN_NS}*`);
      expect(after.length).toBe(0);

      // Estado em memória do bundler zerado (estatística não acumulada).
      resetBundlerStats();
      const stats = (await import("@/lib/message-bundler")).getBundlerStats();
      expect(stats.totalBundlesProcessed).toBe(0);
      expect(stats.totalMessagesProcessed).toBe(0);
    },
    15000
  );
});
