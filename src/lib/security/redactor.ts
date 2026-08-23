/**
 * ============================================================================
 * 🛡️ CENTRAL SENSITIVE DATA REDACTOR & LLM PRIVACY BOUNDARY (LGPD)
 * ============================================================================
 *
 * Responsabilidades:
 * 1. Sanitizar senhas, segredos, Bearer tokens, CPF, CNPJ, PIX, cartões de crédito.
 * 2. `LLMDataRedactor`: Mascarar dados pessoais antes de enviar para LLMs externos
 *    (OpenAI, Google Gemini, Groq, Anthropic, Zai GLM).
 * 3. Prevenir vazamento de PII em logs estruturados e traces de observabilidade.
 * ============================================================================
 */

import { sanitizePIIWithProof } from './pii-sanitizer';

const SECRET_KEY_NAMES = new Set([
  'password',
  'senha',
  'secret',
  'clientsecret',
  'client_secret',
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'privatekey',
  'private_key',
  'jwt',
  'cvv',
  'cardnumber',
  'card_number',
]);

const SENSITIVE_REGEXES = {
  bearerToken: /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  apiKey: /\b(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|pat_[a-zA-Z0-9]{20,})\b/g,
  creditCard: /\b(?:\d[ -]*?){13,19}\b/g,
  cpf: /\b(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  phone: /(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9?\d{4}[\s.-]?\d{4})\b/g,
};

/**
 * Redige recursivamente strings, objetos e arrays
 */
export function redactSensitiveData<T = any>(data: T): T {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let result: string = String(data);
    // 1. Redação de Bearer Tokens e API Keys
    result = result.replace(SENSITIVE_REGEXES.bearerToken, 'Bearer [REDACTED_TOKEN]');
    result = result.replace(SENSITIVE_REGEXES.apiKey, '[REDACTED_API_KEY]');

    // 2. Redação de Cartões de Crédito (13 a 19 dígitos)
    result = result.replace(SENSITIVE_REGEXES.creditCard, (match: string) => {
      const clean = match.replace(/[\s-]/g, '');
      if (clean.length >= 13 && clean.length <= 19) {
        return `[CARD_****_${clean.slice(-4)}]`;
      }
      return match;
    });

    // 3. PII Sanitizer proof
    const piiResult = sanitizePIIWithProof(result);
    return piiResult.sanitized as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const redactedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z]/g, '');
      if (SECRET_KEY_NAMES.has(lowerKey)) {
        redactedObj[key] = '[REDACTED_SECRET]';
      } else {
        redactedObj[key] = redactSensitiveData(value);
      }
    }
    return redactedObj as T;
  }

  return data;
}

/**
 * Classe especializada em criar uma barreira de privacidade para LLMs
 */
export class LLMDataRedactor {
  /**
   * Sanitiza o contexto do prompt antes de despachar para APIs externas
   */
  static sanitizePromptContext(promptText: string): {
    sanitizedPrompt: string;
    hasRedactions: boolean;
    tokenMap: Map<string, string>;
  } {
    const tokenMap = new Map<string, string>();
    let counter = 1;

    // Substitui CPFs e documentos por tokens opacos
    let sanitized = promptText.replace(SENSITIVE_REGEXES.cpf, (match) => {
      const token = `[GUEST_DOC_${counter++}]`;
      tokenMap.set(token, match);
      return token;
    });

    // Redige cartões de crédito
    sanitized = sanitized.replace(SENSITIVE_REGEXES.creditCard, (match) => {
      const clean = match.replace(/[\s-]/g, '');
      if (clean.length >= 13 && clean.length <= 19) {
        const token = `[CARD_TOKEN_${counter++}]`;
        tokenMap.set(token, match);
        return token;
      }
      return match;
    });

    // Redige Bearer e API Keys
    sanitized = sanitized.replace(SENSITIVE_REGEXES.bearerToken, 'Bearer [REDACTED_TOKEN]');
    sanitized = sanitized.replace(SENSITIVE_REGEXES.apiKey, '[REDACTED_API_KEY]');

    const hasRedactions = sanitized !== promptText;

    return {
      sanitizedPrompt: sanitized,
      hasRedactions,
      tokenMap,
    };
  }

  /**
   * Restaura os tokens anonimizados na resposta do LLM se necessário
   */
  static restorePromptContext(responseText: string, tokenMap: Map<string, string>): string {
    let restored = responseText;
    for (const [token, original] of tokenMap.entries()) {
      restored = restored.replace(token, original);
    }
    return restored;
  }
}
