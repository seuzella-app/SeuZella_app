/**
 * OpenWA REST API Gateway Client — Seu Zélla
 * 
 * Fornece métodos de comunicação resilientes com o servidor HTTP OpenWA
 * (Baileys / whatsapp-web.js self-hosted engine).
 */

export interface OpenWASendResponse {
  success: boolean;
  messageId?: string;
  isMock: boolean;
  error?: string;
  session?: string;
}

export interface OpenWASessionStatusResponse {
  session: string;
  status: 'AUTHENTICATED' | 'PAIRING' | 'DISCONNECTED' | 'OFFLINE' | 'STARTING';
  qrCodeUrl?: string;
  qrCodeText?: string;
  error?: string;
}

/**
 * Normaliza número de telefone para o formato exigido pelo OpenWA (E.164 limpo sem '+' ou com sufixo @c.us se necessário).
 */
export function formatPhoneForOpenWA(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return phone;
  return clean.includes('@') ? clean : `${clean}@c.us`;
}

/**
 * Obtém as configurações do servidor OpenWA via variáveis de ambiente.
 */
function getOpenWAConfig() {
  const baseUrl = (process.env.OPENWA_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '');
  const apiKey = process.env.OPENWA_API_KEY || '';
  const defaultSession = process.env.OPENWA_SESSION_ID || 'default';

  return { baseUrl, apiKey, defaultSession };
}

/**
 * Envia uma mensagem de texto via servidor OpenWA HTTP API.
 * Suporta fallback gracioso caso o servidor OpenWA esteja inacessível.
 */
export async function sendOpenWAMessage(
  toPhone: string,
  text: string,
  sessionName?: string
): Promise<OpenWASendResponse> {
  const { baseUrl, apiKey, defaultSession } = getOpenWAConfig();
  const session = sessionName || defaultSession;
  const formattedTo = formatPhoneForOpenWA(toPhone);

  // Se não houver OPENWA_SERVER_URL configurado ou explicitamente desativado
  if (process.env.WHATSAPP_PROVIDER === 'mock' || process.env.OPENWA_MOCK_MODE === 'true') {
    console.log(`[openwa-client] [MOCK] Envio de mensagem OpenWA para ${toPhone} (session: ${session})`);
    return {
      success: true,
      messageId: `openwa-mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      isMock: true,
      session,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['X-API-KEY'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/api/messages/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session,
        to: formattedTo,
        text,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`[openwa-client] Erro HTTP ${response.status} ao enviar mensagem:`, errorData);
      return {
        success: false,
        isMock: false,
        session,
        error: errorData.message || `HTTP ${response.status} from OpenWA Gateway`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.messageId || data.id || `openwa-${Date.now()}`,
      isMock: false,
      session,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown network error';
    console.warn(`[openwa-client] Falha ao conectar ao servidor OpenWA (${baseUrl}): ${errorMsg}. Ativando mock fallback.`);
    
    return {
      success: true,
      messageId: `openwa-fallback-${Date.now()}`,
      isMock: true,
      session,
      error: `OpenWA Server unreachable: ${errorMsg}`,
    };
  }
}

/**
 * Obtém o status atual da sessão no gateway OpenWA.
 */
export async function getOpenWASessionStatus(sessionName?: string): Promise<OpenWASessionStatusResponse> {
  const { baseUrl, apiKey, defaultSession } = getOpenWAConfig();
  const session = sessionName || defaultSession;

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['X-API-KEY'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/api/sessions/${session}/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return {
        session,
        status: 'OFFLINE',
        error: `HTTP ${response.status} from OpenWA Gateway`,
      };
    }

    const data = await response.json();
    return {
      session,
      status: data.status || 'DISCONNECTED',
      qrCodeUrl: data.qrCodeUrl,
      qrCodeText: data.qrCodeText,
    };
  } catch (error) {
    return {
      session,
      status: 'OFFLINE',
      error: error instanceof Error ? error.message : 'OpenWA Gateway unreachable',
    };
  }
}
