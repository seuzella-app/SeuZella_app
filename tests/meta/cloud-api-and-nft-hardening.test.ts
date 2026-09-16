/**
 * FASE 02B — Regressões FRENTE 23 (cloud-api timeout) + FRENTE 47 (NFT tracing).
 *
 * cloud-api.ts é o sender template dormante (zero callers hoje, previsto para
 * templates no plano Meta Connect) — o timeout deve existir ANTES de adoção,
 * sem retry de POST (POST pode ter chegado à Meta; retry duplicaria mensagem).
 *
 * next.config.ts exclui .git/tests/docs/migrations do NFT da rota
 * /api/zcc/ze-code/apply (git-applier usa process.cwd() → traçava o projeto
 * inteiro, amplificando o pico de memória do build).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const cloudApi = readFileSync(join(ROOT, 'src/lib/whatsapp/cloud-api.ts'), 'utf-8');
const nextConfig = readFileSync(join(ROOT, 'next.config.ts'), 'utf-8');

describe('FASE 02B — cloud-api timeout seguro (FRENTE 23)', () => {
  it('fetch usa AbortController com timeout de 15s', () => {
    expect(cloudApi).toMatch(/new AbortController\(\)/);
    expect(cloudApi).toMatch(/CLOUD_API_TIMEOUT_MS = 15_000/);
    expect(cloudApi).toMatch(/signal: controller\.signal/);
  });

  it('timeout e erro de rede têm códigos próprios (observabilidade)', () => {
    expect(cloudApi).toMatch(/WHATSAPP_SEND_TIMEOUT/);
    expect(cloudApi).toMatch(/WHATSAPP_SEND_NETWORK_ERROR/);
  });

  it('NENHUM retry de POST (retry ciego duplicaria mensagem — FRENTE 24)', () => {
    // Sem estruturas de retry (loop de tentativas); a palavra "retry" só
    // aparece no comentário que DOCUMENTA a proibição.
    expect(cloudApi).not.toMatch(/for\s*\(.*attempt/);
    expect(cloudApi).not.toMatch(/while\s*\(/);
    expect(cloudApi).toMatch(/SEM retry \(POST pode ter chegado/);
  });

  it('timer limpo no finally (sem leak de handle)', () => {
    expect(cloudApi).toMatch(/finally\s*\{\s*\n\s*clearTimeout\(timer\);/);
  });
});

describe('FASE 02B — NFT over-tracing isolado (FRENTE 47)', () => {
  it('outputFileTracingExcludes cobre a rota ze-code/apply', () => {
    expect(nextConfig).toMatch(/outputFileTracingExcludes/);
    expect(nextConfig).toMatch(/'\/api\/zcc\/ze-code\/apply'/);
  });

  it('exclusões incluem .git (principal amplificador do traçado cwd())', () => {
    expect(nextConfig).toMatch(/'\.\/\.git\/\*\*\/\*'/);
  });

  it('serverExternalPackages preservado (prisma etc.)', () => {
    expect(nextConfig).toMatch(/serverExternalPackages/);
  });
});
