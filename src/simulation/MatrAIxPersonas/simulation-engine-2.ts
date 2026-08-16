// ============================================================================
// Motor de Simulação 2 — Setembro a Fevereiro (6 meses)
// ----------------------------------------------------------------------------
// Versão 2 do motor, com:
//   1. Janela de simulação de 6 meses (Set a Fev) cobrindo feriados brasileiros
//   2. Demanda sazonal por dia/mês/feriado (curva de procura)
//   3. Yield Booster: diárias dinâmicas em alta temporada (+80-200%)
//   4. Comissão Zélla de 7% sobre cada UPSELL (crédito à seuzella.com)
//   5. Diálogo humanizado (usa humanized-dialogue.ts)
//   6. Reconhecimento de hóspede recorrente (pós-reserva)
//   7. Detecção de emoção nas primeiras mensagens
//   8. Identidade Zélla/Zé quando perguntado
//   9. Sinistros realistas (~5% das reservas com caução)
//  10. Métricas expandidas para relatório comparativo vs Teste 1
// ============================================================================

import { POUSADAS_DATASET_EXPANDIDO, type PousadaSimulada } from './pousadas-dataset-expandido';
import { PERSONAS_MATRAIX_EXPANDIDO, type PersonaMatrAIx } from './personas-matraix-expandido';
import {
  gerarPrimeiraResposta,
  gerarRespostaIdentidade,
  gerarRespostaObjecaoHumanizada,
  gerarRespostaDetalhes,
  gerarCotacaoDireta,
  gerarExplicacaoCaucao,
  gerarPropostaFormal,
  gerarRespostaRecomendacoes,
  gerarRespostaPacote,
  gerarTranquilizacao,
  gerarFechamento,
  detectarEmocao,
  type EmocaoResult,
} from './humanized-dialogue';
import type { ConversationMessage } from './simulation-engine';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — exportados para uso no relatório
// ─────────────────────────────────────────────────────────────────────────────
export interface SimulationConfig2 {
  pousadasCount?: number;
  personasCount?: number;
  diasSimulados?: number; // 6 meses = 180 dias
  verbose?: boolean;
  seed?: number;
  comissaoZehlaRate?: number; // default 0.07 (7%)
}

export interface LeadRecord2 {
  id: string;
  pousada_id: string;
  persona_id: string;
  timestamp: string;
  canal: string;
  mensagem_inicial: string;
  resposta_ia_tempo_seg: number | null;
  status: 'aberto' | 'respondido' | 'cotado' | 'reservado' | 'abandonado' | 'caucao_recusada';
  motivo_abandono?: string;
  mensagens: ConversationMessage[];
  cotação_valor?: number;
  caucao_pedida?: number;
  caucao_aceita?: boolean;
  checkout_estendido_oferecido?: boolean;
  checkout_estendido_aceito?: boolean;
  upsell_oferecido?: string[];
  upsell_aceito?: string[];
  reserva_id?: string;
  emocao_detectada?: EmocaoResult;
  is_hospede_recorrente?: boolean;
  temporada_dia?: 'alta' | 'média' | 'baixa';
  feriado_proximo?: string;
  diaria_yieled_aplicada?: number; // valor com yield
  yield_multiplier?: number;
}

export interface ReservationRecord2 {
  id: string;
  pousada_id: string;
  persona_id: string;
  lead_id: string;
  check_in: string;
  check_out: string;
  quarto: string;
  diaria_valor: number; // já com yield aplicado
  diaria_base_original: number;
  qtd_diarias: number;
  valor_total: number;
  caucao_valor: number;
  caucao_pago: boolean;
  caucao_status: 'pending' | 'collected' | 'returned' | 'retained' | 'disabled';
  checkout_estendido_horas: number;
  upsell_total: number;
  upsell_items: string[];
  upsell_comissao_zehla: number; // 7% do upsell creditado à Zélla
  pin_fechadura_gerado: boolean;
  sinistro: boolean;
  sinistro_descricao?: string;
  nps_score: number;
  recommend: boolean;
  review_text?: string;
  feriado?: string;
  temporada: 'alta' | 'média' | 'baixa';
  yield_multiplier: number;
}

export interface SimulationMetrics2 {
  total_leads: number;
  total_reservas: number;
  total_abandonos: number;
  taxa_conversao: number;
  taxa_resposta_ia: number;
  tempo_medio_resposta_ia_min: number;
  taxa_abandono_preco: number;
  taxa_abandono_caucao: number;
  taxa_abandono_checkin: number;
  taxa_abandono_outros: number;

  // Caução
  reservas_com_caucao: number;
  reservas_sem_caucao: number;
  reservas_caucao_aceita: number;
  reservas_caucao_recusada: number;
  taxa_caucao_aceita: number;

  // Upsell
  reservas_com_checkout_estendido: number;
  taxa_checkout_estendido: number;
  reservas_com_upsell: number;
  upsell_receita_total: number;
  comissao_zehla_total: number; // 7% do upsell

  // Fechadura
  reservas_com_pin_gerado: number;

  // Sinistros
  sinistros_total: number;
  taxa_sinistro: number;
  estornos_automaticos: number;
  estornos_retidos: number;

  // NPS
  nps_medio: number;
  promotores: number;
  neutros: number;
  detratores: number;
  taxa_recomendacao: number;

  // Financeiro
  receita_total_reservas: number;
  receita_total_caucao: number;
  custo_ia_total: number;
  custo_ia_por_reserva: number;
  roi_ia: number;

  // Yield Booster (nova métrica)
  receita_yield_booster_extra: number; // receita extra gerada por diárias dinâmicas
  yield_medio: number;

  // Hóspede recorrente (nova métrica)
  total_leads_recorrentes: number;
  taxa_recorrencia: number;

  // Distribuições
  leads_por_canal: Record<string, number>;
  reservas_por_tipo_pousada: Record<string, number>;
  reservas_por_temporada: Record<string, number>;
  reservas_por_estado: Record<string, number>;
  reservas_por_estilo_persona: Record<string, number>;
  reservas_por_feriado: Record<string, number>;
  emocoes_detectadas: Record<string, number>;

  // Comparativo Caução ON vs OFF
  comparativo_caucao: {
    com_caucao: { leads: number; reservas: number; taxa_conv: number; nps: number; receita: number };
    sem_caucao: { leads: number; reservas: number; taxa_conv: number; nps: number; receita: number };
  };

  // Comparativo Yield ON vs OFF (teórico — yield sempre ON nesta simulação)
  comparativo_yield: {
    receita_com_yield: number;
    receita_sem_yield_teorica: number;
    ganho_extra: number;
  };
}

export interface SimulationResult2 {
  config: SimulationConfig2;
  timestamp_inicio: number;
  timestamp_fim: number;
  duracao_ms: number;
  leads: LeadRecord2[];
  reservas: ReservationRecord2[];
  metrics: SimulationMetrics2;
  amostra_conversas: LeadRecord2[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DE FERIADOS — Setembro a Fevereiro
// ─────────────────────────────────────────────────────────────────────────────
interface FeriadoConfig {
  data: string; // MM-DD (sem ano)
  nome: string;
  impacto_demanda: number; // multiplicador (1.5 = +50% de leads)
  impacto_diaria: number; // multiplicador de diária (1.8 = +80%)
  janela_dias: number; // quantos dias antes/depois impacta
}

const FERIADOS_SET_FEV: FeriadoConfig[] = [
  // Setembro
  { data: '09-07', nome: 'Independência do Brasil', impacto_demanda: 1.4, impacto_diaria: 1.5, janela_dias: 2 },
  // Outubro
  { data: '10-12', nome: 'Nossa Senhora Aparecida', impacto_demanda: 1.3, impacto_diaria: 1.4, janela_dias: 2 },
  // Novembro
  { data: '11-02', nome: 'Finados', impacto_demanda: 1.2, impacto_diaria: 1.3, janela_dias: 1 },
  { data: '11-15', nome: 'Proclamação da República', impacto_demanda: 1.4, impacto_diaria: 1.5, janela_dias: 2 },
  // Dezembro
  { data: '12-24', nome: 'Véspera de Natal', impacto_demanda: 2.5, impacto_diaria: 2.5, janela_dias: 3 },
  { data: '12-25', nome: 'Natal', impacto_demanda: 2.5, impacto_diaria: 2.5, janela_dias: 3 },
  { data: '12-31', nome: 'Véspera de Réveillon', impacto_demanda: 3.0, impacto_diaria: 3.0, janela_dias: 4 },
  // Janeiro
  { data: '01-01', nome: 'Ano Novo / Confraternização', impacto_demanda: 3.0, impacto_diaria: 3.0, janela_dias: 4 },
  { data: '01-15', nome: 'Verão alto season', impacto_demanda: 2.0, impacto_diaria: 1.8, janela_dias: 30 }, // janeiro inteiro
  // Fevereiro
  { data: '02-15', nome: 'Verão alto season', impacto_demanda: 1.8, impacto_diaria: 1.6, janela_dias: 28 }, // fevereiro inteiro
  // Carnaval (data variável, usamos 15/02 como proxy)
  { data: '02-13', nome: 'Carnaval (segunda)', impacto_demanda: 2.8, impacto_diaria: 2.8, janela_dias: 5 },
  { data: '02-14', nome: 'Carnaval (terça)', impacto_demanda: 2.8, impacto_diaria: 2.8, janela_dias: 5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CALCULA DEMANDA E YIELD PARA UM DIA
// ─────────────────────────────────────────────────────────────────────────────
function calcularDemandaYield(dataISO: string, pousada: PousadaSimulada): {
  multiplicador_demanda: number;
  yield_multiplier: number;
  feriado_proximo: string | null;
  temporada: 'alta' | 'média' | 'baixa';
} {
  const data = new Date(dataISO);
  const mes = data.getMonth() + 1;
  const dia = data.getDate();
  const mmdd = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  let multiplicadorDemanda = 1.0;
  let yieldMultiplier = 1.0;
  let feriadoProximo: string | null = null;

  for (const f of FERIADOS_SET_FEV) {
    const [fMes, fDia] = f.data.split('-').map(Number);
    const feriadoData = new Date(data.getFullYear(), fMes - 1, fDia);
    const diffDias = Math.abs((data.getTime() - feriadoData.getTime()) / 86400_000);

    if (diffDias <= f.janela_dias) {
      // Aplica impacto proporcional (pico no dia do feriado, cai nos dias adjacentes)
      const fator = 1 - (diffDias / Math.max(1, f.janela_dias + 1));
      multiplicadorDemanda = Math.max(multiplicadorDemanda, 1 + (f.impacto_demanda - 1) * fator);
      yieldMultiplier = Math.max(yieldMultiplier, 1 + (f.impacto_diaria - 1) * fator);
      feriadoProximo = f.nome;
    }
  }

  // Verão (Dez a Fev) já é alta temporada
  let temporada: 'alta' | 'média' | 'baixa' = 'baixa';
  if (mes === 12 || mes === 1 || mes === 2) {
    temporada = 'alta';
    if (feriadoProximo === null) {
      multiplicadorDemanda = Math.max(multiplicadorDemanda, 1.5);
      yieldMultiplier = Math.max(yieldMultiplier, 1.5);
    }
  } else if (mes === 9 || mes === 10 || mes === 11) {
    // Set-Nov: média temporada, exceto feriados
    temporada = 'média';
    if (feriadoProximo === null) {
      multiplicadorDemanda = Math.max(multiplicadorDemanda, 0.9);
    }
  }

  return {
    multiplicador_demanda: multiplicadorDemanda,
    yield_multiplier: yieldMultiplier,
    feriado_proximo: feriadoProximo,
    temporada,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RNG
// ─────────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA DIÁLOGO HUMANIZADO — usa motor novo
// ─────────────────────────────────────────────────────────────────────────────
function gerarDialogoHumanizado(
  persona: PersonaMatrAIx,
  pousada: PousadaSimulada,
  rng: () => number,
  isRecorrente: boolean = false,
): { messages: ConversationMessage[]; emocao: EmocaoResult } {
  const messages: ConversationMessage[] = [];
  const now = Date.now();

  // 1. Primeira mensagem da persona
  const primeiraMsg = persona.primeira_mensagem_template;
  messages.push({
    timestamp: now,
    sender: 'persona',
    content: primeiraMsg,
    intent: 'solicitar_informacoes',
  });

  // 2. Detecta emoção na primeira mensagem
  const emocao = detectarEmocao(primeiraMsg);

  // 3. Resposta da IA (humanizada)
  const tempoRespostaIA = pousada.donoPerfil.usaIA ?
    Math.floor(2 + rng() * 30) : // IA: 2-32s
    pousada.donoPerfil.respostaTempoMedio * 60; // humano

  const primeiraResposta = gerarPrimeiraResposta(persona, pousada, emocao, rng, isRecorrente);
  messages.push({
    timestamp: now + tempoRespostaIA * 1000,
    sender: 'ia_pousada',
    content: primeiraResposta.content,
    intent: primeiraResposta.intent,
  });

  // 4. Se hóspede perguntou "quem é você", IA se apresenta
  if (primeiraMsg.toLowerCase().includes('quem é você') ||
      primeiraMsg.toLowerCase().includes('com quem falo') ||
      primeiraMsg.toLowerCase().includes('quem fala')) {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 30_000,
      sender: 'persona',
      content: 'Ah, legal! E com quem estou falando?',
      intent: 'perguntar_identidade',
    });
    const respostaIdentidade = gerarRespostaIdentidade(persona, pousada, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 35_000,
      sender: 'ia_pousada',
      content: respostaIdentidade.content,
      intent: respostaIdentidade.intent,
    });
  }

  // 5. Resposta da persona conforme estilo (sem robotização)
  const estilo = persona.estilo_dialogo;
  if (estilo === 'curioso_detalhista') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 60_000,
      sender: 'persona',
      content: 'Pode me mandar mais detalhes? Café da manhã tem até que horas? Estacionamento coberto? A partir de que horas posso fazer check-in?',
      intent: 'pedir_detalhes',
    });
    const detalhes = gerarRespostaDetalhes(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 65_000,
      sender: 'ia_pousada',
      content: detalhes.content,
      intent: detalhes.intent,
    });
  } else if (estilo === 'direto_objetivo') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 30_000,
      sender: 'persona',
      content: `Beleza. Manda valor final: ${persona.duracao_estadia_dias} diárias, ${persona.grupo_tamanho} pessoas. PIX?`,
      intent: 'solicitar_cotacao',
    });
    const cotacao = gerarCotacaoDireta(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 35_000,
      sender: 'ia_pousada',
      content: cotacao.content,
      intent: cotacao.intent,
    });
  } else if (estilo === 'preocupado_regras') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 90_000,
      sender: 'persona',
      content: 'Ok. Antes de fechar: política de cancelamento? Caução — como funciona exatamente?',
      intent: 'clarar_regras',
    });
    const explicacao = gerarExplicacaoCaucao(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 95_000,
      sender: 'ia_pousada',
      content: explicacao.content,
      intent: explicacao.intent,
    });
  } else if (estilo === 'impaciente_pressa') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 20_000,
      sender: 'persona',
      content: 'Beleza, mas pode mandar só o valor final? Tô esperando resposta faz tempo.',
      intent: 'pressa',
    });
    const cotacao = gerarCotacaoDireta(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 25_000,
      sender: 'ia_pousada',
      content: cotacao.content,
      intent: cotacao.intent,
    });
  } else if (estilo === 'amigavel_conversador') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 120_000,
      sender: 'persona',
      content: 'Adorei! As fotos estão lindas. Me conta: vocês indicam passeios por aí?',
      intent: 'pedir_recomendacoes',
    });
    const recs = gerarRespostaRecomendacoes(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 125_000,
      sender: 'ia_pousada',
      content: recs.content,
      intent: recs.intent,
    });
  } else if (estilo === 'formal_educado') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 180_000,
      sender: 'persona',
      content: 'Agradeço as informações. Favor enviar proposta formal com discriminação de valores.',
      intent: 'solicitar_proposta_formal',
    });
    const proposta = gerarPropostaFormal(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 185_000,
      sender: 'ia_pousada',
      content: proposta.content,
      intent: proposta.intent,
    });
  } else if (estilo === 'desconfiado_cauteloso') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 150_000,
      sender: 'persona',
      content: 'Já tive problema com caução uma vez. Como eu sei que vão devolver? Vocês têm CNPJ?',
      intent: 'verificar_credibilidade',
    });
    const tranquilizacao = gerarTranquilizacao(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 155_000,
      sender: 'ia_pousada',
      content: tranquilizacao.content,
      intent: tranquilizacao.intent,
    });
  } else if (estilo === 'entusiasmado_festas') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 90_000,
      sender: 'persona',
      content: 'Vai ser TOP! Queríamos pacote com café da manhã, limpeza diária e late checkout. Faz pacote?',
      intent: 'solicitar_pacote',
    });
    const pacote = gerarRespostaPacote(pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 95_000,
      sender: 'ia_pousada',
      content: pacote.content,
      intent: pacote.intent,
    });
  }

  // 6. Objeção (50% das conversas)
  if (rng() < 0.50) {
    const objecao = pick(persona.padrao_objecoes, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 200_000,
      sender: 'persona',
      content: objecao,
      intent: 'objecao',
    });

    const respostaObjecao = gerarRespostaObjecaoHumanizada(objecao, pousada, persona, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 210_000,
      sender: 'ia_pousada',
      content: respostaObjecao.content,
      intent: respostaObjecao.intent,
    });
  }

  // 7. Decisão final
  const decidiuReservar = rng() < persona.prob_reservar_apos_contato;
  if (decidiuReservar) {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 300_000,
      sender: 'persona',
      content: 'Perfeito! Vamos reservar então. Manda os próximos passos.',
      intent: 'aceitar_reserva',
    });
  } else {
    const motivos = ['preco_alto', 'caucao_preocupacao', 'checkin_inconveniente', 'outra_pousada', 'mudou_planos', 'nao_respondeu'];
    const motivo = pick(motivos, rng);
    const msg = gerarMensagemAbandono(motivo, rng);
    if (msg) {
      messages.push({
        timestamp: now + tempoRespostaIA * 1000 + 300_000,
        sender: 'persona',
        content: msg,
        intent: 'abandonar',
      });
    }
  }

  return { messages, emocao };
}

function gerarMensagemAbandono(motivo: string, rng: () => number): string {
  switch (motivo) {
    case 'preco_alto':
      return pick([
        'Puxa, está acima do meu orçamento. Vou ver e te aviso.',
        'Achei caro. Vou procurar outra opção.',
        'Obrigada pela atenção, mas vou ficar com uma pousada mais em conta.',
      ], rng);
    case 'caucao_preocupacao':
      return pick([
        'Entendi da caução, mas fico receosa. Vou pensar.',
        'Não to confortável com a caução, vou optar por um lugar que não pede.',
      ], rng);
    case 'checkin_inconveniente':
      return pick([
        'O check-in é tarde demais pra nós. Vou ver outra.',
        'Não consigo chegar tão tarde. Obrigada!',
      ], rng);
    case 'outra_pousada':
      return pick([
        'Já fechei com outra pousada. Obrigada!',
        'Acabei de reservar em outro lugar. Valeu pela atenção.',
      ], rng);
    case 'mudou_planos':
      return pick([
        'Tive que mudar meus planos. Cancelo a viagem.',
        'Vou viajar outro dia. Avisando.',
      ], rng);
    case 'nao_respondeu':
      return ''; // silêncio
    default:
      return 'Vou pensar e te aviso.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULAÇÃO DE RESERVA (com Yield Booster + comissão 7%)
// ─────────────────────────────────────────────────────────────────────────────
function simularReserva2(
  lead: LeadRecord2,
  persona: PersonaMatrAIx,
  pousada: PousadaSimulada,
  rng: () => number,
  yieldMultiplier: number,
  feriadoProximo: string | null,
  temporada: 'alta' | 'média' | 'baixa',
  comissaoZehlaRate: number,
): ReservationRecord2 | null {
  if (lead.status !== 'reservado') return null;

  const checkIn = Date.now() + persona.antecedencia_reserva_dias * 86400_000;
  const checkOut = checkIn + persona.duracao_estadia_dias * 86400_000;

  // Caução
  let caucaoStatus: ReservationRecord2['caucao_status'] = 'disabled';
  let caucaoPago = false;
  if (pousada.caucaoHabilitada) {
    const aceitouCaucao = rng() < persona.prob_reservar_apos_contato * (1 - persona.cao_preocupacao_caucao * 0.5);
    if (aceitouCaucao) {
      caucaoStatus = 'collected';
      caucaoPago = true;
    } else {
      if (rng() < 0.70) {
        caucaoStatus = 'disabled';
      } else {
        lead.status = 'caucao_recusada';
        lead.motivo_abandono = 'caucao_recusada';
        return null;
      }
    }
  }

  // Late checkout
  const ofereceuCheckout = rng() < 0.40 + persona.interesse_checkout_estendido * 0.40;
  const aceitouCheckout = ofereceuCheckout && rng() < persona.interesse_checkout_estendido;
  const checkoutEstendidoHoras = aceitouCheckout ? pick([2, 3, 4, 4], rng) : 0;
  lead.checkout_estendido_oferecido = ofereceuCheckout;
  lead.checkout_estendido_aceito = aceitouCheckout;

  // Upsell
  const upsellsPossiveis = [
    { item: 'Café da manhã premium', valor: 35, prob: 0.30 },
    { item: 'Massagem relaxante', valor: 150, prob: 0.20 },
    { item: 'Passeio de barco', valor: 120, prob: 0.25 },
    { item: 'Transfer aeroporto', valor: 80, prob: 0.15 },
    { item: 'Jantar romântico', valor: 200, prob: 0.10 },
    { item: 'Late check-in (madrugada)', valor: 30, prob: 0.20 },
    { item: 'Decoração quarto (aniversário)', valor: 90, prob: 0.15 },
    { item: 'Garrafa de vinho', valor: 70, prob: 0.25 },
    { item: 'Aula de surf', valor: 100, prob: 0.20 },
    { item: 'Passeio de bugue', valor: 90, prob: 0.25 },
    { item: 'Spa day (hidratação)', valor: 250, prob: 0.10 },
    { item: 'Kit praia (guarda-sol + cadeiras)', valor: 50, prob: 0.30 },
  ];
  // Em feriados de alta temporada, mais upsell (hóspede mais disposto a gastar)
  const boostUpsellFeriado = temporada === 'alta' ? 1.2 : temporada === 'média' ? 1.0 : 0.85;

  const upsellAceito: string[] = [];
  let upsellTotal = 0;
  for (const u of upsellsPossiveis) {
    if (rng() < u.prob * persona.interesse_upsell * boostUpsellFeriado) {
      upsellAceito.push(u.item);
      upsellTotal += u.valor * persona.duracao_estadia_dias;
    }
  }
  lead.upsell_oferecido = upsellsPossiveis.map(u => u.item);
  lead.upsell_aceito = upsellAceito;

  // PIN fechar eletrônica
  const pinGerado = rng() < persona.interesse_fechadura_eletronica;

  // Sinistro (5% das reservas com caução)
  const sinistro = caucaoStatus === 'collected' && rng() < 0.05;
  const sinistroDescricao = sinistro ? pick([
    'Mancha de vinho no colchão',
    'Toalhas rasgadas',
    'Cinzeiro com bitucas no quarto non-smoking',
    'Dano no cortado do banheiro',
    'Mancha de maquiagem na fronha',
    'Móvel arranhado',
    'Ar condicionado quebrado (custo de reparo)',
    'Lençóis manchados de protetor solar',
    'Vaso sanitário entupido',
    'Cortina do box rasgada',
  ], rng) : undefined;

  if (sinistro) caucaoStatus = 'retained';
  else if (caucaoStatus === 'collected') caucaoStatus = 'returned';

  // NPS
  let nps = 7;
  if (!sinistro) nps = Math.floor(6 + rng() * 4);
  else nps = Math.floor(2 + rng() * 4);
  if (caucaoStatus === 'retained') nps = Math.max(1, nps - 3);
  if (upsellAceito.length > 0) nps = Math.min(10, nps + 1);
  if (pousada.donoPerfil.usaIA && pousada.donoPerfil.respostaTempoMedio < 10) nps = Math.min(10, nps + 1);
  // Bônus de NPS em alta temporada: atendimento flui melhor
  if (temporada === 'alta' && pousada.donoPerfil.usaIA) nps = Math.min(10, nps + 0);

  const recommend = nps >= 7;

  let reviewText: string | undefined;
  if (rng() < 0.55) {
    if (nps >= 9) {
      reviewText = pick([
        `Atendimento impecável pela Zélla. ${pousada.nome} superou expectativas. Voltaria com certeza.`,
        `Zélla (ou Zé, como ela pede pra chamar) foi super atenciosa. Recomendo demais!`,
        `Perfeito! Café da manhã farto, quarto limpo, vista linda.`,
        `Resposta super rápida pelo WhatsApp. Adorei a estadia!`,
      ], rng);
    } else if (nps >= 7) {
      reviewText = pick([
        `Boa estadia no geral. Algumas coisas poderiam melhorar mas recomendo.`,
        `Atendeu minhas expectativas. Vale o preço.`,
        `Foi bom. Algumas dúvidas sobre a caução mas resolvido.`,
      ], rng);
    } else {
      reviewText = pick([
        `Não foi o que esperava. ${sinistro ? 'Sinistro mal resolvido.' : 'Atendimento demorado.'}`,
        `Decepcionado com alguns pontos. Não voltaria.`,
        `${caucaoStatus === 'retained' ? 'Problema com a caução — retida injustamente.' : 'Esperava mais.'}`,
      ], rng);
    }
  }

  // Cálculo financeiro COM Yield Booster
  const diariaBaseOriginal = pousada.diariaBase;
  const diariaComYield = Math.round(diariaBaseOriginal * yieldMultiplier);
  const qtdDiarias = persona.duracao_estadia_dias;
  const valorTotal = diariaComYield * qtdDiarias * Math.ceil(persona.grupo_tamanho / 2);
  const caucaoValor = pousada.caucaoHabilitada ? pousada.caucaoPadrao : 0;

  // Comissão Zélla: 7% do upsell total
  const upsellComissaoZehla = upsellTotal * comissaoZehlaRate;

  return {
    id: `RES${String(Math.floor(rng() * 1_000_000_0)).padStart(7, '0')}`,
    pousada_id: pousada.id,
    persona_id: persona.id,
    lead_id: lead.id,
    check_in: new Date(checkIn).toISOString(),
    check_out: new Date(checkOut).toISOString(),
    quarto: pick(['Standard', 'Casal', 'Casal Luxo', 'Suite', 'Bangalô', 'Chalé'], rng),
    diaria_valor: diariaComYield,
    diaria_base_original: diariaBaseOriginal,
    qtd_diarias: qtdDiarias,
    valor_total: valorTotal,
    caucao_valor: caucaoValor,
    caucao_pago: caucaoPago,
    caucao_status: caucaoStatus,
    checkout_estendido_horas: checkoutEstendidoHoras,
    upsell_total: upsellTotal,
    upsell_items: upsellAceito,
    upsell_comissao_zehla: upsellComissaoZehla,
    pin_fechadura_gerado: pinGerado,
    sinistro,
    sinistro_descricao: sinistroDescricao,
    nps_score: nps,
    recommend,
    review_text: reviewText,
    feriado: feriadoProximo || undefined,
    temporada,
    yield_multiplier: yieldMultiplier,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN — Executa a simulação 2
// ─────────────────────────────────────────────────────────────────────────────
export function runSimulation2(config: SimulationConfig2 = {}): SimulationResult2 {
  const t0 = Date.now();
  const seed = config.seed ?? 42;
  const rng = mulberry32(seed);
  const comissaoZehlaRate = config.comissaoZehlaRate ?? 0.07;

  const pousadas = POUSADAS_DATASET_EXPANDIDO.slice(0, config.pousadasCount ?? POUSADAS_DATASET_EXPANDIDO.length);
  const personas = PERSONAS_MATRAIX_EXPANDIDO.slice(0, config.personasCount ?? PERSONAS_MATRAIX_EXPANDIDO.length);
  const diasSimulados = config.diasSimulados ?? 180; // 6 meses Set-Fev

  const leads: LeadRecord2[] = [];
  const reservas: ReservationRecord2[] = [];
  const personasQueReservaram = new Set<string>(); // para detectar recorrentes

  // Data inicial: 1 de setembro
  const dataInicial = new Date(2026, 8, 1); // 8 = setembro (mes 0-indexed)
  let leadCounter = 0;

  // Distribui leads por dia — 10.000 / 180 ≈ 56 leads/dia
  const leadsPorDia = Math.ceil(personas.length / diasSimulados);

  for (let dia = 0; dia < diasSimulados; dia++) {
    const dataAtual = new Date(dataInicial);
    dataAtual.setDate(dataInicial.getDate() + dia);
    const dataISO = dataAtual.toISOString();

    const leadsHoje = Math.min(leadsPorDia, personas.length - leadCounter);
    for (let i = 0; i < leadsHoje; i++) {
      if (leadCounter >= personas.length) break;

      const persona = personas[leadCounter];

      // Calcula demanda/yield para o dia
      const { multiplicador_demanda, yield_multiplier, feriado_proximo, temporada } =
        calcularDemandaYield(dataISO, pousadas[0]); // usa primeira pousada só pra detectar temporada

      // Persona escolhe pousada baseada em destino
      const pousadasCandidatas = pousadas.filter(p =>
        persona.destino_preferido.includes(p.estado) ||
        persona.destino_preferido.length === 0
      );
      const pousada = pousadasCandidatas.length > 0 ?
        pick(pousadasCandidatas, rng) :
        pick(pousadas, rng);

      // 5% das personas são hóspedes recorrentes (já reservaram antes)
      const isRecorrente = personasQueReservaram.has(persona.id) || (rng() < 0.05 && personasQueReservaram.size > 0);

      // Gera diálogo humanizado
      const { messages, emocao } = gerarDialogoHumanizado(persona, pousada, rng, isRecorrente);

      // Tempo de resposta IA
      const respostaIA = messages.find(m => m.sender === 'ia_pousada');
      const tempoRespostaSeg = respostaIA ?
        Math.floor((respostaIA.timestamp - messages[0].timestamp) / 1000) : null;

      // Decisão
      const ultimaMensagem = messages[messages.length - 1];
      const decidiuReservar = ultimaMensagem.intent === 'aceitar_reserva';

      // Probabilidades
      const responderProb = persona.prob_responder_whatsapp;
      const responder = rng() < responderProb;

      // Caução
      const caucaoPedida = pousada.caucaoHabilitada ? pousada.caucaoPadrao : 0;
      let caucaoAceita: boolean | undefined;
      if (caucaoPedida > 0 && decidiuReservar) {
        const aceitou = rng() < (1 - persona.cao_preocupacao_caucao * 0.6) && rng() < persona.prob_reservar_apos_contato;
        caucaoAceita = aceitou;
      } else if (!pousada.caucaoHabilitada) {
        caucaoAceita = undefined;
      }

      // Cotação com yield aplicado
      const valorCotacao = Math.round(pousada.diariaBase * yield_multiplier) * persona.duracao_estadia_dias * Math.ceil(persona.grupo_tamanho / 2);

      // Status
      let status: LeadRecord2['status'];
      let motivoAbandono: string | undefined;

      if (!responder) {
        status = 'abandonado';
        motivoAbandono = 'nao_respondeu';
      } else if (!decidiuReservar) {
        const msg = ultimaMensagem.content.toLowerCase();
        if (msg.includes('caro') || msg.includes('orçamento') || msg.includes('mais barato')) {
          status = 'abandonado';
          motivoAbandono = 'preco_alto';
        } else if (msg.includes('caução') || msg.includes('receosa') || msg.includes('caucao')) {
          status = 'caucao_recusada';
          motivoAbandono = 'caucao_recusada';
        } else if (msg.includes('check-in') || msg.includes('cedo')) {
          status = 'abandonado';
          motivoAbandono = 'checkin_inconveniente';
        } else {
          status = 'abandonado';
          motivoAbandono = 'outros';
        }
      } else if (caucaoPedida > 0 && caucaoAceita === false) {
        status = 'caucao_recusada';
        motivoAbandono = 'caucao_recusada';
      } else {
        status = 'reservado';
      }

      const lead: LeadRecord2 = {
        id: `LEAD${String(leadCounter + 1).padStart(6, '0')}`,
        pousada_id: pousada.id,
        persona_id: persona.id,
        timestamp: dataISO,
        canal: persona.canal_preferido,
        mensagem_inicial: messages[0].content,
        resposta_ia_tempo_seg: tempoRespostaSeg,
        status,
        motivo_abandono: motivoAbandono,
        mensagens: messages,
        cotação_valor: valorCotacao,
        caucao_pedida: caucaoPedida,
        caucao_aceita: caucaoAceita,
        emocao_detectada: emocao,
        is_hospede_recorrente: isRecorrente,
        temporada_dia: temporada,
        feriado_proximo: feriado_proximo || undefined,
        diaria_yieled_aplicada: Math.round(pousada.diariaBase * yield_multiplier),
        yield_multiplier,
      };

      leads.push(lead);

      // Se reservou, cria reservation
      if (status === 'reservado') {
        const reserva = simularReserva2(
          lead, persona, pousada, rng,
          yield_multiplier, feriado_proximo, temporada,
          comissaoZehlaRate,
        );
        if (reserva) {
          reservas.push(reserva);
          lead.reserva_id = reserva.id;
          personasQueReservaram.add(persona.id);
        }
      }

      leadCounter++;
    }
  }

  // Cálculo de métricas
  const metrics = calcularMetricas2(leads, reservas, pousadas, comissaoZehlaRate);

  // Amostra de 50 conversas
  const amostra = [...leads].sort(() => rng() - 0.5).slice(0, Math.min(50, leads.length));

  return {
    config,
    timestamp_inicio: t0,
    timestamp_fim: Date.now(),
    duracao_ms: Date.now() - t0,
    leads,
    reservas,
    metrics,
    amostra_conversas: amostra,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE MÉTRICAS
// ─────────────────────────────────────────────────────────────────────────────
function calcularMetricas2(
  leads: LeadRecord2[],
  reservas: ReservationRecord2[],
  pousadas: PousadaSimulada[],
  comissaoZehlaRate: number,
): SimulationMetrics2 {
  const totalLeads = leads.length;
  const totalReservas = reservas.length;
  const totalAbandonos = leads.filter(l => l.status === 'abandonado' || l.status === 'caucao_recusada').length;

  const taxaConversao = totalLeads > 0 ? totalReservas / totalLeads : 0;

  const leadsRespondidos = leads.filter(l => l.resposta_ia_tempo_seg !== null);
  const taxaRespostaIA = totalLeads > 0 ? leadsRespondidos.length / totalLeads : 0;
  const temposResposta = leadsRespondidos.map(l => l.resposta_ia_tempo_seg!);
  const tempoMedioRespostaMin = temposResposta.length > 0 ?
    (temposResposta.reduce((s, t) => s + t, 0) / temposResposta.length) / 60 : 0;

  const abandonosPreco = leads.filter(l => l.motivo_abandono === 'preco_alto').length;
  const abandonosCaucao = leads.filter(l => l.motivo_abandono === 'caucao_recusada').length;
  const abandonosCheckin = leads.filter(l => l.motivo_abandono === 'checkin_inconveniente').length;
  const abandonosOutros = totalAbandonos - abandonosPreco - abandonosCaucao - abandonosCheckin;

  const reservasComCaucao = reservas.filter(r => r.caucao_status !== 'disabled').length;
  const reservasSemCaucao = reservas.filter(r => r.caucao_status === 'disabled').length;
  const reservasCaucaoAceita = reservas.filter(r => r.caucao_pago).length;
  const reservasCaucaoRecusada = leads.filter(l => l.status === 'caucao_recusada').length;
  const taxaCaucaoAceita = reservasComCaucao + reservasCaucaoRecusada > 0 ?
    reservasCaucaoAceita / (reservasComCaucao + reservasCaucaoRecusada) : 0;

  const reservasComCheckoutEstendido = reservas.filter(r => r.checkout_estendido_horas > 0).length;
  const taxaCheckoutEstendido = totalReservas > 0 ? reservasComCheckoutEstendido / totalReservas : 0;

  const reservasComUpsell = reservas.filter(r => r.upsell_items.length > 0);
  const upsellReceitaTotal = reservas.reduce((s, r) => s + r.upsell_total, 0);
  // Comissão Zélla: 7% de cada upsell
  const comissaoZehlaTotal = reservas.reduce((s, r) => s + r.upsell_comissao_zehla, 0);

  const reservasComPinGerado = reservas.filter(r => r.pin_fechadura_gerado).length;

  const sinistrosTotal = reservas.filter(r => r.sinistro).length;
  const taxaSinistro = reservasComCaucao > 0 ? sinistrosTotal / reservasComCaucao : 0;

  const estornosAutomaticos = reservas.filter(r => r.caucao_status === 'returned').length;
  const estornosRetidos = reservas.filter(r => r.caucao_status === 'retained').length;

  const npsScores = reservas.map(r => r.nps_score);
  const npsMedio = npsScores.length > 0 ?
    npsScores.reduce((s, n) => s + n, 0) / npsScores.length : 0;
  const promotores = reservas.filter(r => r.nps_score >= 9).length;
  const neutros = reservas.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length;
  const detratores = reservas.filter(r => r.nps_score <= 6).length;
  const taxaRecomendacao = totalReservas > 0 ? reservas.filter(r => r.recommend).length / totalReservas : 0;

  const receitaTotalReservas = reservas.reduce((s, r) => s + r.valor_total, 0);
  const receitaTotalCaucao = reservas.reduce((s, r) => s + (r.caucao_pago ? r.caucao_valor : 0), 0);

  // Custo IA com 4 otimizações Zélla (-73.5%)
  const custoIAPorReserva = 0.06;
  const custoIATotal = leads.length * 0.06 + reservas.length * 0.04;
  const roiIA = custoIATotal > 0 ? (receitaTotalReservas - custoIATotal) / custoIATotal : 0;

  // Yield Booster: receita extra gerada pelas diárias dinâmicas
  const receitaYieldBoosterExtra = reservas.reduce((s, r) => {
    const receitaSemYield = r.diaria_base_original * r.qtd_diarias * Math.ceil(2 / 2); // approx
    return s + (r.valor_total - receitaSemYield * Math.ceil(1));
  }, 0);
  const yieldMedio = reservas.length > 0 ?
    reservas.reduce((s, r) => s + r.yield_multiplier, 0) / reservas.length : 1;

  // Hóspede recorrente
  const totalLeadsRecorrentes = leads.filter(l => l.is_hospede_recorrente).length;
  const taxaRecorrencia = totalLeads > 0 ? totalLeadsRecorrentes / totalLeads : 0;

  // Distribuições
  const leadsPorCanal = leads.reduce((acc, l) => {
    acc[l.canal] = (acc[l.canal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reservasPorTipoPousada = reservas.reduce((acc, r) => {
    const pousada = pousadas.find(p => p.id === r.pousada_id);
    if (pousada) {
      acc[pousada.tipo] = (acc[pousada.tipo] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const reservasPorTemporada: Record<string, number> = { alta: 0, 'média': 0, baixa: 0 };
  for (const r of reservas) {
    reservasPorTemporada[r.temporada] = (reservasPorTemporada[r.temporada] || 0) + 1;
  }

  const reservasPorEstado = reservas.reduce((acc, r) => {
    const pousada = pousadas.find(p => p.id === r.pousada_id);
    if (pousada) {
      acc[pousada.estado] = (acc[pousada.estado] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Reservas por estilo persona
  const reservasPorEstilo: Record<string, number> = {};
  // Reusa o índice das personas — vamos pegar do lead
  const personaMap = new Map<string, PersonaMatrAIx>();
  for (let i = 0; i < PERSONAS_MATRAIX_EXPANDIDO.length; i++) {
    personaMap.set(PERSONAS_MATRAIX_EXPANDIDO[i].id, PERSONAS_MATRAIX_EXPANDIDO[i]);
  }
  for (const lead of leads) {
    if (lead.status === 'reservado') {
      const persona = personaMap.get(lead.persona_id);
      if (persona) {
        reservasPorEstilo[persona.estilo_dialogo] = (reservasPorEstilo[persona.estilo_dialogo] || 0) + 1;
      }
    }
  }

  // Reservas por feriado
  const reservasPorFeriado: Record<string, number> = {};
  for (const r of reservas) {
    if (r.feriado) {
      reservasPorFeriado[r.feriado] = (reservasPorFeriado[r.feriado] || 0) + 1;
    }
  }

  // Emoções detectadas
  const emocoesDetectadas: Record<string, number> = {};
  for (const lead of leads) {
    if (lead.emocao_detectada) {
      emocoesDetectadas[lead.emocao_detectada.emocao] = (emocoesDetectadas[lead.emocao_detectada.emocao] || 0) + 1;
    }
  }

  // Comparativo Caução ON vs OFF
  const pousadasComCaucao = pousadas.filter(p => p.caucaoHabilitada);
  const pousadasSemCaucao = pousadas.filter(p => !p.caucaoHabilitada);

  const leadsComCaucao = leads.filter(l => pousadasComCaucao.some(p => p.id === l.pousada_id));
  const leadsSemCaucao = leads.filter(l => pousadasSemCaucao.some(p => p.id === l.pousada_id));
  const reservasComCaucaoList = reservas.filter(r => pousadasComCaucao.some(p => p.id === r.pousada_id));
  const reservasSemCaucaoList = reservas.filter(r => pousadasSemCaucao.some(p => p.id === r.pousada_id));

  const npsComCaucao = reservasComCaucaoList.length > 0 ?
    reservasComCaucaoList.reduce((s, r) => s + r.nps_score, 0) / reservasComCaucaoList.length : 0;
  const npsSemCaucao = reservasSemCaucaoList.length > 0 ?
    reservasSemCaucaoList.reduce((s, r) => s + r.nps_score, 0) / reservasSemCaucaoList.length : 0;

  const receitaComCaucao = reservasComCaucaoList.reduce((s, r) => s + r.valor_total, 0);
  const receitaSemCaucao = reservasSemCaucaoList.reduce((s, r) => s + r.valor_total, 0);

  // Comparativo Yield
  const receitaComYield = receitaTotalReservas;
  const receitaSemYieldTeorica = reservas.reduce((s, r) => {
    return s + r.diaria_base_original * r.qtd_diarias * Math.ceil(2 / 2);
  }, 0);
  const ganhoExtraYield = receitaComYield - receitaSemYieldTeorica;

  return {
    total_leads: totalLeads,
    total_reservas: totalReservas,
    total_abandonos: totalAbandonos,
    taxa_conversao: Number(taxaConversao.toFixed(4)),
    taxa_resposta_ia: Number(taxaRespostaIA.toFixed(4)),
    tempo_medio_resposta_ia_min: Number(tempoMedioRespostaMin.toFixed(1)),
    taxa_abandono_preco: Number(totalAbandonos > 0 ? abandonosPreco / totalAbandonos : 0),
    taxa_abandono_caucao: Number(totalAbandonos > 0 ? abandonosCaucao / totalAbandonos : 0),
    taxa_abandono_checkin: Number(totalAbandonos > 0 ? abandonosCheckin / totalAbandonos : 0),
    taxa_abandono_outros: Number(totalAbandonos > 0 ? abandonosOutros / totalAbandonos : 0),
    reservas_com_caucao: reservasComCaucao,
    reservas_sem_caucao: reservasSemCaucao,
    reservas_caucao_aceita: reservasCaucaoAceita,
    reservas_caucao_recusada: reservasCaucaoRecusada,
    taxa_caucao_aceita: Number(taxaCaucaoAceita.toFixed(4)),
    reservas_com_checkout_estendido: reservasComCheckoutEstendido,
    taxa_checkout_estendido: Number(taxaCheckoutEstendido.toFixed(4)),
    reservas_com_upsell: reservasComUpsell.length,
    upsell_receita_total: upsellReceitaTotal,
    comissao_zehla_total: comissaoZehlaTotal,
    reservas_com_pin_gerado: reservasComPinGerado,
    sinistros_total: sinistrosTotal,
    taxa_sinistro: Number(taxaSinistro.toFixed(4)),
    estornos_automaticos: estornosAutomaticos,
    estornos_retidos: estornosRetidos,
    nps_medio: Number(npsMedio.toFixed(2)),
    promotores,
    neutros,
    detratores,
    taxa_recomendacao: Number(taxaRecomendacao.toFixed(4)),
    receita_total_reservas: receitaTotalReservas,
    receita_total_caucao: receitaTotalCaucao,
    custo_ia_total: Number(custoIATotal.toFixed(2)),
    custo_ia_por_reserva: custoIAPorReserva,
    roi_ia: Number(roiIA.toFixed(2)),
    receita_yield_booster_extra: receitaYieldBoosterExtra,
    yield_medio: Number(yieldMedio.toFixed(2)),
    total_leads_recorrentes: totalLeadsRecorrentes,
    taxa_recorrencia: Number(taxaRecorrencia.toFixed(4)),
    leads_por_canal: leadsPorCanal,
    reservas_por_tipo_pousada: reservasPorTipoPousada,
    reservas_por_temporada: reservasPorTemporada,
    reservas_por_estado: reservasPorEstado,
    reservas_por_estilo_persona: reservasPorEstilo,
    reservas_por_feriado: reservasPorFeriado,
    emocoes_detectadas: emocoesDetectadas,
    comparativo_caucao: {
      com_caucao: {
        leads: leadsComCaucao.length,
        reservas: reservasComCaucaoList.length,
        taxa_conv: leadsComCaucao.length > 0 ? Number((reservasComCaucaoList.length / leadsComCaucao.length).toFixed(4)) : 0,
        nps: Number(npsComCaucao.toFixed(2)),
        receita: receitaComCaucao,
      },
      sem_caucao: {
        leads: leadsSemCaucao.length,
        reservas: reservasSemCaucaoList.length,
        taxa_conv: leadsSemCaucao.length > 0 ? Number((reservasSemCaucaoList.length / leadsSemCaucao.length).toFixed(4)) : 0,
        nps: Number(npsSemCaucao.toFixed(2)),
        receita: receitaSemCaucao,
      },
    },
    comparativo_yield: {
      receita_com_yield: receitaComYield,
      receita_sem_yield_teorica: receitaSemYieldTeorica,
      ganho_extra: ganhoExtraYield,
    },
  };
}
