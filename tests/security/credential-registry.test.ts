/**
 * ============================================================================
 * SEU ZELLA — TESTE DO CREDENTIAL REGISTRY (KIT POSV2 v1)
 * ============================================================================
 * Prova os invariantes FAIL-CLOSED do inventário único de credenciais:
 *   R1. credencial ausente  => requireCredential LANÇA (nunca retorna "")
 *   R2. credencial presente => retorna o valor exato
 *   R3. NENHUMA função de status/report expõe o VALOR da credencial
 *   R4. inventário não vazio e sem env duplicada
 *   R5. erro acionável: mensagem contém env + fase + como obter
 * Self-contained: não importa nada do domínio do repo (aditivo, sem risco).
 * ============================================================================
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CREDENTIAL_REGISTRY,
  CredentialMissingError,
  getCredentialStatus,
  missingProdCredentials,
  readOptionalCredential,
  readinessReport,
  requireCredential,
} from "../../src/lib/credentials/credential-registry";

const ENV_BACKUP = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_BACKUP };
});

describe("credential-registry — inventário", () => {
  it("R4: inventário não vazio, sem env duplicada, specs completas", () => {
    const keys = Object.keys(CREDENTIAL_REGISTRY);
    expect(keys.length).toBeGreaterThan(5);
    const envs = keys.map((k) => CREDENTIAL_REGISTRY[k].env);
    expect(new Set(envs).size).toBe(envs.length);
    for (const spec of Object.values(CREDENTIAL_REGISTRY)) {
      expect(spec.env.length).toBeGreaterThan(0);
      expect(["PROD_REQUIRED", "FEATURE_SCOPED"]).toContain(spec.requirement);
      expect(spec.fase.length).toBeGreaterThan(0);
      expect(spec.unlocks.length).toBeGreaterThan(0);
      expect(spec.whereToGet.length).toBeGreaterThan(0);
    }
  });

  it("R4: CRON_SECRET e DATABASE_URL são PROD_REQUIRED", () => {
    expect(CREDENTIAL_REGISTRY.CRON_SECRET.requirement).toBe("PROD_REQUIRED");
    expect(CREDENTIAL_REGISTRY.DATABASE_URL.requirement).toBe("PROD_REQUIRED");
  });
});

describe("credential-registry — fail-closed", () => {
  beforeEach(() => {
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.PAYMENT_GATEWAY_API_KEY;
  });

  it("R1: requireCredential LANÇA quando ausente", () => {
    expect(() => requireCredential("META_ACCESS_TOKEN")).toThrow(CredentialMissingError);
  });

  it("R1: requireCredential LANÇA quando presente mas VAZIA (fail-closed, não falsy-tolerante)", () => {
    process.env.META_ACCESS_TOKEN = "";
    expect(() => requireCredential("META_ACCESS_TOKEN")).toThrow(CredentialMissingError);
  });

  it("R1: requireCredential LANÇA quando presente só com espaços (fail-closed)", () => {
    process.env.META_ACCESS_TOKEN = "   ";
    expect(() => requireCredential("META_ACCESS_TOKEN")).toThrow(CredentialMissingError);
  });

  it("R2: credencial presente retorna valor EXATO", () => {
    process.env.PAYMENT_GATEWAY_API_KEY = "chave-real-de-teste-123";
    expect(requireCredential("PAYMENT_GATEWAY_API_KEY")).toBe("chave-real-de-teste-123");
  });

  it("R5: mensagem do erro é acionável (env + fase + onde obter + fail-closed)", () => {
    try {
      requireCredential("META_ACCESS_TOKEN");
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(CredentialMissingError);
      const msg = (e as Error).message;
      expect(msg).toContain("META_ACCESS_TOKEN");
      expect(msg).toContain("FAIL-CLOSED");
      expect(msg).toContain("WhatsApp");
      expect(msg).toContain("developers.facebook.com");
    }
  });

  it("R1: readOptionalCredential retorna undefined quando ausente (nunca lança, nunca retorna '')", () => {
    expect(readOptionalCredential("META_ACCESS_TOKEN")).toBeUndefined();
    process.env.META_ACCESS_TOKEN = "  ";
    expect(readOptionalCredential("META_ACCESS_TOKEN")).toBeUndefined();
  });
});

describe("credential-registry — relatórios sem vazamento", () => {
  beforeEach(() => {
    delete process.env.META_APP_SECRET;
    delete process.env.DATABASE_URL;
  });

  it("R3: getCredentialStatus nunca inclui o valor da credencial", () => {
    process.env.META_APP_SECRET = "SEGREDO-ULTRA-SECRETO-xkcd";
    const status = getCredentialStatus();
    const meta = status.find((s) => s.key === "META_APP_SECRET")!;
    expect(meta.present).toBe(true);
    expect(JSON.stringify(status)).not.toContain("SEGREDO-ULTRA-SECRETO-xkcd");
  });

  it("R3: readinessReport e missingProdCredentials não vaziam segredos", () => {
    process.env.DATABASE_URL = "postgres://user:SENHA-PROFANA@host/db";
    const report = readinessReport();
    expect(JSON.stringify(report)).not.toContain("SENHA-PROFANA");
    // presente => NÃO pode aparecer como ausente
    expect(report.prodBlocking.map((s) => s.key)).not.toContain("DATABASE_URL");
    delete process.env.DATABASE_URL;
    expect(missingProdCredentials().map((s) => s.key)).toContain("DATABASE_URL");
    expect(missingProdCredentials().every((s) => !s.present)).toBe(true);
    expect(JSON.stringify(missingProdCredentials())).not.toContain("SENHA-PROFANA");
  });

  it("R3: credencial presente some da lista de ausentes", () => {
    process.env.META_APP_SECRET = "qualquer-coisa";
    expect(readinessReport().missing.map((s) => s.key)).not.toContain("META_APP_SECRET");
  });
});
