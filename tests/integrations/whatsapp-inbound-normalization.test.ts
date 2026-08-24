import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppInboundMessage } from '@/lib/whatsapp/inbound-message';

describe('WhatsApp inbound normalization', () => {
  it('normalizes identifiers and creates deterministic idempotency key', () => {
    const result = normalizeWhatsAppInboundMessage({
      providerMessageId: ' wamid.ABC123 ',
      tenantId: ' tenant-1 ',
      guestPhone: '+55 (11) 99999-0000',
      guestName: ' Maria ',
      displayPhoneNumber: '+55 (11) 4000-0000',
      messageType: 'text',
      content: '  Quero saber o horário do café  ',
    });

    expect(result.idempotencyKey).toBe('whatsapp:wamid.ABC123');
    expect(result.message.guestPhone).toBe('5511999990000');
    expect(result.message.displayPhoneNumber).toBe('551140000000');
    expect(result.message.content).toBe('Quero saber o horário do café');
  });

  it('rejects missing provider identity or tenant context', () => {
    expect(() => normalizeWhatsAppInboundMessage({
      providerMessageId: '', tenantId: 't1', guestPhone: '5511', displayPhoneNumber: '5521', messageType: 'text', content: 'oi',
    })).toThrow('WHATSAPP_PROVIDER_MESSAGE_ID_REQUIRED');

    expect(() => normalizeWhatsAppInboundMessage({
      providerMessageId: 'wamid.1', tenantId: '', guestPhone: '5511', displayPhoneNumber: '5521', messageType: 'text', content: 'oi',
    })).toThrow('WHATSAPP_TENANT_ID_REQUIRED');
  });
});
