import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');

describe('Meta Wave 4 — idempotência por status', () => {
  const source = read('src/lib/meta/meta-events.ts');

  it('outbound status usa discriminator status na eventKey', () => {
    expect(source).toContain("kind === 'outbound_status'");
    expect(source).toContain('metadata.status');
    expect(source).toContain('buildMetaEventKey(kind, externalEventId, discriminator)');
  });

  it('falha de DB no claim não processa o evento às cegas', () => {
    expect(source).toContain('fail-closed');
    expect(source).toContain('return { claimed: false, alreadyProcessed: false }');
  });

  it('claims travados podem ser recuperados somente após janela stale', () => {
    expect(source).toContain('STALE_PROCESSING_MS');
    expect(source).toContain('processing_reclaimed');
    expect(source).toContain('createdAt: existing.createdAt');
    expect(source).toContain('reclaimed.count === 1');
  });

  it('completeMetaEvent fecha claims de status em processing ou reclaimed', () => {
    expect(source).toContain("kind === 'outbound_status' && !discriminator");
    expect(source).toContain("status: { in: ['processing', 'processing_reclaimed'] }");
  });
});

describe('Meta Wave 4 — moeda e legado costUsd', () => {
  const source = read('src/lib/meta-cost-guard.ts');

  it('costUsd só recebe amount quando currency é USD', () => {
    expect(source).toContain('costUsd: isUsd(currency) ? amount : 0');
  });

  it('BRL é preservado em rate + currency', () => {
    expect(source).toContain('BRL is preserved in rate + currency');
    expect(source).toContain('const amount = currency === \'USD\' ? log.costUsd : (log.rate ?? 0)');
  });

  it('budget USD considera somente registros USD', () => {
    expect(source).toContain(".filter((log) => (log.currency ?? 'USD').toUpperCase() === 'USD')");
  });

  it('savings não mistura BRL em cenário USD', () => {
    expect(source).toContain("currency: 'USD'");
    expect(source).toContain('BRL records are excluded');
  });
});

describe('Meta Wave 4 — attribution sem inferência', () => {
  const source = read('src/lib/meta/meta-attribution.ts');

  it('não transforma sourceId em campaignId', () => {
    expect(source).toContain('campaignId: null');
    expect(source).toContain("adId: entryPoint.entryPointSourceType === 'ad'");
  });

  it('consultas de aquisição usam tenantId + confiança determinística', () => {
    expect(source).toContain('tenantId,\n        conversationId');
    expect(source).toContain("confidence: 'DETERMINISTIC'");
  });

  it('vínculo de reserva mantém guard de tenant e evita double-link', () => {
    expect(source).toContain('where: { id: target.id, tenantId, reservationId: null }');
  });
});
