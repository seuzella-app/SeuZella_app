// =============================================================================
// 🔐 SEU ZÉLLA — HTTP Client utilitário para providers de fechadura
// =============================================================================
// Wrapper minimal sobre fetch com:
// - Timeout configurável (default 10s — nunca travar thread)
// - Retry exponencial (3 tentativas, backoff 500ms/1s/2s)
// - Tratamento padronizado de erros HTTP
// - User-Agent identificável (para logs do provedor)
// =============================================================================

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface HttpResult<T> {
  ok: boolean;
  status: number;
  data: T;
  raw: string;
  retried: number;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_RETRIES = 3;
const USER_AGENT = 'SeuZella-LockOrchestrator/1.0 (+https://seuzella.com)';

/**
 * Faz uma requisição HTTP com timeout + retry exponencial.
 * Lança erro apenas se todas as tentativas falharem (network error).
 * Para respostas HTTP 4xx/5xx, retorna HttpResult.ok=false (sem lançar).
 */
export async function httpRequest<T = any>(
  url: string,
  options: HttpOptions = {},
): Promise<HttpResult<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_RETRIES,
  } = options;

  const finalHeaders: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...headers,
  };

  const bodyStr =
    body && typeof body === 'object' ? JSON.stringify(body) : (body as string | undefined);
  if (bodyStr && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Backoff exponencial: 0ms, 500ms, 1000ms, 2000ms...
    if (attempt > 0) {
      const backoff = 500 * Math.pow(2, attempt - 1);
      await sleep(backoff);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: finalHeaders,
        body: bodyStr,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const raw = await res.text();
      let parsed: any = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        // resposta não-JSON — mantém raw
      }

      // 429 Too Many Requests — backoff maior
      if (res.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '2', 10);
        await sleep(Math.min(retryAfter, 10) * 1000);
        continue;
      }

      // 5xx — retry
      if (res.status >= 500 && attempt < maxRetries - 1) {
        continue;
      }

      return {
        ok: res.ok,
        status: res.status,
        data: parsed as T,
        raw,
        retried: attempt,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;
      // Network error / abort — retry com backoff
      if (attempt < maxRetries - 1) continue;
    }
  }

  // Todas as tentativas falharam
  throw new Error(
    `HTTP ${method} ${url} failed after ${maxRetries} attempts: ${lastErr?.message ?? 'unknown error'}`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formata uma data no formato ISO 8601 esperado pelas APIs (sem milissegundos).
 */
export function toApiDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Valida se um telefone está no formato E.164 (ex: +5511999888777).
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Normaliza um telefone brasileiro para E.164.
 * Aceita: (11) 99999-8888 / 11999998888 / +5511999998888
 */
export function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith('55')) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}
