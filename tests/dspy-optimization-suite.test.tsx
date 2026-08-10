import { describe, it, expect } from 'vitest';
import { AtendimentoHospedeSignature, ValidadorPIXSignature } from '../src/lib/ai/dspy/dspy-signatures';
import { dspyAssert, dspySuggest, validateAtendimentoGuardrails, validatePixGuardrails } from '../src/lib/ai/dspy/dspy-assertions';
import { getDSPyCompiledSignature, executeDSPyAtendimento, evaluateDirectPixConversionScore } from '../src/lib/ai/dspy/dspy-evaluator';

describe('🧠 DSPy (Stanford NLP) Optimization & Guardrails Suite', () => {
  it('should validate DSPy Signatures declarative definitions', () => {
    expect(AtendimentoHospedeSignature.name).toBe('AtendimentoHospede');
    expect(AtendimentoHospedeSignature.inputs.perguntaHospede).toBeDefined();
    expect(AtendimentoHospedeSignature.outputs.respostaWhatsApp).toBeDefined();
    expect(AtendimentoHospedeSignature.outputs.valorCalculadoPIX).toBeDefined();

    expect(ValidadorPIXSignature.name).toBe('ValidadorPIX');
    expect(ValidadorPIXSignature.inputs.textoComprovante).toBeDefined();
    expect(ValidadorPIXSignature.outputs.pixValido).toBeDefined();
  });

  it('should execute dspyAssert and dspySuggest guardrails correctly', () => {
    // Assert pass
    expect(() => dspyAssert(true, 'No error', 'CODE_PASS')).not.toThrow();

    // Assert fail
    expect(() => dspyAssert(false, 'Forbidden condition', 'TEST_FAIL')).toThrow('[DSPy Assertion Failure: TEST_FAIL]');

    // Suggest pass
    const suggestPass = dspySuggest(true, 'Message good', 'SUGGEST_OK');
    expect(suggestPass.valid).toBe(true);

    // Suggest fail
    const suggestFail = dspySuggest(false, 'Message too long', 'WHATSAPP_LENGTH_EXCEEDED');
    expect(suggestFail.valid).toBe(false);
    expect(suggestFail.code).toBe('WHATSAPP_LENGTH_EXCEEDED');
  });

  it('should enforce WhatsApp anti-ban and zero-PIX guardrails', () => {
    const validOutput = {
      respostaWhatsApp: 'Olá! A diária da Pousada Zélla é R$ 420.00.',
      desejaReservar: true,
      valorCalculadoPIX: 420.0,
    };

    const guardrails = validateAtendimentoGuardrails(validOutput);
    expect(guardrails.every(g => g.valid)).toBe(true);

    // Test zero PIX amount with reservation intent
    const invalidOutput = {
      respostaWhatsApp: 'Quero reservar!',
      desejaReservar: true,
      valorCalculadoPIX: 0.0,
    };

    const invalidGuardrails = validateAtendimentoGuardrails(invalidOutput);
    const zeroPixWarning = invalidGuardrails.find(g => g.code === 'ZERO_PIX_AMOUNT_ON_BOOKING');
    expect(zeroPixWarning).toBeDefined();
    expect(zeroPixWarning?.valid).toBe(false);
  });

  it('should enforce hard PIX reconciliaton assertions', () => {
    // Valid PIX
    expect(() => validatePixGuardrails({
      pixValido: true,
      valorIdentificado: 500.0,
      valorEsperado: 500.0,
    })).not.toThrow();

    // Underpaid PIX (less than 90%)
    expect(() => validatePixGuardrails({
      pixValido: true,
      valorIdentificado: 200.0,
      valorEsperado: 500.0,
    })).toThrow('[DSPy Assertion Failure: PIX_UNDERPAID]');
  });

  it('should load compiled DSPy JSON prompt artifacts', () => {
    const compiled = getDSPyCompiledSignature('AtendimentoHospede');
    expect(compiled.version).toBeDefined();
    expect(compiled.instruction.length).toBeGreaterThan(10);
    expect(compiled.fewShotDemos.length).toBeGreaterThan(0);
    expect(compiled.metrics.directPixConversionRate).toBeGreaterThan(0.3);
  });

  it('should execute DSPy Atendimento module run and score conversion', () => {
    const runResult = executeDSPyAtendimento({
      perguntaHospede: 'Qual o valor da diária para o próximo sábado?',
      dadosPropriedade: 'Pousada Zélla — R$ 420/noite',
      niche: 'pousada',
    });

    expect(runResult.signatureName).toBe('AtendimentoHospede');
    expect(runResult.prediction.intencaoDetectada).toBe('preco_disponibilidade');
    expect(runResult.prediction.desejaReservar).toBe(true);
    expect(runResult.prediction.valorCalculadoPIX).toBe(420.0);

    const conversionScore = evaluateDirectPixConversionScore(runResult.prediction);
    expect(conversionScore).toBeGreaterThan(0.7);
  });
});
