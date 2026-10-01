import { afterEach, describe, expect, test, vi } from "vitest";
import {
  assertProductionCredentialsReady,
  ProductionCredentialsNotReadyError,
  type ProductionGateDeps,
} from "../../src/lib/credentials/production-gate";

// ============================================================================
// WAVE 1 / FASE 1 — Production Credential Gate
// Testes determinísticos via injeção de dependências (a autoridade do
// catálogo permanece no credential-registry; aqui provamos o COMPORTAMENTO
// do gate: fail-closed em produção, whitespace, feature-scoped, sem leak).
// ============================================================================

function makeDeps(
  over: Partial<ProductionGateDeps> = {}
): ProductionGateDeps {
  return {
    env: {},
    isProduction: () => true,
    listMissingRequired: () => [],
    listRequiredNames: () => [],
    listFeatureScopedMissing: () => [],
    ...over,
  };
}

const SECRET_FAKE_VALUE = "sk-live-SUPERSECRETO-1234567890";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WAVE 1 FASE 1 — Production Credential Gate", () => {
  test("produção com PROD_REQUIRED ausente BLOQUEIA o boot (fail-closed)", () => {
    const deps = makeDeps({
      isProduction: () => true,
      listMissingRequired: () => ["ASAAS_API_KEY", "DATABASE_URL"],
    });

    let caught: unknown = null;
    try {
      assertProductionCredentialsReady(deps);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ProductionCredentialsNotReadyError);
    const err = caught as ProductionCredentialsNotReadyError;
    expect(err.missingRequired).toEqual(["ASAAS_API_KEY", "DATABASE_URL"]);
    expect(err.message).toContain("ASAAS_API_KEY");
    expect(err.message).toContain("DATABASE_URL");
  });

  test("produção com todas as credenciais presentes NÃO bloqueia", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps({
      isProduction: () => true,
      listMissingRequired: () => [],
    });

    const result = assertProductionCredentialsReady(deps);

    expect(result.mode).toBe("PRODUCTION_STRICT");
    expect(result.ready).toBe(true);
    expect(result.blockedStartup).toBe(false);
    expect(result.missingRequired).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("valor presente porém só-whitespace conta como AUSENTE", () => {
    const deps = makeDeps({
      isProduction: () => true,
      listMissingRequired: () => [],
      listRequiredNames: () => ["ASAAS_API_KEY"],
      env: { ASAAS_API_KEY: "     " },
    });

    let blocked = false;
    try {
      assertProductionCredentialsReady(deps);
    } catch (err) {
      expect(err).toBeInstanceOf(ProductionCredentialsNotReadyError);
      blocked = true;
    }
    expect(blocked).toBe(true);
  });

  test("FEATURE_SCOPED ausente NÃO bloqueia boot global", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps({
      isProduction: () => true,
      listMissingRequired: () => [],
      listFeatureScopedMissing: () => ["QSTASH_TOKEN"],
    });

    const result = assertProductionCredentialsReady(deps);

    expect(result.blockedStartup).toBe(false);
    expect(result.ready).toBe(true);
    expect(result.featureScopedMissing).toEqual(["QSTASH_TOKEN"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("QSTASH_TOKEN")
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("FEATURE_SCOPED")
    );
  });

  test("fora de produção com credenciais ausentes NÃO bloqueia (diagnostica)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deps = makeDeps({
      isProduction: () => false,
      listMissingRequired: () => ["ASAAS_API_KEY"],
    });

    const result = assertProductionCredentialsReady(deps);

    expect(result.mode).toBe("NON_PRODUCTION");
    expect(result.blockedStartup).toBe(false);
    expect(result.ready).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("nao bloqueia")
    );
  });

  test("mensagens de erro NUNCA contêm valores de credencial (anti-leak)", () => {
    const deps = makeDeps({
      isProduction: () => true,
      listMissingRequired: () => ["ASAAS_API_KEY"],
      env: { ASAAS_API_KEY: SECRET_FAKE_VALUE },
    });

    let message = "";
    try {
      assertProductionCredentialsReady(deps);
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).not.toContain(SECRET_FAKE_VALUE);
    expect(message).not.toContain("SUPERSECRETO");
  });

  test("integração real: gate nunca bloqueia fora de produção (NODE_ENV=test)", async () => {
    // Import dinâmico: usa o registry REAL como autoridade do catálogo.
    const mod = await import(
      "../../src/lib/credentials/production-gate"
    );
    const result = mod.assertProductionCredentialsReady({
      isProduction: () => false,
    });

    expect(result.mode).toBe("NON_PRODUCTION");
    expect(result.blockedStartup).toBe(false);
    expect(Array.isArray(result.missingRequired)).toBe(true);
    expect(Array.isArray(result.featureScopedMissing)).toBe(true);
    expect(typeof result.checkedAt).toBe("string");
  });

  test("integração real: registry expõe a autoridade esperada", async () => {
    const registry = await import(
      "../../src/lib/credentials/credential-registry"
    );

    expect(typeof registry.missingProdCredentials).toBe("function");
    expect(typeof registry.readinessReport).toBe("function");
    expect(typeof registry.requireCredential).toBe("function");
    expect(typeof registry.readOptionalCredential).toBe("function");
  });
});
