/**
 * ============================================================================
 * 🛡️ SAFE FETCH — Prevenção Definitiva de SSRF & DNS Rebinding
 * ============================================================================
 *
 * Características:
 * 1. Protocolo restrito exclusivamente a `https://`.
 * 2. Bloqueio pré-fetch via resolução DNS de todos os IPs privados/reservados:
 *    - 127.0.0.0/8 (Loopback)
 *    - 10.0.0.0/8 (RFC 1918)
 *    - 172.16.0.0/12 (RFC 1918)
 *    - 192.168.0.0/16 (RFC 1918)
 *    - 169.254.0.0/16 (Link-local / Cloud Metadata)
 *    - ::1, fc00::/7, fe80::/10 (IPv6)
 *    - localhost, *.internal, metadata.google.internal
 * 3. Resolução manual de redirecionamentos (redirect: 'manual') validando cada hop.
 * 4. Limite estrito de tamanho de resposta e timeout com AbortSignal.
 * ============================================================================
 */

import dns from 'dns';
import { promisify } from 'util';
import net from 'net';
import { isPrivateOrReservedIP } from './ssrf-protection';

const lookupAsync = promisify(dns.lookup);

export class SafeFetchSSRFError extends Error {
  constructor(message: string, public readonly code: string = 'SSRF_BLOCKED') {
    super(message);
    this.name = 'SafeFetchSSRFError';
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  method?: string;
  body?: string;
}

export interface SafeFetchResult {
  status: number;
  statusText: string;
  headers: Headers;
  text: () => Promise<string>;
  buffer: () => Promise<Buffer>;
  finalUrl: string;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_TIMEOUT_MS = 10000;          // 10s
const DEFAULT_MAX_REDIRECTS = 3;

/**
 * Valida se uma URL e seu host resolvido por DNS são seguros contra SSRF.
 */
export async function assertUrlIsSafeForFetch(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new SafeFetchSSRFError('URL com formato inválido', 'INVALID_URL_FORMAT');
  }

  // 1. Estrita checagem de protocolo HTTPS
  if (parsed.protocol !== 'https:') {
    throw new SafeFetchSSRFError(`Protocolo proibido: ${parsed.protocol}. Apenas https:// é permitido.`, 'FORBIDDEN_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Bloqueio de domínios conhecidos de metadata e locais
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254'
  ) {
    throw new SafeFetchSSRFError(`Hostname proibido por política SSRF: ${hostname}`, 'FORBIDDEN_HOSTNAME');
  }

  // 3. Validação de IP se for literal
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new SafeFetchSSRFError(`IP direto proibido (privado/reservado): ${hostname}`, 'FORBIDDEN_IP');
    }
    return parsed;
  }

  // 4. Resolução DNS e checagem de todos os IPs retornados
  try {
    const lookupResult = await lookupAsync(hostname, { all: true });
    const records = Array.isArray(lookupResult) ? lookupResult : [lookupResult];

    if (!records.length) {
      throw new SafeFetchSSRFError(`Nenhum registro DNS encontrado para o host: ${hostname}`, 'DNS_RESOLUTION_FAILED');
    }

    for (const record of records) {
      if (isPrivateOrReservedIP(record.address)) {
        throw new SafeFetchSSRFError(
          `Host ${hostname} resolve para IP privado/reservado proibido: ${record.address}`,
          'FORBIDDEN_RESOLVED_IP'
        );
      }
    }
  } catch (err: any) {
    if (err instanceof SafeFetchSSRFError) throw err;
    throw new SafeFetchSSRFError(`Falha na resolução DNS para ${hostname}: ${err.message}`, 'DNS_LOOKUP_ERROR');
  }

  return parsed;
}

/**
 * Executa requisição HTTP externa com proteção anti-SSRF de ponta a ponta.
 */
export async function safeFetchExternalUrl(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = url;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // Valida cada URL (incluindo destinos de redirect)
    await assertUrlIsSafeForFetch(currentUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        redirect: 'manual', // NUNCA seguir redirects cegamente
      });

      clearTimeout(timeoutId);

      // Tratamento de Redirecionamentos (301, 302, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const locationHeader = res.headers.get('location');
        if (!locationHeader) {
          throw new SafeFetchSSRFError('Redirecionamento sem header Location', 'MISSING_REDIRECT_LOCATION');
        }

        const nextUrl = new URL(locationHeader, currentUrl).toString();
        redirectsCount++;
        if (redirectsCount > maxRedirects) {
          throw new SafeFetchSSRFError(`Excedido limite de ${maxRedirects} redirecionamentos`, 'TOO_MANY_REDIRECTS');
        }

        currentUrl = nextUrl;
        continue;
      }

      // Verificação defensiva de Content-Length
      const contentLengthHeader = res.headers.get('content-length');
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > maxBytes) {
        throw new SafeFetchSSRFError(
          `Resposta excede tamanho máximo permitido de ${maxBytes} bytes (Content-Length: ${contentLengthHeader})`,
          'PAYLOAD_TOO_LARGE'
        );
      }

      return {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        finalUrl: currentUrl,
        text: async () => {
          const rawText = await res.text();
          if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
            throw new SafeFetchSSRFError(
              `Payload recebido excede o limite máximo permitido de ${maxBytes} bytes`,
              'PAYLOAD_TOO_LARGE'
            );
          }
          return rawText;
        },
        buffer: async () => {
          const arrayBuffer = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuffer);
          if (buf.byteLength > maxBytes) {
            throw new SafeFetchSSRFError(
              `Payload recebido excede o limite máximo permitido de ${maxBytes} bytes`,
              'PAYLOAD_TOO_LARGE'
            );
          }
          return buf;
        },
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof SafeFetchSSRFError) throw err;
      if (err.name === 'AbortError') {
        throw new SafeFetchSSRFError(`Timeout na requisição após ${timeoutMs}ms`, 'FETCH_TIMEOUT');
      }
      throw new SafeFetchSSRFError(`Erro na requisição segura: ${err.message}`, 'FETCH_FAILED');
    }
  }

  throw new SafeFetchSSRFError('Número máximo de redirecionamentos excedido', 'TOO_MANY_REDIRECTS');
}
