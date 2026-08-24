import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppInboundMessage } from '@/lib/whatsapp/inbound-message';

describe('WhatsApp inbound security contract', () => {
  it('normalizes idempotency and phone identity before queueing', () => {
    const result = normalizeWhatsAppInboundMessage({
      providerMessageId: ' wamid.123 ',
      tenantId: ' tenant_1 ',
      guestPhone: '+55 (13) 99999-8888',
      guestName: ' Hóspede ',
      displayPhoneNumber: '+55 13 3000-0000',
      messageType: 'text',
      content: '  Olá  ',
    });
    expect(result.idempotencyKey).toBe('whatsapp:wamid.123');
    expect(result.message.guestPhone).toBe('5513999998888');
    expect(result.message.content).toBe('Olá');
  });

  it('fails closed without tenant identity', () => {
    expect(() => normalizeWhatsAppInboundMessage({
      providerMessageId: 'wamid.123',
      tenantId: '',
      guestPhone: '5513999998888',
      displayPhoneNumber: '5513300000000',
      messageType: 'text',
      content: 'Olá',
    })).toThrow('WHATSAPP_TENANT_ID_REQUIRED');
  });
});
