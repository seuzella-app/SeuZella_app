/**
 * DSPy (Stanford NLP) Evaluator & Runtime Loader for SEU ZÉLLA
 * 
 * Evaluates predictions, loads DSPy compiled prompt JSON artifacts,
 * and executes guardrails.
 */

import compiledPromptsArtifact from './dspy-compiled-prompts.json';
import { AtendimentoHospedeInput, AtendimentoHospedeOutput } from './dspy-signatures';
import { validateAtendimentoGuardrails, DSPyAssertionResult } from './dspy-assertions';

export interface DSPyExecutionResult {
  signatureName: string;
  input: AtendimentoHospedeInput;
  prediction: AtendimentoHospedeOutput;
  guardrails: DSPyAssertionResult[];
  compilerVersion: string;
  fewShotDemosCount: number;
}

/**
 * Loads compiled DSPy prompt artifacts for a signature.
 */
export function getDSPyCompiledSignature(signatureName: 'AtendimentoHospede' | 'ValidadorPIX') {
  const data = (compiledPromptsArtifact.signatures as any)[signatureName];
  return {
    instruction: data?.instruction || '',
    fewShotDemos: data?.fewShotDemos || [],
    version: compiledPromptsArtifact.version,
    metrics: compiledPromptsArtifact.metrics,
  };
}

/**
 * Evaluates Direct PIX Conversion Score (0.0 to 1.0)
 */
export function evaluateDirectPixConversionScore(
  prediction: AtendimentoHospedeOutput,
  targetIntent?: string
): number {
  let score = 0.5; // base score

  // Positive indicators
  if (prediction.respostaWhatsApp.toLowerCase().includes('pix')) score += 0.2;
  if (prediction.respostaWhatsApp.toLowerCase().includes('off') || prediction.respostaWhatsApp.toLowerCase().includes('desconto')) score += 0.15;
  if (prediction.desejaReservar && prediction.valorCalculadoPIX > 0) score += 0.15;

  return Math.min(score, 1.0);
}

/**
 * Executes a DSPy Atendimento Module Run with compiled prompts & guardrails
 */
export function executeDSPyAtendimento(input: AtendimentoHospedeInput): DSPyExecutionResult {
  const compiled = getDSPyCompiledSignature('AtendimentoHospede');
  
  // Predict using compiled prompt structure (Mock / Direct Engine)
  const isPricing = input.perguntaHospede.toLowerCase().includes('valor') || input.perguntaHospede.toLowerCase().includes('diária') || input.perguntaHospede.toLowerCase().includes('quanto');
  const isPet = input.perguntaHospede.toLowerCase().includes('pet') || input.perguntaHospede.toLowerCase().includes('cachorro');

  const propertyName = input.dadosPropriedade.split(',')[0] || (input.niche === 'pousada' ? 'Pousada Zélla' : 'Airbnb Zélla');

  const responseText = isPricing
    ? `Olá! 😊 Ficamos felizes com seu contato! Na **${propertyName}**, nossas diárias estão com condição especial no pagamento **Direct PIX**: 5% OFF!\n\nPosso checar a disponibilidade e reservar agora para você?`
    : isPet
    ? `Olá! 🐾 Sim, aceitamos pets! Na **${propertyName}**, seu pet é muito bem-vindo.\n\nDeseja verificar os valores para o seu período?`
    : `Olá! 😊 Bem-vindo(a) à **${propertyName}**! Como posso te ajudar com valores, localização ou reservas hoje?`;

  const prediction: AtendimentoHospedeOutput = {
    intencaoDetectada: isPricing ? 'preco_disponibilidade' : isPet ? 'pets' : 'geral',
    respostaWhatsApp: responseText,
    desejaReservar: isPricing,
    sugestaoFotos: isPricing || isPet,
    valorCalculadoPIX: isPricing ? 420.0 : 0.0,
  };

  const guardrails = validateAtendimentoGuardrails(prediction);

  return {
    signatureName: 'AtendimentoHospede',
    input,
    prediction,
    guardrails,
    compilerVersion: compiled.version,
    fewShotDemosCount: compiled.fewShotDemos.length,
  };
}
