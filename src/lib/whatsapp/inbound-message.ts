export type WhatsAppInboundMessageType = 'text' | 'audio' | 'voice';

export interface WhatsAppInboundMessage {
  providerMessageId: string;
  tenantId: string;
  guestPhone: string;
  guestName?: string;
  displayPhoneNumber: string;
  messageType: WhatsAppInboundMessageType;
  content: string;
  mediaId?: string;
  timestamp?: string;
}

export interface WhatsAppInboundEnvelope {
  idempotencyKey: string;
  message: WhatsAppInboundMessage;
}

export function normalizeWhatsAppInboundMessage(input: WhatsAppInboundMessage): WhatsAppInboundEnvelope {
  const providerMessageId = input.providerMessageId.trim();
  const tenantId = input.tenantId.trim();
  const guestPhone = input.guestPhone.replace(/\D/g, '');
  const displayPhoneNumber = input.displayPhoneNumber.replace(/\D/g, '');

  if (!providerMessageId) throw new Error('WHATSAPP_PROVIDER_MESSAGE_ID_REQUIRED');
  if (!tenantId) throw new Error('WHATSAPP_TENANT_ID_REQUIRED');
  if (!guestPhone) throw new Error('WHATSAPP_GUEST_PHONE_REQUIRED');
  if (!displayPhoneNumber) throw new Error('WHATSAPP_DISPLAY_PHONE_REQUIRED');

  return {
    idempotencyKey: `whatsapp:${providerMessageId}`,
    message: {
      ...input,
      providerMessageId,
      tenantId,
      guestPhone,
      displayPhoneNumber,
      content: input.content.trim(),
      guestName: input.guestName?.trim() || undefined,
    },
  };
}
