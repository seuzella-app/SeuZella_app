import { describe, it, expect } from 'vitest';
import { redactSensitiveData, LLMDataRedactor } from '@/lib/security/redactor';

describe('🛡️ Sensitive Data Redactor & LLM Privacy Boundary (P1)', () => {
  it('deve redigir senhas, API keys e Bearer tokens em strings e objetos', () => {
    const rawPayload = {
      apiKey: 'sk-1234567890abcdef1234567890abcdef',
      password: 'MySecretPassword123!',
      authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz',
      user: {
        email: 'guest@example.com',
        creditCard: '4111 2222 3333 4444',
      },
    };

    const redacted = redactSensitiveData(rawPayload);

    expect(redacted.apiKey).toBe('[REDACTED_SECRET]');
    expect(redacted.password).toBe('[REDACTED_SECRET]');
    expect(redacted.authHeader).toBe('Bearer [REDACTED_TOKEN]');
    expect(redacted.user.creditCard).toBe('[CARD_****_4444]');
  });

  it('deve sanitizar prompt antes de enviar para LLMs externos e permitir restauração', () => {
    const promptWithPII = 'O hóspede com CPF 123.456.789-00 e cartão 5555-4444-3333-2222 solicitou check-in tardio.';

    const { sanitizedPrompt, hasRedactions, tokenMap } = LLMDataRedactor.sanitizePromptContext(promptWithPII);

    expect(hasRedactions).toBe(true);
    expect(sanitizedPrompt).not.toContain('123.456.789-00');
    expect(sanitizedPrompt).not.toContain('5555-4444-3333-2222');
    expect(sanitizedPrompt).toContain('[GUEST_DOC_');
    expect(sanitizedPrompt).toContain('[CARD_TOKEN_');

    const llmResponse = `Confirmado check-in para o portador do documento ${tokenMap.keys().next().value}.`;
    const restored = LLMDataRedactor.restorePromptContext(llmResponse, tokenMap);

    expect(restored).toContain('123.456.789-00');
  });
});
