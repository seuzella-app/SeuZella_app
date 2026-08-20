import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const lookupAsync = promisify(dns.lookup);

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFValidationError';
  }
}

/**
 * Verifica se um IP (IPv4 ou IPv6) pertence a faixas privadas, reservadas ou perigosas
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 10.0.0.0/8 (Private RFC 1918)
    if (parts[0] === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private RFC 1918)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private RFC 1918)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 224.0.0.0/4 (Multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (Reserved)
    if (parts[0] >= 240) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // :: (Unspecified)
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // fc00::/7 (Unique Local Address)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // ff00::/8 (Multicast)
    if (normalized.startsWith('ff')) return true;

    // IPv4-mapped IPv6 (::ffff:192.0.2.128)
    if (normalized.includes('::ffff:')) {
      const ipv4Part = normalized.split('::ffff:')[1];
      if (net.isIPv4(ipv4Part)) {
        return isPrivateOrReservedIP(ipv4Part);
      }
    }

    return false;
  }

  // Not a valid IP format
  return true;
}

/**
 * Valida uma URL externa contra ataques SSRF e DNS Rebinding
 */
export async function validateSafeExternalUrl(targetUrl: string): Promise<URL> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new SSRFValidationError('INVALID_URL_FORMAT');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SSRFValidationError('FORBIDDEN_PROTOCOL');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Bloqueia hostnames triviais locais
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '169.254.169.254'
  ) {
    throw new SSRFValidationError('FORBIDDEN_LOCAL_HOSTNAME');
  }

  // Se o hostname já for um IP direto, valida imediatamente
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new SSRFValidationError('FORBIDDEN_PRIVATE_IP');
    }
    return parsedUrl;
  }

  // Resolução prévia de DNS para mitigar DNS Rebinding
  try {
    const addresses = await lookupAsync(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new SSRFValidationError('DNS_RESOLUTION_FAILED');
    }

    for (const record of addresses) {
      if (isPrivateOrReservedIP(record.address)) {
        throw new SSRFValidationError(`FORBIDDEN_RESOLVED_IP: ${record.address}`);
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFValidationError) throw err;
    throw new SSRFValidationError(`DNS_LOOKUP_ERROR: ${err?.message || 'Failed'}`);
  }

  return parsedUrl;
}

/**
 * Safe fetch wrapper com validação SSRF e revalidação de redirects
 */
export async function safeExternalFetch(
  url: string,
  init?: RequestInit,
  maxRedirects = 3
): Promise<Response> {
  let currentUrl = url;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    const validatedUrl = await validateSafeExternalUrl(currentUrl);

    const response = await fetch(validatedUrl.toString(), {
      ...init,
      redirect: 'manual', // Trata redirects manualmente para revalidar cada salto contra SSRF
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return response;
      }
      redirectsCount++;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new SSRFValidationError('MAX_REDIRECTS_EXCEEDED');
}

/**
 * Helper unificado para checagem rápida de SSRF retornando objeto { safe, reason }
 */
export async function validateUrlSafeForSsrf(targetUrl: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    await validateSafeExternalUrl(targetUrl);
    return { safe: true };
  } catch (err: any) {
    return { safe: false, reason: err?.message || 'URL bloqueada por segurança SSRF' };
  }
}

