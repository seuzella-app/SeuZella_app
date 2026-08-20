import { describe, it, expect } from 'vitest';
import { assertUrlIsSafeForFetch, SafeFetchSSRFError } from '@/lib/security/safe-fetch';
import { isPrivateOrReservedIP } from '@/lib/security/ssrf-protection';

describe('🛡️ SSRF Protection & Safe Fetch Suite (P1)', () => {
  it('deve bloquear URLs com protocolo inseguro (http, file, gopher, ftp)', async () => {
    await expect(assertUrlIsSafeForFetch('http://example.com/calendar.ics')).rejects.toThrow(SafeFetchSSRFError);
    await expect(assertUrlIsSafeForFetch('file:///etc/passwd')).rejects.toThrow(SafeFetchSSRFError);
    await expect(assertUrlIsSafeForFetch('gopher://127.0.0.1:70/')).rejects.toThrow(SafeFetchSSRFError);
    await expect(assertUrlIsSafeForFetch('ftp://attacker.com/payload')).rejects.toThrow(SafeFetchSSRFError);
  });

  it('deve bloquear IPs de loopback e locais (127.0.0.1, localhost, ::1)', async () => {
    await expect(assertUrlIsSafeForFetch('https://127.0.0.1/admin')).rejects.toThrow(SafeFetchSSRFError);
    await expect(assertUrlIsSafeForFetch('https://localhost:3000/api/cron')).rejects.toThrow(SafeFetchSSRFError);
  });

  it('deve bloquear IPs privados RFC 1918 e Link-Local / Cloud Metadata', async () => {
    // 10.0.0.0/8
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    // 172.16.0.0/12
    expect(isPrivateOrReservedIP('172.20.0.1')).toBe(true);
    // 192.168.0.0/16
    expect(isPrivateOrReservedIP('192.168.1.1')).toBe(true);
    // AWS/GCP Metadata 169.254.169.254
    expect(isPrivateOrReservedIP('169.254.169.254')).toBe(true);
  });

  it('deve bloquear domínios de metadata da nuvem', async () => {
    await expect(assertUrlIsSafeForFetch('https://metadata.google.internal/computeMetadata/v1/')).rejects.toThrow(SafeFetchSSRFError);
    await expect(assertUrlIsSafeForFetch('https://service.internal/status')).rejects.toThrow(SafeFetchSSRFError);
  });

  it('deve permitir URLs HTTPS públicas legítimas', async () => {
    const parsed = await assertUrlIsSafeForFetch('https://airbnb.com/calendar/ical/123.ics');
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('airbnb.com');
  });
});
