/**
 * FASE 02B — Regressão LGPD de logs (FRENTE 30).
 *
 * Hot path WhatsApp não pode logar: telefone completo do hóspede, conteúdo de
 * mensagem, credenciais. Exposições reais corrigidas nesta fase:
 *  - webhook (ACCEPTED/discard/opt-out/erros): msg.from/guestPhone mascarados,
 *    texto da mensagem REMOVIDO do log (substituído por textLength);
 *  - pulse-socket-server: NUCLEAR_TOKEN não é mais hardcoded nem impresso;
 *  - bsuid-resolver: phone/BSUID mascarados em warnings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const webhook = readFileSync(join(ROOT, 'src/app/api/webhooks/whatsapp/route.ts'), 'utf-8');
const pulse = readFileSync(join(ROOT, 'src/lib/pulse-socket-server.ts'), 'utf-8');
const bsuid = readFileSync(join(ROOT, 'src/lib/bsuid-resolver.ts'), 'utf-8');

describe('FASE 02B — webhook sem PII em logs', () => {
  it('ACEPTED log NÃO contém corpo da mensagem (textLength no lugar)', () => {
    expect(webhook).not.toMatch(/text: \$\{msg\.textContent/);
    expect(webhook).not.toMatch(/textContent\.substring\(0, 80\)/);
    expect(webhook).toMatch(/textLength: \$\{msg\.textContent \? msg\.textContent\.length : 0\}/);
  });

  it('telefones do hóspede mascarados em todos os caminhos (ACCEPTED/discard/erros/mídia)', () => {
    // nenhum log interpolando msg.from SEM máscara
    expect(webhook).not.toMatch(/console\.(log|warn|error)\([^)]*\$\{msg\.from\}/);
    // helper existe e é usado
    expect(webhook).toMatch(/function maskPhone\(/);
    expect(webhook).toMatch(/maskPhone\(msg\.from\)/);
    expect(webhook).toMatch(/maskPhone\(guestPhone\)/);
  });

  it('opt-out loga telefone mascarado (LGPD Art. 18 — evento sensível)', () => {
    expect(webhook).toMatch(/Opt-Out detectado — processando síncrono \(tenant \$\{tenantId\}, guest \$\{maskPhone\(guestPhone\)\}\)/);
    expect(webhook).toMatch(/Opt-out confirmado e enviado para \$\{maskPhone\(guestPhone\)\}/);
  });

  it('envio real continua usando o telefone completo (funcionalidade preservada)', () => {
    expect(webhook).toMatch(/sendWhatsAppMessage\(guestPhone, confirmationText\)/);
  });
});

describe('FASE 02B — credencial nuclear nunca hardcoded/impressa', () => {
  it('token não existe mais como literal no código', () => {
    expect(pulse).not.toContain('zella-nuclear-2026');
    expect(pulse).toMatch(/process\.env\.ZELLA_NUCLEAR_TOKEN/);
  });

  it('boot não imprime o token completo (mascarado)', () => {
    expect(pulse).toMatch(/NUCLEAR_TOKEN\.slice\(0, 4\)\}\*\*\*\*/);
    expect(pulse).not.toMatch(/Nuclear token: \$\{NUCLEAR_TOKEN\}/);
  });

  it('mensagem de erro não sugere o token antigo', () => {
    expect(pulse).not.toContain('confirmToken="zella-nuclear-2026"');
  });
});

describe('FASE 02B — bsuid-resolver sem PII em warnings', () => {
  it('phone/BSUID mascarados nos logs de conflito', () => {
    expect(bsuid).toMatch(/effectiveBsuid \? `\*\*\*\*\$\{String\(effectiveBsuid\)\.slice\(-4\)\}` : undefined/);
    expect(bsuid).toMatch(/normalizedPhone \? `\*\*\*\*\$\{String\(normalizedPhone\)\.slice\(-4\)\}` : undefined/);
  });

  it('upsert real continua usando o telefone completo (funcionalidade preservada)', () => {
    expect(bsuid).toMatch(/phone: normalizedPhone/);
  });
});
