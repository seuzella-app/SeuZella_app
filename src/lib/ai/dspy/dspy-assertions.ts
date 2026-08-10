/**
 * DSPy (Stanford NLP) Assertions & Guardrails Engine for SEU ZÉLLA
 * 
 * Enforces runtime constraints on LLM outputs to prevent hallucinations,
 * anti-ban violations on WhatsApp, and invalid lock PIN dispatches.
 */

export interface DSPyAssertionResult {
  valid: boolean;
  type: 'assert' | 'suggest';
  code: string;
  message: string;
  autoCorrectionHint?: string;
}

export class DSPyAssertionError extends Error {
  public code: string;
  public hint?: string;

  constructor(message: string, code: string, hint?: string) {
    super(`[DSPy Assertion Failure: ${code}] ${message}`);
    this.name = 'DSPyAssertionError';
    this.code = code;
    this.hint = hint;
  }
}

/**
 * Hard Assertion (dspy.Assert equivalent): Throws Error if condition is false.
 */
export function dspyAssert(
  condition: boolean,
  message: string,
  code: string,
  hint?: string
): void {
  if (!condition) {
    throw new DSPyAssertionError(message, code, hint);
  }
}

/**
 * Soft Suggestion (dspy.Suggest equivalent): Returns a warning result if condition is false.
 */
export function dspySuggest(
  condition: boolean,
  message: string,
  code: string,
  hint?: string
): DSPyAssertionResult {
  if (!condition) {
    return {
      valid: false,
      type: 'suggest',
      code,
      message,
      autoCorrectionHint: hint,
    };
  }
  return {
    valid: true,
    type: 'suggest',
    code: 'OK',
    message: 'Assertion passed',
  };
}

/**
 * Guardrails Validator for Atendimento WhatsApp
 */
export function validateAtendimentoGuardrails(output: {
  respostaWhatsApp: string;
  desejaReservar: boolean;
  valorCalculadoPIX: number;
}): DSPyAssertionResult[] {
  const results: DSPyAssertionResult[] = [];

  // 1. Anti-Ban WhatsApp Constraint: Message length should not exceed 1000 characters
  results.push(
    dspySuggest(
      output.respostaWhatsApp.length <= 1000,
      'A mensagem ultrapassa 1000 caracteres. Reduza o tamanho para evitar bloqueio no WhatsApp.',
      'WHATSAPP_LENGTH_EXCEEDED',
      'Resuma os pontos principais em no máximo 3 parágrafos curtos.'
    )
  );

  // 2. Pricing Consistency Constraint: If guest wants to book, PIX price must be positive
  if (output.desejaReservar) {
    results.push(
      dspySuggest(
        output.valorCalculadoPIX > 0,
        'Intenção de reserva detectada, mas o valor do PIX é 0.0.',
        'ZERO_PIX_AMOUNT_ON_BOOKING',
        'Inclua a tarifa total calculada no campo valorCalculadoPIX.'
      )
    );
  }

  // 3. Anti-Spam Terms Constraint: Check forbidden terms that trigger WhatsApp ban filters
  const forbiddenTerms = ['ganhe dinheiro', 'crédito bancário grátis', 'clique no link urgente', 'transferência imediata sem foto'];
  const textLower = output.respostaWhatsApp.toLowerCase();
  const foundForbidden = forbiddenTerms.find(term => textLower.includes(term));

  if (foundForbidden) {
    dspyAssert(
      false,
      `Termo proibido detectado na resposta do WhatsApp: "${foundForbidden}"`,
      'FORBIDDEN_SPAM_TERM',
      'Remova termos apelativos de spam.'
    );
  }

  return results;
}

/**
 * Guardrails Validator for Reconciliação PIX
 */
export function validatePixGuardrails(output: {
  pixValido: boolean;
  valorIdentificado: number;
  valorEsperado: number;
}): void {
  // Hard assertion: Valid PIX cannot have zero or negative identified amount
  if (output.pixValido) {
    dspyAssert(
      output.valorIdentificado > 0,
      'Comprovante marcado como válido, mas o valor identificado é zero.',
      'PIX_ZERO_AMOUNT'
    );

    // Hard assertion: Identified amount cannot be less than 90% of expected amount (allowing small custom discounts)
    dspyAssert(
      output.valorIdentificado >= output.valorEsperado * 0.9,
      `Valor pago (R$ ${output.valorIdentificado}) é inferior ao mínimo aceitável de 90% do total (R$ ${output.valorEsperado}).`,
      'PIX_UNDERPAID'
    );
  }
}
