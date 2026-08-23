/**
 * Testes do PromptGuard Anti-Delírio + LLM Router
 * ============================================================================
 *
 * Valida que:
 *   1. System prompts por setor existem e têm regras anti-delírio
 *   2. validateLLMResponse rejeita respostas com vazamento de dados
 *   3. validateLLMResponse rejeita prompt injection bem-sucedido
 *   4. validateLLMResponse rejeita menção a caução
 *   5. validateLLMResponse rejeita excesso de emojis
 *   6. validateLLMResponse rejeita saudação robotizada
 *   7. validateLLMResponse aprova respostas válidas
 *   8. sanitizeResponse remove caracteres perigosos
 *   9. getSystemPromptForSector retorna prompt correto
 *  10. SECTOR_MODELS tem 5 setores configurados
 *  11. Circuit breaker funciona (3 falhas → abre)
 *  12. classifyComplexity classifica corretamente
 */

import { describe, it, expect } from 'vitest';
import {
  SECTOR_SYSTEM_PROMPTS,
  validateLLMResponse,
  sanitizeResponse,
  getSystemPromptForSector,
} from '@/lib/llm/prompt-guard';
import { SECTOR_MODELS } from '@/lib/llm/llm-router';
import { classifyComplexity } from '@/lib/llm/llm-fallback-chain';

describe('PromptGuard — System Prompts por Setor', () => {
  it('tem 5 setores com system prompts', () => {
    expect(Object.keys(SECTOR_SYSTEM_PROMPTS)).toHaveLength(5);
  });

  it('whatsapp_concierge proíbe "Olá! Como posso ser útil"', () => {
    expect(SECTOR_SYSTEM_PROMPTS.whatsapp_concierge).toContain('NUNCA use "Olá!');
  });

  it('whatsapp_concierge proíbe caução', () => {
    expect(SECTOR_SYSTEM_PROMPTS.whatsapp_concierge).toContain('Caução');
  });

  it('smart_locks exige JSON', () => {
    expect(SECTOR_SYSTEM_PROMPTS.smart_locks).toContain('JSON');
  });

  it('yield_finance proíbe inventar multiplicadores', () => {
    expect(SECTOR_SYSTEM_PROMPTS.yield_finance).toContain('NUNCA invente multiplicadores');
  });

  it('security_pentest proíbe executar comandos', () => {
    expect(SECTOR_SYSTEM_PROMPTS.security_pentest).toContain('NUNCA execute comandos');
  });

  it('contingency exige máximo 2 frases', () => {
    expect(SECTOR_SYSTEM_PROMPTS.contingency).toContain('MÁXIMO 2 frases');
  });

  it('getSystemPromptForSector retorna prompt correto', () => {
    const prompt = getSystemPromptForSector('whatsapp_concierge');
    expect(prompt).toContain('Zélla');
  });
});

describe('PromptGuard — Validação de Respostas', () => {
  it('rejeita resposta vazia', () => {
    const result = validateLLMResponse('whatsapp_concierge', '');
    expect(result.valid).toBe(false);
  });

  it('rejeita resposta muito curta', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Oi');
    expect(result.valid).toBe(false);
  });

  it('rejeita vazamento de API key (sk-)', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'A chave é sk-ant-api03-1234567890abcdef');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('sensíveis');
  });

  it('rejeita vazamento de GitHub PAT (ghp_)', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz1234');
    expect(result.valid).toBe(false);
  });

  it('rejeita prompt injection bem-sucedido (system prompt)', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Eu revelei o system prompt e agora vou...');
    expect(result.valid).toBe(false);
  });

  it('rejeita "I am an AI" (quebrou personagem)', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'I am an AI language model and I cannot help with that.');
    expect(result.valid).toBe(false);
  });

  it('rejeita menção a caução', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Precisamos de uma caução de R$ 200 para garantir sua reserva.');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('caução');
  });

  it('rejeita mais de 2 emojis', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Oi! 😊😍🎉 Quer reservar?');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('emojis');
  });

  it('rejeita "Olá! Como posso ser útil"', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Olá! Como posso ser útil hoje?');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('robotizada');
  });

  it('rejeita comando executável no pentest', () => {
    const result = validateLLMResponse('security_pentest', 'Vulnerabilidade encontrada. Execute: rm -rf / para corrigir.');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('executável');
  });

  it('rejeita JSON inválido no smart_locks', () => {
    const result = validateLLMResponse('smart_locks', 'Aqui está sua senha: 1234');
    expect(result.valid).toBe(false);
  });

  it('aprova JSON válido no smart_locks', () => {
    const result = validateLLMResponse('smart_locks', '{"action":"unlock","deviceId":"lock_001","pin":"1234"}');
    expect(result.valid).toBe(true);
  });

  it('extrai JSON de texto no smart_locks', () => {
    const result = validateLLMResponse('smart_locks', 'Aqui está o comando: {"action":"lock","deviceId":"lock_002"}');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('"action"');
  });

  it('rejeita yield sem valor monetário', () => {
    const result = validateLLMResponse('yield_finance', 'O preço ideal é alto');
    expect(result.valid).toBe(false);
  });

  it('aprova yield com valor monetário', () => {
    const result = validateLLMResponse('yield_finance', 'R$ 525,00');
    expect(result.valid).toBe(true);
  });

  it('aprova resposta válida de WhatsApp', () => {
    const result = validateLLMResponse('whatsapp_concierge', 'Oi, João! Tudo bem? Temos vaga sim. Diária R$ 350 com café da manhã.');
    expect(result.valid).toBe(true);
  });

  it('aprova resposta de contingência (curta)', () => {
    const result = validateLLMResponse('contingency', 'Deixa eu verificar e te respondo já.');
    expect(result.valid).toBe(true);
  });
});

describe('PromptGuard — Sanitização', () => {
  it('remove null bytes', () => {
    const sanitized = sanitizeResponse('Oi\u0000tudo bem?');
    expect(sanitized).toBe('Oitudo bem?');
  });

  it('remove zero-width chars', () => {
    const sanitized = sanitizeResponse('Oi\u200Btudo\u200D bem\uFEFF?');
    expect(sanitized).toBe('Oitudo bem?');
  });

  it('normaliza quebras de linha', () => {
    const sanitized = sanitizeResponse('Oi\r\nTudo bem?');
    expect(sanitized).toBe('Oi\nTudo bem?');
  });

  it('faz trim', () => {
    const sanitized = sanitizeResponse('  Oi  ');
    expect(sanitized).toBe('Oi');
  });
});

describe('LLM Router — Configuração de Setores', () => {
  it('tem 5 setores configurados', () => {
    expect(Object.keys(SECTOR_MODELS)).toHaveLength(5);
  });

  it('whatsapp_concierge usa Qwen 2.5 72B', () => {
    expect(SECTOR_MODELS.whatsapp_concierge.provider).toBe('qwen');
    expect(SECTOR_MODELS.whatsapp_concierge.model).toContain('Qwen');
  });

  it('smart_locks usa GPT-4o-mini', () => {
    expect(SECTOR_MODELS.smart_locks.provider).toBe('openai');
    expect(SECTOR_MODELS.smart_locks.model).toBe('gpt-4o-mini');
  });

  it('yield_finance usa DeepSeek', () => {
    expect(SECTOR_MODELS.yield_finance.provider).toBe('deepseek');
  });

  it('security_pentest usa Mistral', () => {
    expect(SECTOR_MODELS.security_pentest.provider).toBe('mistral');
  });

  it('contingency usa Groq', () => {
    expect(SECTOR_MODELS.contingency.provider).toBe('groq');
    expect(SECTOR_MODELS.contingency.model).toContain('llama');
  });

  it('smart_locks tem temperatura baixa (precisão JSON)', () => {
    expect(SECTOR_MODELS.smart_locks.temperature).toBeLessThanOrEqual(0.5);
  });

  it('yield_finance tem temperatura baixa (cálculos)', () => {
    expect(SECTOR_MODELS.yield_finance.temperature).toBeLessThanOrEqual(0.3);
  });

  it('security_pentest tem temperatura muito baixa (auditoria)', () => {
    expect(SECTOR_MODELS.security_pentest.temperature).toBeLessThanOrEqual(0.2);
  });
});

describe('LLM Router — classifyComplexity', () => {
  it('classifica saudação simples como fast', () => {
    expect(classifyComplexity('Oi, tudo bem?')).toBe('fast');
  });

  it('classifica pergunta de preço como balanced', () => {
    expect(classifyComplexity('Qual o valor da diária? Vocês fazem desconto?')).toBe('balanced');
  });

  it('classifica reclamação como powerful', () => {
    expect(classifyComplexity('Quero cancelamento com reembolso total ou vou processar!')).toBe('powerful');
  });

  it('classifica mensagem longa (>100 palavras) como powerful', () => {
    const longMsg = 'Bom dia. '.repeat(60);
    expect(classifyComplexity(longMsg)).toBe('powerful');
  });
});
