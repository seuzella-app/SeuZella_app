/**
 * DSPy (Stanford NLP) Signatures Engine for SEU ZÉLLA
 * 
 * Declarative, type-safe interfaces for LLM inputs and outputs.
 * Shifting AI development from brittle text prompt engineering to
 * structured, self-improving module signatures.
 */

export interface DSPyFieldMeta {
  desc: string;
  prefix?: string;
  required?: boolean;
}

export interface DSPySignatureDefinition<TInput = Record<string, any>, TOutput = Record<string, any>> {
  name: string;
  docstring: string;
  inputs: Record<keyof TInput, DSPyFieldMeta>;
  outputs: Record<keyof TOutput, DSPyFieldMeta>;
}

// ── 1. Atendimento de Hóspede 24h ─────────────────────────────────────────────
export interface AtendimentoHospedeInput {
  perguntaHospede: string;
  nomeHospede?: string;
  dadosPropriedade: string;
  niche: 'pousada' | 'airbnb';
  historicoConversa?: string[];
}

export interface AtendimentoHospedeOutput {
  intencaoDetectada: string;
  respostaWhatsApp: string;
  desejaReservar: boolean;
  sugestaoFotos: boolean;
  valorCalculadoPIX: number;
}

export const AtendimentoHospedeSignature: DSPySignatureDefinition<AtendimentoHospedeInput, AtendimentoHospedeOutput> = {
  name: 'AtendimentoHospede',
  docstring: 'Atende o hóspede no WhatsApp com cordialidade, tirando dúvidas sobre check-in, comodidades e buscando fechar a reserva Direct PIX.',
  inputs: {
    perguntaHospede: { desc: 'Mensagem enviada pelo hóspede no WhatsApp', required: true },
    nomeHospede: { desc: 'Nome do hóspede cadastrado' },
    dadosPropriedade: { desc: 'Localização, regras, valores, horários e fotos da propriedade', required: true },
    niche: { desc: 'Nicho da operação (pousada ou airbnb)', required: true },
    historicoConversa: { desc: 'Histórico de mensagens recentes trocadas com o hóspede' },
  },
  outputs: {
    intencaoDetectada: { desc: 'Intenção classificada (ex: preco, disponibilidade, checkin, wifi, pet, geral)' },
    respostaWhatsApp: { desc: 'Resposta amigável em português do Brasil sem formatação muito longa' },
    desejaReservar: { desc: 'Indicador booleano de intenção real de fechamento de reserva' },
    sugestaoFotos: { desc: 'Se a IA recomenda enviar fotos da acomodação nesta mensagem' },
    valorCalculadoPIX: { desc: 'Valor numérico total calculado em R$ para pagamento imediato no PIX' },
  },
};

// ── 2. Reconciliação e Validação de Comprovante PIX ──────────────────────────
export interface ValidadorPIXInput {
  textoComprovante: string;
  valorEsperado: number;
  nomeHospedeEsperado: string;
  dataReserva: string;
}

export interface ValidadorPIXOutput {
  pixValido: boolean;
  valorIdentificado: number;
  codigoAutenticacao: string;
  nomePagador: string;
  confiancaReconciliacao: number; // 0.0 to 1.0
  motivoInvalidez?: string;
}

export const ValidadorPIXSignature: DSPySignatureDefinition<ValidadorPIXInput, ValidadorPIXOutput> = {
  name: 'ValidadorPIX',
  docstring: 'Analisa e reconcilia o comprovante de pagamento PIX do hóspede garantindo zero alucinação antes de autorizar o check-in.',
  inputs: {
    textoComprovante: { desc: 'Texto extraído do comprovante de transferência bancária ou PIX', required: true },
    valorEsperado: { desc: 'Valor total em R$ esperado da reserva', required: true },
    nomeHospedeEsperado: { desc: 'Nome do titular da reserva', required: true },
    dataReserva: { desc: 'Data do check-in pretendido' },
  },
  outputs: {
    pixValido: { desc: 'Indicação booleana de se o PIX é autêntico e cobre o valor esperado' },
    valorIdentificado: { desc: 'Valor em R$ identificado no comprovante' },
    codigoAutenticacao: { desc: 'Código E2E ou id da transação bancária' },
    nomePagador: { desc: 'Nome do pagador no comprovante' },
    confiancaReconciliacao: { desc: 'Grau de confiança de 0.0 a 1.0 na conciliação automatizada' },
    motivoInvalidez: { desc: 'Explicação caso o comprovante seja rejeitado' },
  },
};

// ── 3. Gerador de Instruções de Check-in e PIN da Fechadura ──────────────────
export interface FormatadorPINInput {
  nomeHospede: string;
  quartoAcomodacao: string;
  dataCheckIn: string;
  dataCheckOut: string;
  senhaFechadura: string;
  wifiSenha?: string;
}

export interface FormatadorPINOutput {
  mensagemBoasVindas: string;
  pinFormatado: string;
  instrucoesChegada: string;
}

export const FormatadorPINSignature: DSPySignatureDefinition<FormatadorPINInput, FormatadorPINOutput> = {
  name: 'FormatadorPIN',
  docstring: 'Gera a mensagem de entrega do PIN da fechadura eletrônica e guia digital de chegada do hóspede.',
  inputs: {
    nomeHospede: { desc: 'Nome do hóspede confirmado', required: true },
    quartoAcomodacao: { desc: 'Nome do quarto ou suíte da pousada/airbnb', required: true },
    dataCheckIn: { desc: 'Data e horário de entrada', required: true },
    dataCheckOut: { desc: 'Data e horário de saída', required: true },
    senhaFechadura: { desc: 'Código numérico gerado na fechadura eletrônica', required: true },
    wifiSenha: { desc: 'Nome e senha da rede Wi-Fi' },
  },
  outputs: {
    mensagemBoasVindas: { desc: 'Mensagem festiva de boas-vindas para o WhatsApp' },
    pinFormatado: { desc: 'Formatação clara do PIN (ex: 🔑 Seu PIN de Acesso: 482910#)' },
    instrucoesChegada: { desc: 'Passo a passo simples de como abrir a porta e acessar a acomodação' },
  },
};

// ── 4. Tratador de Objeções de Venda ─────────────────────────────────────────
export interface AnalisadorObjecoesInput {
  objecaoHospede: string; // ex: "Achei um pouco caro", "É longe do centro?", "Consigo desconto no PIX?"
  tarifaPadrao: number;
  descontoMaximoPermitidoPercent: number;
}

export interface AnalisadorObjecoesOutput {
  estrategiaVenda: string;
  contrapropostaPIX: string;
  descontoConcedidoPercent: number;
  valorFinalComDesconto: number;
}

export const AnalisadorObjecoesSignature: DSPySignatureDefinition<AnalisadorObjecoesInput, AnalisadorObjecoesOutput> = {
  name: 'AnalisadorObjecoes',
  docstring: 'Identifica objeções de vendas do hóspede e gera contrapropostas autônomas com incentivo Direct PIX.',
  inputs: {
    objecaoHospede: { desc: 'Mensagem do hóspede com hesitação ou pedido de desconto', required: true },
    tarifaPadrao: { desc: 'Valor normal da diária', required: true },
    descontoMaximoPermitidoPercent: { desc: 'Margem máxima de desconto autorizada pelo dono', required: true },
  },
  outputs: {
    estrategiaVenda: { desc: 'Estratégia adotada (ex: desconto_pix, inclusao_cafe, flexibilidade_horario)' },
    contrapropostaPIX: { desc: 'Argumento de vendas com incentivo de pagamento no PIX' },
    descontoConcedidoPercent: { desc: 'Percentual de desconto aplicado dentro do limite' },
    valorFinalComDesconto: { desc: 'Novo valor total em R$' },
  },
};
