process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-vitest-12345678901234567890';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatPhoneForOpenWA, sendOpenWAMessage, getOpenWASessionStatus } from '../src/lib/openwa-client';
import { sendWhatsAppMessage } from '../src/lib/whatsapp-send';
import { POST as openwaWebhookHandler } from '../src/app/api/webhooks/openwa/route';
import { NextRequest } from 'next/server';

describe('PILAR 1: OpenWA Client Utility & Formatting', () => {
  it('formatPhoneForOpenWA deve formatar números com sufixo @c.us', () => {
    expect(formatPhoneForOpenWA('+55 (11) 99999-8888')).toBe('5511999998888@c.us');
    expect(formatPhoneForOpenWA('5511988887777@c.us')).toBe('5511988887777@c.us');
  });

  it('sendOpenWAMessage em modo MOCK deve retornar sucesso e ID mock', async () => {
    process.env.OPENWA_MOCK_MODE = 'true';
    const result = await sendOpenWAMessage('5511988888888', 'Olá OpenWA!');
    expect(result.success).toBe(true);
    expect(result.isMock).toBe(true);
    expect(result.messageId).toContain('openwa-mock-');
    delete process.env.OPENWA_MOCK_MODE;
  });

  it('sendOpenWAMessage deve lidar com servidor inacessível via fallback gracioso', async () => {
    process.env.OPENWA_SERVER_URL = 'http://localhost:59999'; // Porta inválida
    delete process.env.OPENWA_MOCK_MODE;

    const result = await sendOpenWAMessage('5511988888888', 'Teste de fallback');
    expect(result.success).toBe(true); // Fallback graceful
    expect(result.isMock).toBe(true);
    expect(result.error).toContain('OpenWA Server unreachable');

    delete process.env.OPENWA_SERVER_URL;
  });

  it('getOpenWASessionStatus deve retornar OFFLINE quando servidor estiver fora do ar', async () => {
    process.env.OPENWA_SERVER_URL = 'http://localhost:59999';
    const status = await getOpenWASessionStatus('default');
    expect(status.status).toBe('OFFLINE');
    delete process.env.OPENWA_SERVER_URL;
  });
});

describe('PILAR 2: Dual Gateway Provider Dispatcher (whatsapp-send.ts)', () => {
  it('sendWhatsAppMessage deve rotear via OpenWA quando WHATSAPP_PROVIDER=openwa', async () => {
    process.env.WHATSAPP_PROVIDER = 'openwa';
    process.env.OPENWA_MOCK_MODE = 'true';

    const res = await sendWhatsAppMessage('5511977776666', 'Mensagem via OpenWA Provider');
    expect(res.success).toBe(true);
    expect(res.isMock).toBe(true);

    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.OPENWA_MOCK_MODE;
  });
});

describe('PILAR 3: OpenWA Webhook Handler & Event Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/webhooks/openwa deve aceitar eventos no formato OpenWA e retornar 200 OK', async () => {
    const payload = {
      event: 'message',
      session: 'pousada-sp',
      payload: {
        from: '5511988885555@c.us',
        body: 'Olá, gostaria de saber se aceita pet?',
        sender: { name: 'Mariana Lima' },
      },
    };

    const req = new NextRequest('http://localhost/api/webhooks/openwa', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await openwaWebhookHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.provider).toBe('openwa');
    expect(json.phone).toBe('5511988885555');
  });

  it('POST /api/webhooks/openwa deve rejeitar solicitações sem secret quando OPENWA_WEBHOOK_SECRET estiver ativo', async () => {
    process.env.OPENWA_WEBHOOK_SECRET = 'secret-token-zehla';

    const req = new NextRequest('http://localhost/api/webhooks/openwa', {
      method: 'POST',
      body: JSON.stringify({ event: 'message', payload: { from: '5511999999999', body: 'teste' } }),
    });

    const res = await openwaWebhookHandler(req);
    expect(res.status).toBe(401);

    delete process.env.OPENWA_WEBHOOK_SECRET;
  });
});
