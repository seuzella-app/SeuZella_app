import { META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_GRAPH_API_VERSION } from '@/lib/env';

interface WhatsAppMessageResponse {
  messaging_product: 'whatsapp';
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface SendWhatsAppTextInput {
  to: string;
  body: string;
  replyToMessageId?: string;
}

export interface SendWhatsAppTemplateInput {
  to: string;
  name: string;
  languageCode: string;
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters?: WhatsAppTemplateParameter[];
  }>;
}

function assertConfigured(): void {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) throw new Error('WHATSAPP_CLOUD_API_NOT_CONFIGURED');
}

function endpoint(): string {
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;
}

async function postMessage(payload: Record<string, unknown>): Promise<WhatsAppMessageResponse> {
  assertConfigured();
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`WHATSAPP_SEND_FAILED_${response.status}`);
  return body as WhatsAppMessageResponse;
}

export async function sendWhatsAppText(input: SendWhatsAppTextInput): Promise<WhatsAppMessageResponse> {
  if (!input.to.trim() || !input.body.trim()) throw new Error('WHATSAPP_TEXT_REQUIRED');
  return postMessage({
    recipient_type: 'individual',
    to: input.to,
    type: 'text',
    ...(input.replyToMessageId ? { context: { message_id: input.replyToMessageId } } : {}),
    text: { preview_url: false, body: input.body },
  });
}

export async function sendWhatsAppTemplate(input: SendWhatsAppTemplateInput): Promise<WhatsAppMessageResponse> {
  if (!input.to.trim() || !input.name.trim() || !input.languageCode.trim()) throw new Error('WHATSAPP_TEMPLATE_REQUIRED');
  return postMessage({
    recipient_type: 'individual',
    to: input.to,
    type: 'template',
    template: {
      name: input.name,
      language: { code: input.languageCode },
      ...(input.components ? { components: input.components } : {}),
    },
  });
}

export function isWhatsAppCloudApiConfigured(): boolean {
  return Boolean(META_ACCESS_TOKEN && META_PHONE_NUMBER_ID);
}
