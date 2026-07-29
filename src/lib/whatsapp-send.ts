/**
 * Utilitário de envio de mensagens via API oficial do WhatsApp Cloud (v21.0).
 * Suporta o modo "DB-only" caso as credenciais não estejam configuradas.
 */
export interface SendWhatsAppResponse {
  success: boolean;
  messageId?: string;
  isMock: boolean;
  error?: string;
}

/**
 * Envia uma mensagem de texto para o número especificado no WhatsApp.
 * Divide automaticamente a mensagem em partes (chunks) caso ultrapasse o limite de 4096 caracteres da Meta.
 *
 * @param toPhone - Número de telefone do destinatário com DDI (ex: 5511988888888)
 * @param text - Conteúdo da mensagem
 * @returns Promessa com o resultado do envio
 */
import { sendOpenWAMessage } from './openwa-client';

export async function sendWhatsAppMessage(toPhone: string, text: string): Promise<SendWhatsAppResponse> {
  const provider = (process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const openwaUrl = process.env.OPENWA_SERVER_URL;

  // Se o provedor for explicitamente OpenWA ou houver servidor OpenWA sem credenciais Meta
  if (provider === 'openwa' || (openwaUrl && !token)) {
    console.log(`[whatsapp-send] Roteando envio de mensagem via Gateway OpenWA (${toPhone})`);
    const openwaRes = await sendOpenWAMessage(toPhone, text);
    return {
      success: openwaRes.success,
      messageId: openwaRes.messageId,
      isMock: openwaRes.isMock,
      error: openwaRes.error,
    };
  }

  // Modo DB-only / Mockup (graceful degradation)
  if (!token || !phoneNumberId) {
    console.log(`[whatsapp-send] [MOCK] Envio de mensagem para ${toPhone} em modo DB-only.`);
    console.log(`[whatsapp-send] [MOCK] Conteúdo: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);
    
    // Simula atraso de rede
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    return {
      success: true,
      messageId: `mock-wamid-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isMock: true,
    };
  }

  try {
    // Dividir a mensagem em blocos de no máximo 4000 caracteres para segurança
    const MAX_LENGTH = 4000;
    const messageChunks: string[] = [];

    if (text.length <= MAX_LENGTH) {
      messageChunks.push(text);
    } else {
      let remainingText = text;
      while (remainingText.length > 0) {
        if (remainingText.length <= MAX_LENGTH) {
          messageChunks.push(remainingText);
          break;
        }
        
        // Cortar em um espaço para evitar quebrar palavras
        let cutIndex = remainingText.lastIndexOf(' ', MAX_LENGTH);
        if (cutIndex === -1 || cutIndex < MAX_LENGTH - 200) {
          cutIndex = MAX_LENGTH; // Forçar corte rígido se não achar espaço conveniente
        }

        messageChunks.push(remainingText.substring(0, cutIndex).trim());
        remainingText = remainingText.substring(cutIndex).trim();
      }
    }

    let lastMessageId = '';

    for (const chunk of messageChunks) {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toPhone,
          type: 'text',
          text: {
            preview_url: true,
            body: chunk,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[whatsapp-send-error] Falha ao enviar mensagem no WhatsApp Cloud API:', data);
        return {
          success: false,
          isMock: false,
          error: data.error?.message || 'Error from Meta WhatsApp API',
        };
      }

      lastMessageId = data.messages?.[0]?.id || '';
    }

    return {
      success: true,
      messageId: lastMessageId,
      isMock: false,
    };
  } catch (error) {
    console.error('[whatsapp-send-error] Erro inesperado ao disparar fetch para API do WhatsApp:', error);
    return {
      success: false,
      isMock: false,
      error: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}
