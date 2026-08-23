/**
 * SAFE FETCH — SSRF and resource-exhaustion protection.
 * External URLs are HTTPS-only, DNS-validated, redirect-validated and size/time bounded.
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

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_REDIRECTS = 3;

export async function assertUrlIsSafeForFetch(targetUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new SafeFetchSSRFError('URL com formato inválido', 'INVALID_URL_FORMAT');
  }

  if (parsed.protocol !== 'https:') {
    throw new SafeFetchSSRFError('Apenas HTTPS é permitido', 'FORBIDDEN_PROTOCOL');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === '169.254.169.254'
  ) {
    throw new SafeFetchSSRFError(`Hostname proibido: ${hostname}`, 'FORBIDDEN_HOSTNAME');
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new SafeFetchSSRFError(`IP proibido: ${hostname}`, 'FORBIDDEN_IP');
    }
    return parsed;
  }

  try {
    const lookupResult = await lookupAsync(hostname, { all: true });
    const records = Array.isArray(lookupResult) ? lookupResult : [lookupResult];
    if (!records.length) throw new SafeFetchSSRFError('Nenhum registro DNS encontrado', 'DNS_RESOLUTION_FAILED');
    for (const record of records) {
      if (isPrivateOrReservedIP(record.address)) {
        throw new SafeFetchSSRFError(`Host resolve para IP proibido: ${record.address}`, 'FORBIDDEN_RESOLVED_IP');
      }
    }
  } catch (err) {
    if (err instanceof SafeFetchSSRFError) throw err;
    throw new SafeFetchSSRFError('Falha na resolução DNS', 'DNS_LOOKUP_ERROR');
  }

  return parsed;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new SafeFetchSSRFError(`Payload excede ${maxBytes} bytes`, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

export async function safeFetchExternalUrl(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = Math.max(1024, Math.min(options.maxBytes ?? DEFAULT_MAX_BYTES, 10 * 1024 * 1024));
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 30000));
  const maxRedirects = Math.max(0, Math.min(options.maxRedirects ?? DEFAULT_MAX_REDIRECTS, 5));

  let currentUrl = url;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    await assertUrlIsSafeForFetch(currentUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(currentUrl, {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
        redirect: 'manual',
      });

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const locationHeader = res.headers.get('location');
        if (!locationHeader) throw new SafeFetchSSRFError('Redirect sem Location', 'MISSING_REDIRECT_LOCATION');
        redirectsCount += 1;
        if (redirectsCount > maxRedirects) throw new SafeFetchSSRFError('Limite de redirects excedido', 'TOO_MANY_REDIRECTS');
        currentUrl = new URL(locationHeader, currentUrl).toString();
        continue;
      }

      const contentLength = Number(res.headers.get('content-length') || 0);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new SafeFetchSSRFError(`Content-Length excede ${maxBytes} bytes`, 'PAYLOAD_TOO_LARGE');
      }

      // Consume the body once and enforce the limit while streaming. This prevents
      // a large response without Content-Length from exhausting server memory.
      const body = await readLimitedBody(res, maxBytes);
      clearTimeout(timeoutId);

      return {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        finalUrl: currentUrl,
        text: async () => body.toString('utf8'),
        buffer: async () => Buffer.from(body),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof SafeFetchSSRFError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new SafeFetchSSRFError(`Timeout após ${timeoutMs}ms`, 'FETCH_TIMEOUT');
      }
      throw new SafeFetchSSRFError('Falha na requisição externa', 'FETCH_FAILED');
    }
  }

  throw new SafeFetchSSRFError('Número máximo de redirects excedido', 'TOO_MANY_REDIRECTS');
}
