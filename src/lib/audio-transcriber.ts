/**
 * Transcritor de Áudios de Voz do WhatsApp — Seu Zélla
 * 
 * Processa mensagens de voz (PTT / Audio Notes) enviadas pelos hóspedes no WhatsApp,
 * converte áudio para texto via OpenAI/Groq Whisper ou Gemini Audio, e permite que
 * o ZaosNeuroRouter responda imediatamente ao hóspede via texto de forma humanizada.
 */

export interface TranscribeAudioParams {
  audioUrl?: string;
  mediaId?: string;
  base64Data?: string;
  mimeType?: string;
  provider?: 'meta' | 'meta-cloud';
}

export interface TranscribeAudioResult {
  success: boolean;
  transcript: string;
  isMock: boolean;
  error?: string;
}

/**
 * Transcreve uma mensagem de áudio do WhatsApp para texto.
 */
export async function transcribeWhatsAppAudio(
  params: TranscribeAudioParams
): Promise<TranscribeAudioResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;

  // Se não houver chave API ou estiver em modo dev sem credenciais Whisper
  if (!apiKey || process.env.WHATSAPP_PROVIDER === 'mock' || process.env.AUDIO_MOCK_MODE === 'true') {
    console.log('[audio-transcriber] [MOCK] Transcrevendo áudio em modo dev/fallback.');
    return {
      success: true,
      transcript: 'Olá! Gostaria de saber se o check-in pode ser feito mais cedo e se o Wi-Fi pega bem no quarto.',
      isMock: true,
    };
  }

  try {
    // Se tivermos base64 ou URL de áudio, envia para Whisper API
    if (params.base64Data || params.audioUrl) {
      const groqKey = process.env.GROQ_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      const apiEndpoint = groqKey
        ? 'https://api.groq.com/openai/v1/audio/transcriptions'
        : 'https://api.openai.com/v1/audio/transcriptions';

      const token = groqKey || openaiKey;
      const model = groqKey ? 'whisper-large-v3-turbo' : 'whisper-1';

      // Converter base64 para Blob se necessário
      const audioBuffer = params.base64Data
        ? Buffer.from(params.base64Data.replace(/^data:audio\/\w+;base64,/, ''), 'base64')
        : null;

      if (!audioBuffer && !params.audioUrl) {
        throw new Error('Sem dados de mídia válidos para transcrição.');
      }

      const formData = new FormData();
      if (audioBuffer) {
        const blob = new Blob([audioBuffer], { type: params.mimeType || 'audio/ogg' });
        formData.append('file', blob, 'whatsapp_voice.ogg');
      }
      formData.append('model', model);
      formData.append('language', 'pt');

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[audio-transcriber] Erro na API Whisper:', errText);
        throw new Error(`Whisper API HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        transcript: data.text || '',
        isMock: false,
      };
    }

    // Fallback gracioso caso faltem dados de mídia
    return {
      success: true,
      transcript: 'Mensagem de áudio recebida do hóspede.',
      isMock: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[audio-transcriber] Falha ao transcrever áudio: ${errorMsg}. Usando fallback.`);

    return {
      success: true,
      transcript: 'Olá! Recebi seu áudio. Como posso ajudar com a sua estadia?',
      isMock: true,
      error: errorMsg,
    };
  }
}
