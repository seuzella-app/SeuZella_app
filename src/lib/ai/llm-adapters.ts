/**
 * ZÉLLA — LLM REST Adapters for 2026 Providers
 * Direct HTTP calls to bypass SDK network dependencies and allow switchable mock/real execution.
 */

export interface AdapterResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AdapterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** ID da tool call (para mensagens de role 'tool') */
  tool_call_id?: string;
  /** Tool calls do assistant (para mensagens que invocam ferramentas) */
  tool_calls?: AdapterToolCallDef[];
}

/** Definição de tool no formato OpenAI-compatible (usado por Groq, DeepSeek, OpenRouter, etc.) */
export interface AdapterToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** Tool call retornada pelo LLM */
export interface AdapterToolCallDef {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0) {
      console.warn(`[LLMAdapter] Fetch failed with status ${response.status}. Retrying...`);
      return await fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`[LLMAdapter] Fetch network error: ${error}. Retrying...`);
      return await fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * OpenAI-Compatible Providers (OpenAI, OpenRouter, Groq, DeepSeek, Moonshot/Kimi, Zhipu/GLM)
 */
export async function callOpenAICompatible(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: AdapterMessage[];
  temperature: number;
  maxTokens: number;
  isOpenRouter?: boolean;
  jsonMode?: boolean;
}): Promise<AdapterResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${params.apiKey}`,
  };

  if (params.isOpenRouter) {
    headers['HTTP-Referer'] = 'https://zehla.com.br';
    headers['X-Title'] = 'ZEHLA SmartHotel';
  }

  const payload: any = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  };

  if (params.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const body = JSON.stringify(payload);

  const url = `${params.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] OpenAI-compatible provider error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const inputTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(params.messages).length / 4);
  const outputTokens = data.usage?.completion_tokens || Math.ceil(content.length / 4);

  return { content, inputTokens, outputTokens };
}

/**
 * Anthropic Messages API
 */
export async function callAnthropic(params: {
  apiKey: string;
  model: string;
  messages: AdapterMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<AdapterResponse> {
  const systemMessage = params.messages.find(m => m.role === 'system');
  const userMessages = params.messages.filter(m => m.role !== 'system');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': params.apiKey,
    'anthropic-version': '2023-06-01',
  };

  const body = JSON.stringify({
    model: params.model,
    max_tokens: params.maxTokens,
    messages: userMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    system: systemMessage?.content,
    temperature: params.temperature,
  });

  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Anthropic provider error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  const inputTokens = data.usage?.input_tokens || Math.ceil(JSON.stringify(params.messages).length / 4);
  const outputTokens = data.usage?.output_tokens || Math.ceil(content.length / 4);

  return { content, inputTokens, outputTokens };
}

/**
 * Google Gemini GenerateContent API
 */
export async function callGemini(params: {
  apiKey: string;
  model: string;
  messages: AdapterMessage[];
  temperature: number;
  maxTokens: number;
  jsonMode?: boolean;
}): Promise<AdapterResponse> {
  const systemMessage = params.messages.find(m => m.role === 'system');
  const otherMessages = params.messages.filter(m => m.role !== 'system');

  const contents = otherMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const generationConfig: any = {
    temperature: params.temperature,
    maxOutputTokens: params.maxTokens,
  };

  if (params.jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: any = {
    contents,
    generationConfig,
  };

  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  // Map shorter ID (like gemini-flash) to official Google model names
  let officialModel = params.model;
  if (officialModel === 'gemini-flash') {
    officialModel = 'gemini-2.5-flash';
  } else if (officialModel === 'gemini-pro') {
    officialModel = 'gemini-2.5-pro';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${officialModel}:generateContent?key=${params.apiKey}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Gemini provider error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(params.messages).length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4);

  return { content, inputTokens, outputTokens };
}

/* ================================================================== */
/* Native Function Calling Adapters                                      */
/* ================================================================== */

/** Resposta extendida com tool calls do LLM */
export interface AdapterToolResponse extends AdapterResponse {
  /** Tool calls solicitadas pelo LLM (vazio se resposta final em texto) */
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** Motivo de parada: 'stop' = texto final, 'tool_calls' = quer chamar ferramenta */
  finishReason: 'stop' | 'tool_calls';
}

/**
 * OpenAI-Compatible Function Calling
 *
 * Envia mensagens + tools no formato nativo da API OpenAI.
 * Funciona com: Groq, DeepSeek, OpenRouter, Zhipu/GLM, Moonshot/Kimi.
 *
 * Diferença do `callOpenAICompatible` padrão:
 * - Inclui `tools` no payload
 * - Parseia `tool_calls` da resposta
 * - Suporta mensagens com role 'tool' (resultado de execução)
 */
export async function callOpenAIWithTools(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: AdapterMessage[];
  tools: AdapterToolDef[];
  temperature: number;
  maxTokens: number;
  isOpenRouter?: boolean;
}): Promise<AdapterToolResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${params.apiKey}`,
  };

  if (params.isOpenRouter) {
    headers['HTTP-Referer'] = 'https://zehla.com.br';
    headers['X-Title'] = 'ZEHLA SmartHotel';
  }

  // Build messages — filter tool_calls from serialization (only include content + role)
  const serializableMessages = params.messages.map(m => {
    const msg: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.role === 'tool' && m.tool_call_id) {
      msg.tool_call_id = m.tool_call_id;
    }
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls;
    }
    return msg;
  });

  const payload: Record<string, unknown> = {
    model: params.model,
    messages: serializableMessages,
    tools: params.tools,
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  };

  const url = `${params.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Tool calling error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  const finishReason = choice?.finish_reason || 'stop';

  // Extract text content
  const content = message?.content || '';

  // Extract tool calls
  const rawToolCalls: AdapterToolCallDef[] | undefined = message?.tool_calls;
  const toolCalls: AdapterToolResponse['toolCalls'] = [];

  if (rawToolCalls && Array.isArray(rawToolCalls)) {
    for (const tc of rawToolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        parsedArgs = { _raw: tc.function?.arguments || '{}' };
      }
      toolCalls.push({
        id: tc.id || `tc_${Date.now()}`,
        name: tc.function?.name || 'unknown',
        arguments: parsedArgs,
      });
    }
  }

  const inputTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(serializableMessages).length / 4);
  const outputTokens = data.usage?.completion_tokens || Math.ceil((content.length + JSON.stringify(rawToolCalls || []).length) / 4);

  return {
    content,
    inputTokens,
    outputTokens,
    toolCalls,
    finishReason: finishReason === 'tool_calls' || toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}

/**
 * Gemini Function Calling (functionDeclarations)
 *
 * Formato específico do Google Gemini:
 * - tools[].functionDeclarations[] em vez de tools[].function
 * - functionCall nos parts em vez de tool_calls
 * - functionResponse no role 'user' para devolver resultados
 */
export async function callGeminiWithTools(params: {
  apiKey: string;
  model: string;
  messages: AdapterMessage[];
  tools: AdapterToolDef[];
  temperature: number;
  maxTokens: number;
}): Promise<AdapterToolResponse> {
  const systemMessage = params.messages.find(m => m.role === 'system');
  const otherMessages = params.messages.filter(m => m.role !== 'system');

  // Convert messages to Gemini format
  // Gemini uses 'user' and 'model' roles, with parts array
  const contents: Array<Record<string, unknown>> = [];

  for (const msg of otherMessages) {
    if (msg.role === 'tool') {
      // Tool result messages in Gemini go as 'user' role with functionResponse part
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.tool_call_id?.split('_')[0] || 'unknown',
            response: (() => {
              try { return JSON.parse(msg.content); }
              catch { return { result: msg.content }; }
            })(),
          },
        }],
      });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls — convert to functionCall parts
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content) {
          parts.push({ text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: parsedArgs,
            },
          });
        }
        contents.push({ role: 'model', parts });
      } else {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content || '' }],
        });
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Convert tools to Gemini functionDeclarations format
  const geminiTools = params.tools.map(t => ({
    functionDeclarations: [{
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    }],
  }));

  const body: Record<string, unknown> = {
    contents,
    tools: geminiTools,
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: params.maxTokens,
    },
  };

  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    };
  }

  // Map shorter model ID to official Google model names
  let officialModel = params.model;
  if (officialModel === 'gemini-flash') {
    officialModel = 'gemini-2.5-flash';
  } else if (officialModel === 'gemini-pro') {
    officialModel = 'gemini-2.5-pro';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${officialModel}:generateContent?key=${params.apiKey}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Gemini tool calling error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const content = parts
    .filter((p: any) => p.text)
    .map((p: any) => p.text)
    .join('');

  // Extract function calls from parts
  const toolCalls: AdapterToolResponse['toolCalls'] = [];
  for (const part of parts) {
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${part.functionCall.name}_${Date.now()}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(JSON.stringify(body).length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil((content.length + JSON.stringify(parts).length) / 4);

  return {
    content,
    inputTokens,
    outputTokens,
    toolCalls,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
  };
}

/* ================================================================== */
/* Anthropic Claude with Tool Calling (Patch B)                       */
/* ================================================================== */

/**
 * Anthropic Claude Messages API with Native Tool Calling
 *
 * Claude uses a different tool format than OpenAI:
 *   - tools[].name, tools[].description, tools[].input_schema
 *   - tool_choice optional ('auto' | 'any' | {'type':'tool','name':'X'})
 *   - Stop reason: 'tool_use' (instead of 'tool_calls')
 *   - Tool calls come back in content[].type === 'tool_use'
 *
 * References:
 *   https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 *
 * @param params - API key, model, messages (with system extracted), tools
 * @returns AdapterToolResponse with toolCalls parsed from Claude format
 */
export async function callAnthropicWithTools(params: {
  apiKey: string;
  model: string;
  messages: AdapterMessage[];
  tools: AdapterToolDef[];
  temperature: number;
  maxTokens: number;
}): Promise<AdapterToolResponse> {
  const systemMessage = params.messages.find(m => m.role === 'system');
  const otherMessages = params.messages.filter(m => m.role !== 'system');

  // Convert messages to Anthropic format
  // Anthropic supports roles: 'user' | 'assistant' | (tool results go in user role with tool_result)
  const anthropicMessages: Array<Record<string, unknown>> = [];

  for (const msg of otherMessages) {
    if (msg.role === 'tool') {
      // Tool result messages: Anthropic expects these inside a 'user' message
      // with content array containing tool_result block
      let toolName = 'unknown';
      try {
        toolName = msg.tool_call_id?.split('_')[0] || 'unknown';
      } catch { /* default 'unknown' */ }

      let resultObj: unknown = msg.content;
      try {
        resultObj = JSON.parse(msg.content);
      } catch {
        resultObj = { result: msg.content };
      }

      anthropicMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id || `tool_${Date.now()}`,
          content: typeof resultObj === 'string' ? resultObj : JSON.stringify(resultObj),
        }],
      });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls — Anthropic expects content array
        // with text block (optional) + tool_use blocks
        const content: Array<Record<string, unknown>> = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let argsObj: Record<string, unknown> = {};
          try {
            argsObj = JSON.parse(tc.function.arguments || '{}');
          } catch { /* empty args */ }
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: argsObj,
          });
        }
        anthropicMessages.push({ role: 'assistant', content });
      } else {
        anthropicMessages.push({
          role: 'assistant',
          content: msg.content || '',
        });
      }
    } else {
      // user message
      anthropicMessages.push({
        role: 'user',
        content: msg.content,
      });
    }
  }

  // Convert tools to Anthropic format (input_schema instead of parameters)
  const anthropicTools = params.tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens,
    messages: anthropicMessages,
    tools: anthropicTools,
    temperature: params.temperature,
  };

  if (systemMessage) {
    body.system = systemMessage.content;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': params.apiKey,
    'anthropic-version': '2023-06-01',
  };

  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Anthropic tool calling error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  // Claude returns content as an array of blocks: [{type:'text',text:...}, {type:'tool_use',...}]
  const contentBlocks: Array<Record<string, unknown>> = data.content || [];

  // Extract text content (concatenate all 'text' blocks)
  const textParts: string[] = [];
  for (const block of contentBlocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);
    }
  }
  const content = textParts.join('');

  // Extract tool calls (blocks of type 'tool_use')
  const toolCalls: AdapterToolResponse['toolCalls'] = [];
  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: (block.id as string) || `anthropic_${block.name}_${Date.now()}`,
        name: (block.name as string) || 'unknown',
        arguments: (block.input as Record<string, unknown>) || {},
      });
    }
  }

  const inputTokens = data.usage?.input_tokens || Math.ceil(JSON.stringify(body).length / 4);
  const outputTokens = data.usage?.output_tokens || Math.ceil((content.length + JSON.stringify(contentBlocks).length) / 4);

  const stopReason = data.stop_reason;
  const finishReason: 'stop' | 'tool_calls' = stopReason === 'tool_use' || toolCalls.length > 0
    ? 'tool_calls'
    : 'stop';

  return {
    content,
    inputTokens,
    outputTokens,
    toolCalls,
    finishReason,
  };
}

/* ================================================================== */
/* Gemini Native Audio Processing (Patch C)                           */
/* ================================================================== */

/**
 * Gemini Native Audio Processing
 *
 * Sends audio bytes directly to Gemini 2.0 Flash as inlineData.
 * Eliminates the need for OpenAI Whisper transcription step.
 *
 * COST SAVINGS:
 *   - Whisper: $0.006 per minute of audio
 *   - Gemini audio input: ~$0.70 per 1M tokens (~$0.0007 per 1-min audio)
 *   → 88% cost reduction on audio messages
 *
 * LATENCY SAVINGS:
 *   - Whisper round-trip: 800-1500ms
 *   - Direct Gemini inline: ~0ms (audio is part of the same request)
 *   → 800-1500ms latency removed from the critical path
 *
 * SUPPORTED FORMATS:
 *   - WAV (recommended — 16kHz, 16-bit, mono)
 *   - MP3, AIFF, AAC, OGG (Gemini auto-converts internally)
 *
 * LIMITS:
 *   - Max audio size: 9.5MB inline (use File API for larger)
 *   - Max duration: ~8.5 hours of audio per request
 */
export async function callGeminiWithAudio(params: {
  apiKey: string;
  model?: string;            // defaults to 'gemini-2.0-flash-exp'
  audioBase64: string;       // base64-encoded audio bytes (no data: prefix)
  audioMimeType: 'audio/wav' | 'audio/mp3' | 'audio/aac' | 'audio/ogg' | 'audio/aiff';
  textPrompt?: string;       // optional text instruction accompanying audio
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<AdapterResponse> {
  const model = params.model ?? 'gemini-2.0-flash-exp';
  const temperature = params.temperature ?? 0.4;
  const maxTokens = params.maxTokens ?? 1024;

  const parts: Array<Record<string, unknown>> = [
    {
      inlineData: {
        mimeType: params.audioMimeType,
        data: params.audioBase64,
      },
    },
  ];

  if (params.textPrompt) {
    parts.push({ text: params.textPrompt });
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (params.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: params.systemPrompt }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${params.apiKey}`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[LLMAdapter] Gemini audio error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil((params.audioBase64.length / 4) + (params.textPrompt?.length ?? 0) / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4);

  return { content, inputTokens, outputTokens };
}

/**
 * Helper: Detect audio message type from WhatsApp media metadata.
 * Maps WhatsApp's audio MIME types to Gemini-compatible ones.
 *
 * WhatsApp typically sends audio as:
 *   - audio/ogg (Opus in OGG container) — default for voice messages
 *   - audio/mpeg — for forwarded MP3 files
 *
 * Gemini accepts: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg
 */
export function mapWhatsappAudioToGemini(whatsappMime: string): {
  audioMimeType: 'audio/wav' | 'audio/mp3' | 'audio/aac' | 'audio/ogg' | 'audio/aiff';
  needsConversion: boolean;
} {
  const map: Record<string, 'audio/wav' | 'audio/mp3' | 'audio/aac' | 'audio/ogg' | 'audio/aiff'> = {
    'audio/ogg': 'audio/ogg',
    'audio/mpeg': 'audio/mp3',
    'audio/mp3': 'audio/mp3',
    'audio/mp4': 'audio/aac',
    'audio/aac': 'audio/aac',
    'audio/wav': 'audio/wav',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/aiff': 'audio/aiff',
  };
  return {
    audioMimeType: map[whatsappMime] ?? 'audio/ogg',
    needsConversion: !map[whatsappMime],
  };
}
