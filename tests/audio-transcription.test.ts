process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-vitest-12345678901234567890';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeWhatsAppAudio } from '../src/lib/audio-transcriber';
import { POST as openwaWebhookHandler } from '../src/app/api/webhooks/openwa/route';
import { NextRequest } from 'next/server';

describe('PILAR 1: Audio Transcriber Utility', () => {
  beforeEach(() => {
    process.env.AUDIO_MOCK_MODE = 'true';
  });

  it('transcribeWhatsAppAudio deve retornar transcrição mock quando em modo dev/mock', async () => {
    const res = await transcribeWhatsAppAudio({
      mimeType: 'audio/ogg',
      base64Data: 'mock-base64-audio-data',
    });

    expect(res.success).toBe(true);
    expect(res.transcript).toBeDefined();
    expect(res.isMock).toBe(true);
  });
});

describe('PILAR 2: OpenWA Audio Webhook Ingress', () => {
  it('POST /api/webhooks/openwa com mensagem de áudio deve transcrever e processar com sucesso', async () => {
    process.env.OPENWA_MOCK_MODE = 'true';
    process.env.AUDIO_MOCK_MODE = 'true';

    const audioPayload = {
      event: 'audio',
      session: 'pousada-praia-01',
      payload: {
        from: '5511999991111@c.us',
        type: 'ptt',
        mimetype: 'audio/ogg; codecs=opus',
        mediaUrl: 'https://example.com/voice-note.ogg',
        sender: { name: 'Hóspede de Voz' },
      },
    };

    const req = new NextRequest('http://localhost/api/webhooks/openwa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioPayload),
    });

    const res = await openwaWebhookHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.phone).toBe('5511999991111');
  });
});
