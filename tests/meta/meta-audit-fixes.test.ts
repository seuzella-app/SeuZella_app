// ==============================================================================
// Meta Foundation — Auditoria da onda de execução organizada (FASE 10)
// ==============================================================================
// Regras de regressão para as correções encontradas pela auditoria:
//  1. Middleware: /api/webhooks/whatsapp DEVE ser público (webhook canônico) —
//     a autenticação é HMAC dentro do handler, não sessão NextAuth.
//  2. vercel.json: config de função do webhook canônico (paridade com legado).
//  3. Feedback 👍/👎 do pipeline: assinatura posicional correta de
//     sendWhatsAppMessage (bug `to: from` com variável inexistente, mascarado
//     por @ts-nocheck, jamais pode voltar).
//  4. Cadeia FASE 7: pickAttributionForLink é PURA e só linka attribution
//     DETERMINISTIC + click_to_whatsapp + vigente; linkReservationToMetaAttribution
//     existe e é não-fatal; /api/v1/reservations chama o link após criar a reserva.
//  5. Nenhuma inferência: UNATTRIBUTED permanece UNATTRIBUTED.
// ==============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const has = (file: string) => existsSync(resolve(root, file));

// ── 1. Middleware expõe o webhook canônico ───────────────────────────────────

describe('🔓 Middleware — webhook canônico público (P0 da auditoria)', () => {
  const source = read('src/middleware.ts');

  it('/api/webhooks/whatsapp está em PUBLIC_API_PREFIXES', () => {
    expect(source).toContain("'/api/webhooks/whatsapp'");
  });

  it('webhook legado continua público (nenhuma mudança destrutiva)', () => {
    expect(source).toContain("'/api/webhook-whatsapp'");
  });

  it('rotas de debug continuam bloqueadas em produção', () => {
    expect(source).toContain("'/api/debug-agent'");
    expect(source).toContain("'/api/proxy'");
  });
});

// ── 2. vercel.json — função do webhook canônico ──────────────────────────────

describe('⚙️ vercel.json — função do webhook canônico', () => {
  const source = read('vercel.json');

  it('declara maxDuration/memória para src/app/api/webhooks/whatsapp/route.ts', () => {
    expect(source).toContain('"src/app/api/webhooks/whatsapp/route.ts"');
  });

  it('config do webhook legado preservada', () => {
    expect(source).toContain('"src/app/api/webhook-whatsapp/route.ts"');
  });
});

// ── 3. Feedback do pipeline — assinatura correta ─────────────────────────────

describe('📩 whatsapp-ai-responder — envio de feedback com assinatura correta', () => {
  const source = read('src/lib/whatsapp-ai-responder.ts');

  it('usa a assinatura posicional (toPhone, text, options)', () => {
    expect(source).toMatch(
      /sendWhatsAppMessage\(\s*guestPhone\s*,\s*feedbackMessage\s*,\s*\{/
    );
  });

  it('o padrão quebrado `to: from` NUNCA mais existe no arquivo', () => {
    expect(source).not.toMatch(/sendWhatsAppMessage\(\s*\{\s*tenantId\s*,\s*to:\s*from/);
  });

  it('correlationId de feedback presente (observabilidade)', () => {
    expect(source).toMatch(/correlationId:\s*`feedback-/);
  });
});

// ── 4. Cadeia FASE 7 — attribution → reservation ─────────────────────────────

describe('🔗 meta-attribution — fechamento da cadeia (FASE 7)', () => {
  it('pickAttributionForLink existe e é exportada', async () => {
    const mod = await import('../../src/lib/meta/meta-attribution');
    expect(typeof mod.pickAttributionForLink).toBe('function');
    expect(typeof mod.linkReservationToMetaAttribution).toBe('function');
  });

  it('SÓ linka attribution DETERMINISTIC + click_to_whatsapp', async () => {
    const { pickAttributionForLink } = await import('../../src/lib/meta/meta-attribution');
    const now = new Date('2026-09-16T12:00:00Z');
    const base = {
      id: 'attr-1',
      confidence: 'DETERMINISTIC',
      entryPointType: 'click_to_whatsapp',
      entryPointExpiresAt: new Date(now.getTime() + 86_400_000),
    };

    // elegível → retorna o evento
    expect(pickAttributionForLink([base], now)?.id).toBe('attr-1');

    // INFERRED → nunca linka (sem inferência)
    expect(
      pickAttributionForLink([{ ...base, confidence: 'INFERRED' }], now)
    ).toBeNull();

    // UNATTRIBUTED → nunca linka
    expect(
      pickAttributionForLink([{ ...base, confidence: 'UNATTRIBUTED' }], now)
    ).toBeNull();

    // entry point orgânico → nunca linka
    expect(
      pickAttributionForLink([{ ...base, entryPointType: 'organic' }], now)
    ).toBeNull();

    // janela expirada → nunca linka
    expect(
      pickAttributionForLink(
        [{ ...base, entryPointExpiresAt: new Date(now.getTime() - 1000) }],
        now
      )
    ).toBeNull();

    // lista vazia → null
    expect(pickAttributionForLink([], now)).toBeNull();

    // mantém o mais recente quando há múltiplos elegíveis (ordem do caller)
    expect(
      pickAttributionForLink(
        [base, { ...base, id: 'attr-2' }],
        now
      )?.id
    ).toBe('attr-1');
  });

  it('linkReservationToMetaAttribution rejeita parâmetros incompletos sem tocar o DB', async () => {
    const { linkReservationToMetaAttribution } = await import(
      '../../src/lib/meta/meta-attribution'
    );
    expect(
      await linkReservationToMetaAttribution({
        tenantId: '',
        guestPhone: '5511900000000',
        reservationId: 'res-1',
      })
    ).toBe(false);
  });

  it('/api/v1/reservations chama o link após criar a reserva (padrão não-fatal)', () => {
    const source = read('src/app/api/v1/reservations/route.ts');
    expect(source).toContain('linkReservationToMetaAttribution');
    expect(source).toMatch(
      /Meta attribution link failed \(reservation persisted\)/
    );
  });
});

// ── 5. Documentação operacional ──────────────────────────────────────────────

describe('📚 META_CONNECT_IMPLEMENTATION — URL canônica documentada', () => {
  const has = (file: string) => existsSync(resolve(root, file));
  it('doc existe e declara /api/webhooks/whatsapp como canônico', () => {
    expect(has('docs/META_CONNECT_IMPLEMENTATION.md')).toBe(true);
    const doc = read('docs/META_CONNECT_IMPLEMENTATION.md');
    expect(doc).toContain('/api/webhooks/whatsapp');
    expect(doc).toMatch(/Webhook canônico/i);
  });
});
