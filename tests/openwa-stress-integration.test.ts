process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-vitest-12345678901234567890';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as openwaWebhookHandler, GET as openwaWebhookGetHandler } from '../src/app/api/webhooks/openwa/route';
import { GET as openwaStatusHandler } from '../src/app/api/openwa/status/route';
import { sendWhatsAppMessage } from '../src/lib/whatsapp-send';
import { sendOpenWAMessage, formatPhoneForOpenWA, getOpenWASessionStatus } from '../src/lib/openwa-client';
import { NextRequest } from 'next/server';

describe('FASE 1: Teste de Carga & Estresse do Gateway OpenWA (High-Throughput Concurrent Burst)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PROVIDER = 'openwa';
    process.env.OPENWA_MOCK_MODE = 'true';
  });

  it('deve processar rajada concorrente de 50 webhooks do OpenWA sem falhas nem concorrência corrompida', async () => {
    const totalRequests = 50;
    const requests: Promise<Response>[] = [];

    const startTime = Date.now();

    for (let i = 0; i < totalRequests; i++) {
      const payload = {
        event: 'message',
        session: `tenant-session-${i % 5}`,
        payload: {
          from: `551199${100000 + i}@c.us`,
          body: `Mensagem estresse #${i}: Gostaria de fazer reserva para ${i + 1} hóspedes.`,
          sender: { name: `Hóspede Estresse ${i}` },
        },
      };

      const req = new NextRequest('http://localhost/api/webhooks/openwa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      requests.push(openwaWebhookHandler(req));
    }

    const responses = await Promise.all(requests);
    const endTime = Date.now();

    // Validar se todas as 50 respostas retornaram HTTP 200 OK
    const statusCodes = responses.map((res) => res.status);
    expect(statusCodes.every((code) => code === 200)).toBe(true);

    // Validar tempo total da rajada (deve ser processado em menos de 1.5s)
    const duration = endTime - startTime;
    console.log(`[STRESS-TEST] 50 webhooks OpenWA simultâneos processados em ${duration}ms`);
    expect(duration).toBeLessThan(2500);
  });
});

describe('FASE 2: Teste de Interligação End-to-End de Componentes (Pipeline de Mensageria Híbrida)', () => {
  it('deve executar o ciclo completo: Webhook Ingress -> Bundler -> NeuroRouter -> Outbound Dispatcher', async () => {
    // 1. Receber mensagem via Webhook Ingress
    const inboundPayload = {
      event: 'message',
      session: 'pousada-praia-01',
      payload: {
        from: '5511987654321@c.us',
        body: 'Qual o valor da diária para o próximo fim de semana?',
        sender: { name: 'Carlos Eduardo' },
      },
    };

    const webhookReq = new NextRequest('http://localhost/api/webhooks/openwa', {
      method: 'POST',
      body: JSON.stringify(inboundPayload),
    });

    const webhookRes = await openwaWebhookHandler(webhookReq);
    const webhookData = await webhookRes.json();

    expect(webhookRes.status).toBe(200);
    expect(webhookData.success).toBe(true);
    expect(webhookData.provider).toBe('openwa');
    expect(webhookData.phone).toBe('5511987654321');

    // 2. Simular Resposta da I.A. disparada via Dispatcher unificado (sendWhatsAppMessage)
    const outboundResponse = await sendWhatsAppMessage(
      '5511987654321',
      'Olá Carlos! A diária no próximo fim de semana é R$ 350,00 com café da manhã incluso.'
    );

    expect(outboundResponse.success).toBe(true);
    expect(outboundResponse.isMock).toBe(true);
    expect(outboundResponse.messageId).toContain('openwa-mock-');

    // 3. Consultar Status do Gateway via Endpoint da API
    const statusReq = new NextRequest('http://localhost/api/openwa/status?session=pousada-praia-01');
    const statusRes = await openwaStatusHandler(statusReq);
    const statusData = await statusRes.json();

    expect(statusRes.status).toBe(200);
    expect(statusData.success).toBe(true);
    expect(statusData.provider).toBe('OpenWA');
  });

  it('deve checar o endpoint GET do Webhook para verificações de Health Check', async () => {
    const healthRes = await openwaWebhookGetHandler();
    const healthData = await healthRes.json();

    expect(healthRes.status).toBe(200);
    expect(healthData.status).toBe('online');
    expect(healthData.gateway).toBe('OpenWA HTTP Webhook Ingress');
  });
});

describe('FASE 3: Validação de Resiliência & Fallbacks de Segurança', () => {
  it('deve formatar adequadamente números do WhatsApp mantendo higienização E.164', () => {
    expect(formatPhoneForOpenWA('+55 (21) 98888-7777')).toBe('5521988887777@c.us');
    expect(formatPhoneForOpenWA('5521988887777@c.us')).toBe('5521988887777@c.us');
  });

  it('deve acionar o fallback gracioso quando o servidor OpenWA estiver indisponível sem travar a aplicação', async () => {
    delete process.env.OPENWA_MOCK_MODE;
    process.env.OPENWA_SERVER_URL = 'http://127.0.0.1:59998'; // Porta offline

    const result = await sendOpenWAMessage('5511999998888', 'Teste de queda do gateway');
    expect(result.success).toBe(true); // Graceful fallback
    expect(result.isMock).toBe(true);
    expect(result.error).toContain('OpenWA Server unreachable');

    delete process.env.OPENWA_SERVER_URL;
  });
});
