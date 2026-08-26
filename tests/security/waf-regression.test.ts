import { describe, expect, it } from 'vitest';
import { detectAttack, wafMiddleware } from '@/lib/security/waf-middleware';

describe('WAF regression', () => {
  it.each([
    ['union select', 'sqli'],
    ['<script>alert(1)</script>', 'xss'],
    ['../../etc/passwd', 'path_traversal'],
    ['; whoami', 'command_injection'],
    ['http://169.254.169.254/latest/meta-data', 'ssrf'],
  ])('detects %s as %s', (payload, type) => {
    expect(detectAttack(payload)?.type).toBe(type);
  });

  it('does not classify ordinary hotel content as an attack', () => {
    expect(detectAttack('Check-in às 14h. Quarto 203 com Wi-Fi e café da manhã.')).toBeNull();
  });

  it('returns a NextResponse for a suspicious user agent on a page request', () => {
    const request = new Request('https://example.test/dashboard', {
      headers: { 'user-agent': 'sqlmap/1.8' },
    });
    const response = wafMiddleware(request as any);
    expect(response?.status).toBe(403);
  });
});
