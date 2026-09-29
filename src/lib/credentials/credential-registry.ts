/**
 * ============================================================================
 * SEU ZELLA — CREDENTIAL REGISTRY (KIT POSV2 v1) — FONTE ÚNICA DE VERDADE
 * ============================================================================
 * Propósito (Cronograma Mestre F6–F11, parte executável sem credenciais):
 *   Inventário ÚNICO de toda credencial externa que o Seu Zélla precisa,
 *   com acesso FAIL-CLOSED: se a credencial não existe, o sistema NÃO finge
 *   que funciona — ele bloqueia com mensagem acionável.
 *
 * Regras invioláveis:
 *   1. NUNCA logar, serializar ou retornar o VALOR de uma credencial.
 *      Somente status (present/missing), escopo e instrução de obtenção.
 *   2. Nenhum módulo de domínio lê process.env diretamente para credenciais
 *      externas — tudo passa daqui (elimina "segundo dono de estado").
 *   3. Fail-closed: requireCredential() LANÇA se ausente. Nunca retorna "".
 *   4. Este arquivo é ADITIVO — não toca em nenhum arquivo existente.
 *
 * Para editar depois (quando o dono tiver as credenciais em mãos):
 *   basta exportar as env vars no .env do iMac/VPS — NENHUMA edição de
 *   código é necessária para ligar uma credencial. Ver:
 *   04_RUNBOOK_CREDENCIAIS/POSV2_CREDENTIAL_FILL_RUNBOOK.md
 * ============================================================================
 */

export type CredentialRequirement = "PROD_REQUIRED" | "FEATURE_SCOPED";

export interface CredentialSpec {
  /** Nome da env var (única fonte de leitura) */
  env: string;
  /** PROD_REQUIRED = sem isso produção não sobe aquela frente; FEATURE_SCOPED = bloqueia só a feature */
  requirement: CredentialRequirement;
  /** Frente do cronograma que consome */
  fase: string;
  /** O que destrava quando presente (editável pelo dono) */
  unlocks: string;
  /** Onde o dono obtém/edita (editável pelo dono) */
  whereToGet: string;
}

/**
 * INVENTÁRIO MESTRE — editável pelo dono (adicionar/remover linhas aqui).
 * Nomes de env seguindo as convenções já usadas no repo (ver runbook).
 */
export const CREDENTIAL_REGISTRY: Record<string, CredentialSpec> = {
  // ---- Meta / WhatsApp (Fase F6 — E2E real WhatsApp) ----
  META_APP_SECRET: {
    env: "META_APP_SECRET",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / WhatsApp",
    unlocks: "Assinatura X-Hub-Signature-256 do webhook Meta (fail-closed hoje)",
    whereToGet: "developers.facebook.com > App > Settings > Basic > App Secret",
  },
  META_VERIFY_TOKEN: {
    env: "META_VERIFY_TOKEN",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / WhatsApp",
    unlocks: "Handshake GET /api/webhooks/meta (hub.challenge) em produção",
    whereToGet: "String aleatória sua — definida por você e colada no App Meta > Webhooks",
  },
  META_ACCESS_TOKEN: {
    env: "META_ACCESS_TOKEN",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / WhatsApp",
    unlocks: "Envio real de mensagens via Cloud API (E2E-REAL-002)",
    whereToGet: "developers.facebook.com > WhatsApp > API Setup > Temporary/Permanent Token",
  },
  WHATSAPP_PHONE_NUMBER_ID: {
    env: "WHATSAPP_PHONE_NUMBER_ID",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / WhatsApp",
    unlocks: "Destino phone_number_id do envio Cloud API",
    whereToGet: "developers.facebook.com > WhatsApp > API Setup > Phone number ID",
  },
  // ---- Pagamentos (Fase F6 — E2E real de pagamento; F-03 já fail-closed) ----
  PAYMENT_GATEWAY_NAME: {
    env: "PAYMENT_GATEWAY_NAME",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / Pagamentos",
    unlocks: "Seleção do gateway real na factory (mock continua 403 em prod)",
    whereToGet: "EDITAR PELO DONO: nome do gateway contratado (identificador canônico usado na factory de pagamentos)",
  },
  PAYMENT_GATEWAY_API_KEY: {
    env: "PAYMENT_GATEWAY_API_KEY",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / Pagamentos",
    unlocks: "Criação de checkout real (E2E-REAL-004)",
    whereToGet: "Painel do gateway contratado > Credenciais de produção",
  },
  PAYMENT_GATEWAY_WEBHOOK_SECRET: {
    env: "PAYMENT_GATEWAY_WEBHOOK_SECRET",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / Pagamentos",
    unlocks: "Validação de assinatura do webhook de pagamento (E2E-REAL-005)",
    whereToGet: "Painel do gateway > Webhooks > Signing secret",
  },
  // ---- Infra assíncrona (Fase F7/F9 — bundler, multi-instância) ----
  QSTASH_TOKEN: {
    env: "QSTASH_TOKEN",
    requirement: "FEATURE_SCOPED",
    fase: "F7 Resiliência / Bundler",
    unlocks: "Fila QStash real + janela de dedup BUNDLE_WINDOW_MS",
    whereToGet: "console.upstash.com/qstash > Manage > Keys",
  },
  QSTASH_CURRENT_SIGNING_KEY: {
    env: "QSTASH_CURRENT_SIGNING_KEY",
    requirement: "FEATURE_SCOPED",
    fase: "F7 Resiliência / Bundler",
    unlocks: "Verificação de assinatura dos callbacks QStash",
    whereToGet: "console.upstash.com/qstash > Signing Keys",
  },
  QSTASH_NEXT_SIGNING_KEY: {
    env: "QSTASH_NEXT_SIGNING_KEY",
    requirement: "FEATURE_SCOPED",
    fase: "F7 Resiliência / Bundler",
    unlocks: "Rotação de signing keys sem downtime",
    whereToGet: "console.upstash.com/qstash > Signing Keys (next)",
  },
  UPSTASH_REDIS_REST_URL: {
    env: "UPSTASH_REDIS_REST_URL",
    requirement: "FEATURE_SCOPED",
    fase: "F9 Performance / Multi-instância",
    unlocks: "Rate limit distribuído (hoje DENY-ALL sem ele — checklist MG-02)",
    whereToGet: "console.upstash.com > Redis > REST API",
  },
  UPSTASH_REDIS_REST_TOKEN: {
    env: "UPSTASH_REDIS_REST_TOKEN",
    requirement: "FEATURE_SCOPED",
    fase: "F9 Performance / Multi-instância",
    unlocks: "Auth do Redis REST (lock LPOP multi-instância)",
    whereToGet: "console.upstash.com > Redis > REST API > Token",
  },
  // ---- Operação (F5/F10/F11) ----
  CRON_SECRET: {
    env: "CRON_SECRET",
    requirement: "PROD_REQUIRED",
    fase: "F5 Operational Readiness",
    unlocks: "35 rotas cron autenticadas via header (verifyCronSecret)",
    whereToGet: "String aleatória gerada por você (openssl rand -hex 32) no .env de produção",
  },
  DATABASE_URL: {
    env: "DATABASE_URL",
    requirement: "PROD_REQUIRED",
    fase: "F0 Baseline / F11 Reconciliation",
    unlocks: "Banco de produção (reconciliação read-only depende dele)",
    whereToGet: "Provedor do banco contratado (VPS/Postgres gerenciado) — connection string",
  },
  ZELLM_API_KEY: {
    env: "ZELLM_API_KEY",
    requirement: "FEATURE_SCOPED",
    fase: "F6 E2E Real / ZéLLM-Cérebro",
    unlocks: "Cérebro/LLM em produção (E2E-REAL-009)",
    whereToGet: "EDITAR PELO DONO: chave do provedor LLM contratado",
  },
  NEXT_PUBLIC_APP_URL: {
    env: "NEXT_PUBLIC_APP_URL",
    requirement: "PROD_REQUIRED",
    fase: "F5 Operational Readiness",
    unlocks: "CORS allowlist canônica (origin-allowlist) e URLs de callback",
    whereToGet: "Sua URL pública de produção (ex.: https://seuzella.com.br)",
  },
} as const;

export type CredentialStatus = {
  key: string;
  env: string;
  present: boolean;
  requirement: CredentialRequirement;
  fase: string;
  unlocks: string;
  whereToGet: string;
};

/**
 * Status completo do inventário. NUNCA expõe valores — só booleano.
 * Fail-closed: valor só com espaços conta como AUSENTE.
 */
export function getCredentialStatus(): CredentialStatus[] {
  return Object.entries(CREDENTIAL_REGISTRY).map(([key, spec]) => ({
    key,
    env: spec.env,
    present: Boolean(process.env[spec.env] && String(process.env[spec.env]).trim().length > 0),
    requirement: spec.requirement,
    fase: spec.fase,
    unlocks: spec.unlocks,
    whereToGet: spec.whereToGet,
  }));
}

export class CredentialMissingError extends Error {
  constructor(
    public readonly key: string,
    public readonly spec: CredentialSpec,
  ) {
    super(
      `[FAIL-CLOSED] Credencial ausente: ${spec.env} (fase: ${spec.fase}). ` +
        `Isto destrava: ${spec.unlocks}. ` +
        `Como obter/editar: ${spec.whereToGet}. ` +
        `A operação foi BLOQUEADA — nenhum modo degradado é permitido.`,
    );
    this.name = "CredentialMissingError";
  }
}

/**
 * Acesso fail-closed. Lança CredentialMissingError se ausente/vazia.
 * Único ponto autorizado a ler env de credencial.
 */
export function requireCredential(key: keyof typeof CREDENTIAL_REGISTRY): string {
  const spec = CREDENTIAL_REGISTRY[key];
  const value = process.env[spec.env];
  if (!value || String(value).trim().length === 0) {
    throw new CredentialMissingError(key, spec);
  }
  return String(value);
}

/**
 * Lê credencial OPCIONAL para caminhos que têm fallback legítimo e documentado.
 * Retorna undefined se ausente — o caller DEVE tratar. Nunca lança.
 */
export function readOptionalCredential(key: keyof typeof CREDENTIAL_REGISTRY): string | undefined {
  const spec = CREDENTIAL_REGISTRY[key];
  const value = process.env[spec.env];
  return value && String(value).trim().length > 0 ? String(value) : undefined;
}

/**
 * Gate de produção: lista das PROD_REQUIRED ausentes.
 * Uso: startup de produção / runbook F5. Array vazio = liberado.
 */
export function missingProdCredentials(): CredentialStatus[] {
  return getCredentialStatus().filter((s) => s.requirement === "PROD_REQUIRED" && !s.present);
}

/**
 * Relatório de prontidão para o runbook do dono (sem valores, só status).
 */
export function readinessReport(): { total: number; present: number; missing: CredentialStatus[]; prodBlocking: CredentialStatus[] } {
  const all = getCredentialStatus();
  const missing = all.filter((s) => !s.present);
  return {
    total: all.length,
    present: all.length - missing.length,
    missing,
    prodBlocking: missing.filter((s) => s.requirement === "PROD_REQUIRED"),
  };
}
