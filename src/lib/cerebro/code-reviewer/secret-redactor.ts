// ============================================================================
// ZÉLLA — Secret Redactor (Code Reviewer)
// ============================================================================
// Camada OBRIGATÓRIA entre o filesystem e o LLM.
//
// Toda string lida de arquivos passa por `redactSecrets()` ANTES de ser
// enviada para o prompt do GLM. Garante que segredos hardcoded acidentais
// (chaves de API, tokens JWT, senhas, connection strings) NUNCA vazem para
// a API externa do LLM, mesmo que o código original os exponha.
//
// ESTRATÉGIA:
//  - Regex determinístico (não depende de LLM) para alta performance
//  - Cobertura: AWS, GCP, Azure, Stripe, GitHub, JWT, OpenAI, GLM, JWT
//    bearer tokens, connection strings Prisma/Postgres/MongoDB, chaves
//    privadas PEM, PIX keys, emails, CPF/CNPJ, números de cartão.
//  - Cada match é substituído por um placeholder tipado:
//      "[REDACTED:AWS_ACCESS_KEY]" | "[REDACTED:JWT_TOKEN]" | etc.
//  - Mantém a estrutura sintática (tamanho aproximado) para que o LLM
//    ainda consiga raciocinar sobre o contexto ("sim, este é um token,
//    está hardcoded, deve migrar para variável de ambiente").
//
// ESTADO:
//  - Stateless — safe to call concurrently from multiple reviews.
//  - Cada call retorna { redacted, foundSecrets[] } para auditoria.
// ============================================================================

export interface RedactedSecret {
  /** Tipo detectado: "aws_access_key" | "jwt" | "password" | "connection_string" | etc. */
  type: string;
  /** Quantas vezes apareceu */
  count: number;
  /** Placeholder usado (ex: "[REDACTED:JWT_TOKEN]") */
  placeholder: string;
}

export interface RedactionResult {
  redacted: string;
  foundSecrets: RedactedSecret[];
  /** True se algum segredo foi detectado */
  hasSecrets: boolean;
}

// ── Padrões de Detecção ──────────────────────────────────────────────────────
// Ordem importa: padrões mais específicos primeiro (ex: AWS key antes de "key=...")

interface SecretPattern {
  type: string;
  placeholder: string;
  /** Regex sem âncoras — casa em qualquer parte do texto */
  regex: RegExp;
  /** Severidade para auditoria */
  severity: 'critical' | 'warning' | 'info';
}

const SECRET_PATTERNS: SecretPattern[] = [
  // ── AWS ──
  {
    type: 'aws_access_key',
    placeholder: '[REDACTED:AWS_ACCESS_KEY]',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'critical',
  },
  {
    type: 'aws_secret_key',
    placeholder: '[REDACTED:AWS_SECRET_KEY]',
    // AWS secret keys are 40 chars base64 — too generic alone, requires adjacent key
    regex: /\b(?:aws_secret_access_key|secretAccessKey|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,
    severity: 'critical',
  },
  // ── GCP / Firebase ──
  {
    type: 'gcp_service_account',
    placeholder: '[REDACTED:GCP_SERVICE_ACCOUNT]',
    regex: /"type"\s*:\s*"service_account"[^}]*"private_key"\s*:\s*"[^"]+"/g,
    severity: 'critical',
  },
  // ── Azure ──
  {
    type: 'azure_storage_key',
    placeholder: '[REDACTED:AZURE_STORAGE_KEY]',
    regex: /\bDefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/g,
    severity: 'critical',
  },
  // ── Stripe ──
  {
    type: 'stripe_live_key',
    placeholder: '[REDACTED:STRIPE_LIVE_KEY]',
    regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g,
    severity: 'critical',
  },
  {
    type: 'stripe_test_key',
    placeholder: '[REDACTED:STRIPE_TEST_KEY]',
    regex: /\bsk_test_[0-9a-zA-Z]{24,}\b/g,
    severity: 'warning',
  },
  // ── GitHub ──
  {
    type: 'github_pat',
    placeholder: '[REDACTED:GITHUB_PAT]',
    regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
    severity: 'critical',
  },
  {
    type: 'github_legacy_token',
    placeholder: '[REDACTED:GITHUB_TOKEN]',
    regex: /\b(?:github_token|GH_TOKEN|GITHUB_TOKEN)\s*[:=]\s*['"]?[0-9a-f]{40}['"]?/gi,
    severity: 'critical',
  },
  // ── OpenAI / LLM ──
  {
    type: 'openai_api_key',
    placeholder: '[REDACTED:OPENAI_API_KEY]',
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g,
    severity: 'critical',
  },
  {
    type: 'glm_api_key',
    placeholder: '[REDACTED:GLM_API_KEY]',
    regex: /\b(?:GLM_5_2_API_KEY|GLM_API_KEY|ZHIPU_API_KEY)\s*[:=]\s*['"]?[A-Za-z0-9]{20,}['"]?/gi,
    severity: 'critical',
  },
  // ── JWT ──
  {
    type: 'jwt_token',
    placeholder: '[REDACTED:JWT_TOKEN]',
    // JWT: 3 base64url segments separated by dots
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'critical',
  },
  // ── Bearer tokens ──
  {
    type: 'bearer_token',
    placeholder: '[REDACTED:BEARER_TOKEN]',
    regex: /\bBearer\s+[A-Za-z0-9_\-\.=]{20,}/g,
    severity: 'critical',
  },
  // ── Connection strings ──
  {
    type: 'postgres_connection_string',
    placeholder: '[REDACTED:POSTGRES_CONNECTION_STRING]',
    regex: /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
    severity: 'critical',
  },
  {
    type: 'mongodb_connection_string',
    placeholder: '[REDACTED:MONGODB_CONNECTION_STRING]',
    regex: /\bmongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
    severity: 'critical',
  },
  {
    type: 'redis_connection_string',
    placeholder: '[REDACTED:REDIS_CONNECTION_STRING]',
    regex: /\brediss?:\/\/:[^@\s]+@[^\s]+/gi,
    severity: 'critical',
  },
  // ── Generic password = value ──
  {
    type: 'password_assignment',
    placeholder: '[REDACTED:PASSWORD]',
    // password=foo | password:"foo" | password: 'foo' | "password": "foo"
    regex: /\b(password|passwd|pwd|secret|api_key|apikey|apiToken|accessToken|refreshToken|clientSecret|privateKey)\s*[:=]\s*['"]([^'"\n]{4,})['"]/gi,
    severity: 'critical',
  },
  // ── Private keys PEM blocks ──
  {
    type: 'private_key_pem',
    placeholder: '[REDACTED:PRIVATE_KEY_PEM]',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  // ── Slack ──
  {
    type: 'slack_token',
    placeholder: '[REDACTED:SLACK_TOKEN]',
    regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}/g,
    severity: 'critical',
  },
  // ── Twilio ──
  {
    type: 'twilio_auth_token',
    placeholder: '[REDACTED:TWILIO_AUTH_TOKEN]',
    regex: /\bSK[0-9a-fA-F]{32}\b/g,
    severity: 'critical',
  },
  // ── Webhooks assinados (Zélla usa alguns) ──
  {
    type: 'webhook_secret',
    placeholder: '[REDACTED:WEBHOOK_SECRET]',
    regex: /\b(?:WEBHOOK_SECRET|SIGNING_SECRET|CACHE_SIGNING_SECRET|ENCRYPTION_SECRET|NEXTAUTH_SECRET|ZCC_MASTER_KEY|ZCC_GODMODE_TOKEN)\s*[:=]\s*['"]?[A-Za-z0-9+/=]{16,}['"]?/gi,
    severity: 'critical',
  },
  // ── PIX keys (Brazilian payment system) ──
  {
    type: 'pix_key',
    placeholder: '[REDACTED:PIX_KEY]',
    // matches common PIX key formats: email, phone +@, CPF (11 digits), CNPJ (14), random UUID-like
    regex: /\b(?:pix_key|PIX_KEY|chavePix|chave_pix)\s*[:=]\s*['"]([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|\d{11}|\d{14}|[\w.+-]+@[\w-]+\.[\w.-]+)['"]/gi,
    severity: 'warning',
  },
  // ── CPF/CNPJ (Brazilian tax IDs) — only when labeled ──
  {
    type: 'cpf_cnpj',
    placeholder: '[REDACTED:CPF_CNPJ]',
    regex: /\b(?:cpf|cnpj|CPF|CNPJ|documentNumber|document_number)\s*[:=]\s*['"]?\d{11,14}['"]?/g,
    severity: 'warning',
  },
  // ── Credit card numbers (basic Luhn-not-checked here, just format) ──
  {
    type: 'credit_card',
    placeholder: '[REDACTED:CREDIT_CARD]',
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical',
  },
];

// ── Helper: contar matches ───────────────────────────────────────────────────

function countMatches(text: string, regex: RegExp): number {
  // Reset regex state (global regexes maintain lastIndex)
  const re = new RegExp(regex.source, regex.flags);
  let count = 0;
  while (re.exec(text) !== null) {
    count++;
    if (count > 1000) break; // safety cap
  }
  return count;
}

// ── Main: redactSecrets ─────────────────────────────────────────────────────

export function redactSecrets(input: string): RedactionResult {
  let redacted = input;
  const foundMap = new Map<string, RedactedSecret>();

  for (const pattern of SECRET_PATTERNS) {
    const count = countMatches(input, pattern.regex);
    if (count === 0) continue;

    // Apply substitution (use placeholder)
    redacted = redacted.replace(pattern.regex, pattern.placeholder);

    foundMap.set(pattern.type, {
      type: pattern.type,
      count,
      placeholder: pattern.placeholder,
    });
  }

  const foundSecrets = Array.from(foundMap.values());
  return {
    redacted,
    foundSecrets,
    hasSecrets: foundSecrets.length > 0,
  };
}

// ── Helper: redact file path (para logs) ────────────────────────────────────
// Mantém o path do arquivo mas redact segmentos que parecem conter secrets
export function redactPath(filePath: string): string {
  // Heurística simples: se o path contém "secret"/"token"/"key"/".env" → mascara
  if (/(secret|token|\.env|\.pem|\.key|password|credential)/i.test(filePath)) {
    return '[REDACTED_PATH]';
  }
  return filePath;
}

// ── Helper: listar tipos de segredos detectados (para auditoria no DB) ──────

export function summarizeRedactions(found: RedactedSecret[]): string {
  if (found.length === 0) return 'no_secrets_detected';
  return found.map((s) => `${s.type}×${s.count}`).join(',');
}

// ── Test helper ──────────────────────────────────────────────────────────────

export function _testRedactor(): void {
  const sample = `
    const apiKey = "sk-abc1234567890abcdefghijklmnopqrstuvwxyz";
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0hDCzM8";
    const conn = "postgresql://admin:supers3cret@db.example.com:5432/prod";
    const stripeKeySample = "SAMPLE_REDacted_NOT_A_REAL_KEY_xxxxx";
    const password = "mySecretPassword123";
    process.env.NEXTAUTH_SECRET = "abc123def456ghi789jkl012mno345pqr";
  `;
  const result = redactSecrets(sample);
   
  console.log('[SecretRedactor test]', {
    hasSecrets: result.hasSecrets,
    types: result.foundSecrets.map((s) => `${s.type}×${s.count}`),
    redacted: result.redacted,
  });
}
