// ==============================================================================
// Meta Event Normalizer — Fase 4 (unit tests)
// ==============================================================================
// Contratos sob teste:
//  - MetaInboundMessage: tenantId/channel/eventType/externalEventId/timestamp/
//    source/metadata + referral
//  - MetaOutboundStatus com MetaPricingEvent (billable true/false, UNKNOWN)
//  - Payload malformado NUNCA lança — normalização defensiva
// ==============================================================================
import { describe, it, expect } from 'vitest';
import {
  normalizeMetaInboundMessages,
  normalizeMetaOutboundStatuses,
  extractWebhookValues,
} from '@/lib/meta/meta-normalizer';
import { normalizeMetaPricingCategory } from '@/lib/meta/meta-types';

const ENVELOPE_KEYS = ['channel', 'eventType', 'externalEventId', 'timestamp', 'source', 'metadata'];

describe('🔁 Meta Normalizer — mensagens inbound (Fase 4)', () => {
  const value = {
    metadata: { display_phone_number: '5548999990000', phone_number_id: 'PN123' },
    contacts: [{ wa_id: '5511988888888', profile: { name: 'Maria' } }],
    messages: [
      {
        from: '5511988888888',
        id: 'wamid.ABC123',
        timestamp: '1758019200',
        type: 'text',
        text: { body: 'Tem vaga pra amanhã?' },
        referral: {
          source_url: 'https://fb.com/ad/1',
          source_id: 'ad-999',
          source_type: 'ad',
          headline: 'Pousada Rosa — temporada',
          body: 'Reserve direto',
        },
      },
    ],
  };

  it('normaliza mensagem inbound com envelope completo', () => {
    const [msg] = normalizeMetaInboundMessages(value, 'WABA1');
    expect(msg).toBeTruthy();
    for (const key of ENVELOPE_KEYS) {
      expect(msg!).toHaveProperty(key);
    }
    expect(msg!.eventType).toBe('message.received');
    expect(msg!.channel).toBe('WHATSAPP');
    expect(msg!.externalEventId).toBe('wamid.ABC123');
    expect(msg!.messageText).toBe('Tem vaga pra amanhã?');
    expect(msg!.phoneNumberId).toBe('PN123');
    expect(msg!.wabaId).toBe('WABA1');
  });

  it('normaliza referral Click-to-WhatsApp (Fase 9)', () => {
    const [msg] = normalizeMetaInboundMessages(value, 'WABA1');
    expect(msg!.referral).not.toBeNull();
    expect(msg!.referral!.sourceId).toBe('ad-999');
    expect(msg!.referral!.sourceType).toBe('ad');
    expect(msg!.referral!.headline).toBe('Pousada Rosa — temporada');
  });

  it('mensagem sem referral → referral null (não lança)', () => {
    const noRef = { ...value, messages: [{ ...value.messages[0], referral: undefined }] };
    const [msg] = normalizeMetaInboundMessages(noRef, 'WABA1');
    expect(msg!.referral).toBeNull();
  });

  it('mensagem malformada (sem id/from) é descartada sem lançar', () => {
    const broken = { metadata: value.metadata, messages: [{ type: 'text' }] };
    expect(() => normalizeMetaInboundMessages(broken, 'WABA1')).not.toThrow();
    expect(normalizeMetaInboundMessages(broken, 'WABA1')).toHaveLength(0);
  });
});

describe('📤 Meta Normalizer — status outbound + pricing (Fase 6)', () => {
  it('status delivered com pricing billable=true → categoria preservada', () => {
    const value = {
      statuses: [
        {
          id: 'wamid.OUT1',
          status: 'delivered',
          timestamp: '1758019300',
          recipient_id: '5511988888888',
          conversation: { id: 'conv1', origin: { type: 'marketing' } },
          pricing: { billable: true, pricing_model: 'CBP', category: 'marketing' },
        },
      ],
    };
    const [st] = normalizeMetaOutboundStatuses(value);
    expect(st!.status).toBe('delivered');
    expect(st!.pricing!.billable).toBe(true);
    expect(st!.pricing!.category).toBe('marketing');
    expect(st!.conversationOriginType).toBe('marketing');
  });

  it('pricing billable=false → registrado como não-cobrável (não descartado)', () => {
    const value = {
      statuses: [
        {
          id: 'wamid.OUT2',
          status: 'sent',
          timestamp: '1758019300',
          recipient_id: '5511988888888',
          pricing: { billable: false, pricing_model: 'CBP', category: 'service' },
        },
      ],
    };
    const [st] = normalizeMetaOutboundStatuses(value);
    expect(st!.pricing!.billable).toBe(false);
    expect(st!.pricing!.category).toBe('service');
  });

  it('categoria desconhecida → UNKNOWN (não inventa, não descarta)', () => {
    const value = {
      statuses: [
        {
          id: 'wamid.OUT3',
          status: 'sent',
          timestamp: '1758019300',
          recipient_id: 'x',
          pricing: { billable: true, pricing_model: 'CBP', category: 'hypernova_2027' },
        },
      ],
    };
    const [st] = normalizeMetaOutboundStatuses(value);
    expect(st!.pricing!.category).toBe('UNKNOWN');
  });

  it('status com erros → errorMessage capturado', () => {
    const value = {
      statuses: [
        {
          id: 'wamid.OUT4',
          status: 'failed',
          timestamp: '1758019300',
          recipient_id: 'x',
          errors: [{ code: 131047, title: 'Re-engagement message', message: 'More than 24h' }],
        },
      ],
    };
    const [st] = normalizeMetaOutboundStatuses(value);
    expect(st!.status).toBe('failed');
    expect(st!.errorMessage).toContain('24h');
  });
});

describe('🧩 Meta Normalizer — extração de values do payload bruto', () => {
  it('extrai entry/changes field=messages com wabaId', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WABA1',
          changes: [{ field: 'messages', value: { statuses: [] } }],
        },
      ],
    };
    const values = extractWebhookValues(payload);
    expect(values).toHaveLength(1);
    expect(values[0].wabaId).toBe('WABA1');
    expect(values[0].field).toBe('messages');
  });

  it('payload de outro objeto → vazio (defensivo)', () => {
    expect(extractWebhookValues({ object: 'instagram' })).toHaveLength(0);
    expect(extractWebhookValues(null)).toHaveLength(0);
  });
});

describe('🔤 normalizeMetaPricingCategory', () => {
  it('aceita categorias oficiais', () => {
    for (const c of ['marketing', 'utility', 'authentication', 'service', 'marketing_lite']) {
      expect(normalizeMetaPricingCategory(c)).toBe(c);
    }
  });
  it('normaliza casing e rejeita desconhecidas', () => {
    expect(normalizeMetaPricingCategory('MARKETING')).toBe('marketing');
    expect(normalizeMetaPricingCategory('qualquer_coisa')).toBe('UNKNOWN');
    expect(normalizeMetaPricingCategory(undefined)).toBe('UNKNOWN');
  });
});
