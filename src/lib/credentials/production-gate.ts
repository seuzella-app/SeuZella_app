// ============================================================================
// SEUZELLA — WAVE 1 / FASE 1 — PRODUCTION CREDENTIAL GATE
// ----------------------------------------------------------------------------
// Regra de ouro: o catálogo de credenciais tem AUTORIDADE ÚNICA em
// src/lib/credentials/credential-registry.ts (PROD_REQUIRED / FEATURE_SCOPED).
// Este módulo NÃO redefine catálogo e NÃO cria segunda autoridade: consome o
// registry existente (missingProdCredentials / readinessReport) e adiciona:
//   1) a trava de boot fail-closed para produção;
//   2) defesa adicional contra valores presentes porém só-whitespace;
//   3) resultado estruturado para instrumentação/testes, SEM expor valores.
// Nenhuma mensagem desta módulo contém valor de credencial — apenas NOMES.
// ============================================================================

import {
  missingProdCredentials,
  readinessReport,
} from "./credential-registry";

export interface ProductionGateResult {
  /** STRICT em produção; fora de produção o gate nunca bloqueia boot. */
  mode: "PRODUCTION_STRICT" | "NON_PRODUCTION";
  /** true quando nenhuma credencial PROD_REQUIRED está ausente. */
  ready: boolean;
  /** true somente em produção com required ausente -> boot deve falhar. */
  blockedStartup: boolean;
  /** NOMES das credenciais PROD_REQUIRED ausentes (nunca valores). */
  missingRequired: string[];
  /** NOMES FEATURE_SCOPED ausentes — NÃO bloqueiam boot global. */
  featureScopedMissing: string[];
  checkedAt: string;
}

export class ProductionCredentialsNotReadyError extends Error {
  public readonly missingRequired: string[];

  constructor(missing: string[]) {
    super(
      "[PRODUCTION CREDENTIAL GATE] Boot de produção bloqueado: " +
        String(missing.length) +
        " credencial(is) PROD_REQUIRED ausente(s): " +
        missing.join(", ") +
        ". Configure as credenciais reais no ambiente do servidor " +
        "(.env/secret manager) e reinicie. Valores nao sao logados por seguranca."
    );
    this.name = "ProductionCredentialsNotReadyError";
    this.missingRequired = missing;
  }
}

/** Injeção de dependências para testes determinísticos (padrão do kit W1). */
export interface ProductionGateDeps {
  env: Record<string, string | undefined>;
  isProduction: () => boolean;
  listMissingRequired: () => string[];
  /** Nomes inspecionáveis no env para a defesa anti-whitespace. */
  listRequiredNames: () => string[];
  listFeatureScopedMissing: () => string[];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Tenta extrair NOMES das credenciais required do relatório do registry.
 * Compatível com formatos de array de strings ou array de objetos com `name`.
 * Se o formato não for reconhecido, retorna [] sem lançar (o catálogo
 * continua sendo autoridade do registry; a defesa whitespace fica inerte).
 */
function readRequiredNamesFromReport(): string[] {
  try {
    const report: unknown = readinessReport();
    if (report && typeof report === "object") {
      const rec = report as Record<string, unknown>;
      for (const key of ["required", "prodRequired", "PROD_REQUIRED"]) {
        const value = rec[key];
        if (Array.isArray(value)) {
          const names: string[] = [];
          for (const item of value) {
            if (typeof item === "string") {
              names.push(item);
            } else if (item && typeof item === "object") {
              const name = (item as Record<string, unknown>)["name"];
              if (typeof name === "string") names.push(name);
            }
          }
          if (names.length > 0) return names;
        }
      }
    }
  } catch {
    // Relatório indisponível não bloqueia: catálogo segue no registry.
  }
  return [];
}

export const defaultProductionGateDeps: ProductionGateDeps = {
  env: process.env as Record<string, string | undefined>,
  isProduction: () => process.env.NODE_ENV === "production",
  listMissingRequired: () => asStringArray(missingProdCredentials()),
  listRequiredNames: () => readRequiredNamesFromReport(),
  listFeatureScopedMissing: () => [],
};

/**
 * Trava de boot: em produção, falha (throw) se qualquer credencial
 * PROD_REQUIRED estiver ausente. Fora de produção apenas diagnostica.
 * FEATURE_SCOPED ausente NUNCA bloqueia o boot global.
 */
export function assertProductionCredentialsReady(
  overrides?: Partial<ProductionGateDeps>
): ProductionGateResult {
  const deps: ProductionGateDeps = {
    ...defaultProductionGateDeps,
    ...(overrides ?? {}),
  };

  const missing = new Set<string>(asStringArray(deps.listMissingRequired()));

  // Defesa adicional (não substitui o registry): valor presente porém
  // só-espaços conta como ausente para nomes inspecionáveis no env.
  const requiredNames = asStringArray(deps.listRequiredNames());
  for (const name of requiredNames) {
    const raw = deps.env[name];
    if (typeof raw === "string" && raw.trim() === "") {
      missing.add(name);
    }
  }

  const missingRequired = Array.from(missing).sort();
  const featureScopedMissing = asStringArray(deps.listFeatureScopedMissing());
  const isProd = deps.isProduction() === true;
  const mode: ProductionGateResult["mode"] = isProd
    ? "PRODUCTION_STRICT"
    : "NON_PRODUCTION";

  const result: ProductionGateResult = {
    mode,
    ready: missingRequired.length === 0,
    blockedStartup: isProd && missingRequired.length > 0,
    missingRequired,
    featureScopedMissing,
    checkedAt: new Date().toISOString(),
  };

  if (result.blockedStartup) {
    throw new ProductionCredentialsNotReadyError(result.missingRequired);
  }

  if (!isProd && missingRequired.length > 0) {
    console.warn(
      "[PRODUCTION CREDENTIAL GATE] fora de produção com credenciais " +
        "ausentes (nao bloqueia): " +
        missingRequired.join(", ")
    );
  }

  if (featureScopedMissing.length > 0) {
    console.warn(
      "[PRODUCTION CREDENTIAL GATE] credenciais FEATURE_SCOPED ausentes " +
        "(nao bloqueiam boot global): " +
        featureScopedMissing.join(", ")
    );
  }

  return result;
}
