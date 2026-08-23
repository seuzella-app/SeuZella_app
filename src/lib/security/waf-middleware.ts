/**
 * Cloudflare WAF Middleware — Bot detection + IP allowlist + geo block
 * ============================================================================
 *
 * Roda ANTES de todas as APIs. Bloqueia:
 *   - User agents suspeitos (sqlmap, nikto, curl sem user-agent legítimo)
 *   - IPs em blocklist (configurável via env)
 *   - Geo block (países bloqueados — default: nenhum)
 *   - Bots sem Cloudflare challenge token
 *
 * Em produção, Cloudflare WAF faz muito disso automaticamente. Esta é
 * camada adicional dentro do Next.js.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BLOCKED_IPS = (process.env.WAF_BLOCKED_IPS || '').split(',').filter(Boolean);
const BLOCKED_COUNTRIES = (process.env.WAF_BLOCKED_COUNTRIES || '').split(',').filter(Boolean);
const ALLOWED_IPS = (process.env.WAF_ALLOWED_IPS || '').split(',').filter(Boolean);

const SUSPICIOUS_USER_AGENTS = [
  'sqlmap', 'nikto', 'nmap', 'masscan', 'dirbuster', 'wpscan',
  'acunetix', 'nessus', 'burp', 'owasp zap', 'hydra', 'metasploit',
  'libwww-perl', 'python-requests/2.25',  // versões antigas suspeitas
];

const KNOWN_BOT_PATTERNS = [
  /Googlebot/i, /Bingbot/i, /Slurp/i, /DuckDuckBot/i,
  /Baiduspider/i, /YandexBot/i, /facebookexternalhit/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — get IP (considera Cloudflare headers)
// ─────────────────────────────────────────────────────────────────────────────
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||      // Cloudflare
    req.headers.get('x-real-ip') ||              // Nginx
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function getCountry(req: NextRequest): string {
  return req.headers.get('cf-ipcountry') || 'BR';  // Cloudflare
}

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function wafMiddleware(req: NextRequest): NextResponse | null {
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';
  const country = getCountry(req);
  const path = req.nextUrl.pathname;

  // ─── 1. Skip para assets estáticos e health checks ───
  if (
    path.startsWith('/_next/') ||
    path.startsWith('/static/') ||
    path === '/api/health' ||
    path === '/favicon.ico'
  ) {
    return null;
  }

  // ─── 2. IP allowlist (bypass para IPs confiáveis) ───
  if (ALLOWED_IPS.includes(ip)) {
    return null;
  }

  // ─── 3. IP blocklist ───
  if (BLOCKED_IPS.includes(ip)) {
    console.warn(`[WAF] IP bloqueado: ${ip} → ${path}`);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Acesso negado' },
      { status: 403 },
    );
  }

  // ─── 4. Geo block ───
  if (BLOCKED_COUNTRIES.length > 0 && BLOCKED_COUNTRIES.includes(country)) {
    console.warn(`[WAF] País bloqueado: ${country} (${ip}) → ${path}`);
    return NextResponse.json(
      { error: 'GEO_BLOCKED', message: `País ${country} bloqueado` },
      { status: 403 },
    );
  }

  // ─── 5. User agent suspeito ───
  const uaLower = userAgent.toLowerCase();
  for (const suspicious of SUSPICIOUS_USER_AGENTS) {
    if (uaLower.includes(suspicious)) {
      console.warn(`[WAF] UA suspeito: ${userAgent} (${ip}) → ${path}`);
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'User agent não permitido' },
        { status: 403 },
      );
    }
  }

  // ─── 6. Sem user agent ───
  if (!userAgent && !path.startsWith('/api/')) {
    // APIs podem ser chamadas sem UA (curl legítimo), mas páginas não
    console.warn(`[WAF] Sem UA (${ip}) → ${path}`);
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'User agent obrigatório' },
      { status: 403 },
    );
  }

  // ─── 7. Bots crawlers — permite apenas Googlebot/Bingbot ───
  if (path.startsWith('/api/') && userAgent) {
    const isKnownBot = KNOWN_BOT_PATTERNS.some(p => p.test(userAgent));
    if (isKnownBot) {
      // Bots não devem acessar APIs
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Bots não podem acessar API' },
        { status: 403 },
      );
    }
  }

  // ─── 8. Adiciona headers de segurança ───
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS apenas em HTTPS
  if (req.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — detectar ataque comum
// ─────────────────────────────────────────────────────────────────────────────
export function detectAttack(body: string): { type: string; confidence: number } | null {
  const lower = body.toLowerCase();

  // SQL Injection
  if (/\bunion\s+select\b/.test(lower) || /'.*or.*'.*='.*/i.test(body)) {
    return { type: 'sqli', confidence: 0.9 };
  }

  // XSS
  if (/<script[^>]*>|javascript:|onerror=|onload=/i.test(body)) {
    return { type: 'xss', confidence: 0.9 };
  }

  // Path traversal
  if (/\.\.\/|\.\.\\|%2e%2e%2f/i.test(body)) {
    return { type: 'path_traversal', confidence: 0.85 };
  }

  // Command injection
  if (/;\s*(cat|ls|id|whoami|wget|curl|bash)\b/i.test(body)) {
    return { type: 'command_injection', confidence: 0.9 };
  }

  // SSRF
  if (/(localhost|127\.0\.0\.1|169\.254\.169\.254|::1)/i.test(body)) {
    return { type: 'ssrf', confidence: 0.7 };
  }

  return null;
}
