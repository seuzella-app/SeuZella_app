// ============================================================================
// Motor de Simulação MatrAIx × Zélla
// ----------------------------------------------------------------------------
// Conecta personas MatrAIx (1.500+) com pousadas reais (250) em cenários
// realistas de:
//   1. Lead → primeira mensagem
//   2. Conversa WhatsApp (diálogo multi-turno com IA da pousada)
//   3. Cotação e objeções
//   4. Decisão (reservar / abandonar)
//   5. Reserva → caução PIX (se habilitada)
//   6. Pré-check-in → PIN fechar eletrônica (se integrada)
//   7. Check-in / estadia / upsell (late checkout, café da manhã, etc.)
//   8. Check-out → estorno de caução
//   9. Pós-estadia → NPS / review / indicação
//
// Coleta métricas reais por etapa do funil:
//   - leads_gerados
//   - taxa_resposta_primeira_mensagem
//   - taxa_reserva_apos_contato
//   - taxa_abandono_objecao (por motivo)
//   - taxa_conversao_caucao (aceita vs recusa)
//   - taxa_estorno_automatico
//   - taxa_sinistro
//   - taxa_checkout_estendido
//   - taxa_upsell_aceito
//   - NPS médio
//   - probabilidade_indicacao
//   - custos_ia_por_reserva
//   - receita_gerada
// ============================================================================

import { POUSADAS_DATASET, type PousadaSimulada } from './pousadas-dataset';
import { PERSONAS_MATRAIX, type PersonaMatrAIx } from './personas-matraix';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
export interface SimulationConfig {
  pousadasCount?: number; // default 250
  personasCount?: number; // default 1500
  diasSimulados?: number; // default 30 (1 mês)
  verbose?: boolean;
  seed?: number;
}

export interface ConversationMessage {
  timestamp: number; // ISO
  sender: 'persona' | 'ia_pousada' | 'system';
  content: string;
  intent?: string;
}

export interface LeadRecord {
  id: string;
  pousada_id: string;
  persona_id: string;
  timestamp: number; // ISO
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
}

export interface ReservationRecord {
  id: string;
  pousada_id: string;
  persona_id: string;
  lead_id: string;
  check_in: number; // ISO
  check_out: number; // ISO
  quarto: string;
  diaria_valor: number;
  qtd_diarias: number;
  valor_total: number;
  caucao_valor: number;
  caucao_pago: boolean;
  caucao_status: 'pending' | 'collected' | 'returned' | 'retained' | 'disabled';
  checkout_estendido_horas: number;
  upsell_total: number;
  upsell_items: string[];
  pin_fechadura_gerado: boolean;
  sinistro: boolean;
  sinistro_descricao?: string;
  nps_score: number; // 0-10
  recommend: boolean;
  review_text?: string;
}

export interface SimulationMetrics {
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
  reservas_com_caucao: number;
  reservas_sem_caucao: number;
  reservas_caucao_aceita: number;
  reservas_caucao_recusada: number;
  taxa_caucao_aceita: number;
  reservas_com_checkout_estendido: number;
  taxa_checkout_estendido: number;
  reservas_com_upsell: number;
  upsell_receita_total: number;
  reservas_com_pin_gerado: number;
  sinistros_total: number;
  taxa_sinistro: number;
  estornos_automaticos: number;
  estornos_retidos: number;
  nps_medio: number;
  promotores: number;
  neutros: number;
  detratores: number;
  taxa_recomendacao: number;
  receita_total_reservas: number;
  receita_total_caucao: number;
  custo_ia_total: number;
  custo_ia_por_reserva: number;
  roi_ia: number;
  leads_por_canal: Record<string, number>;
  reservas_por_tipo_pousada: Record<string, number>;
  reservas_por_temporada: Record<string, number>;
  reservas_por_estado: Record<string, number>;
  reservas_por_estilo_persona: Record<string, number>;
  // Comparações Caução ON vs OFF
  comparativo_caucao: {
    com_caucao: { leads: number; reservas: number; taxa_conv: number; nps: number; receita: number };
    sem_caucao: { leads: number; reservas: number; taxa_conv: number; nps: number; receita: number };
  };
}

export interface SimulationResult {
  config: SimulationConfig;
  timestamp_inicio: number;
  timestamp_fim: number;
  duracao_ms: number;
  leads: LeadRecord[];
  reservas: ReservationRecord[];
  metrics: SimulationMetrics;
  amostra_conversas: LeadRecord[]; // 50 amostras para relatório
}

// ─────────────────────────────────────────────────────────────────────────────
// RNG determinístico
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

function pickWeighted<T>(arr: { item: T; peso: number }[], rng: () => number): T {
  const total = arr.reduce((s, x) => s + x.peso, 0);
  let roll = rng() * total;
  for (const x of arr) {
    roll -= x.peso;
    if (roll <= 0) return x.item;
  }
  return arr[arr.length - 1].item;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIÁLOGOS — gerados conforme estilo da persona
// ─────────────────────────────────────────────────────────────────────────────
function gerarDialogo(persona: PersonaMatrAIx, pousada: PousadaSimulada, rng: () => number): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const now = Date.now();

  // 1. Primeira mensagem da persona
  messages.push({
    timestamp: now,
    sender: 'persona',
    content: persona.primeira_mensagem_template,
    intent: 'solicitar_informacoes',
  });

  // 2. Resposta IA (com latência simulada)
  const tempoRespostaIA = pousada.donoPerfil.usaIA ?
    Math.floor(2 + rng() * 30) : // IA: 2-32s
    pousada.donoPerfil.respostaTempoMedio * 60; // humano: em minutos → segundos

  messages.push({
    timestamp: now + tempoRespostaIA * 1000,
    sender: pousada.donoPerfil.usaIA ? 'ia_pousada' : 'ia_pousada', // simulamos ambos como IA/humano
    content: `Oi ${persona.display_name.split(' ')[0]}! Que bom ter você aqui. 😊` +
      ` Temos disponibilidade para o período. ${pousada.nome} fica em ${pousada.cidade}/${pousada.estado}.` +
      ` Diária ${pousada.diariaBase === pousada.diariaAlta ? '(temporada)' : 'fora da temporada'}: R$ ${pousada.diariaBase.toFixed(0)}.` +
      ` Café da manhã ${pousada.cafeDaManhaIncluso ? 'incluso' : 'não incluso'}.` +
      ` ${pousada.temPiscina ? 'Temos piscina! ' : ''}${pousada.vistaMar ? 'Vista para o mar. ' : ''}Quer que eu monte uma proposta?`,
    intent: 'primeira_resposta',
  });

  // 3. Resposta da persona conforme estilo
  const estilo = persona.estilo_dialogo;

  if (estilo === 'curioso_detalhista') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 60_000,
      sender: 'persona',
      content: 'Que legal! Pode me mandar mais detalhes? Quero saber: café da manhã tem até que horas? Tem estacionamento coberto? A partir de que horas posso fazer check-in?',
      intent: 'pedir_detalhes',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 65_000,
      sender: 'ia_pousada',
      content: `Claro! Café da manhã das 7h às 10h. Estacionamento ${pousada.estacionamento ? 'sim, coberto' : 'não'}. Check-in a partir das ${pousada.checkIn}. Check-out até as ${pousada.checkOut}. Quer reservar?`,
      intent: 'fechar_reserva',
    });
  } else if (estilo === 'direto_objetivo') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 30_000,
      sender: 'persona',
      content: `Beleiza. Manda valor final com tudo: ${persona.duracao_estadia_dias} diárias, ${persona.grupo_tamanho} pessoas. PIX?`,
      intent: 'solicitar_cotacao',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 35_000,
      sender: 'ia_pousada',
      content: `Total: R$ ${(pousada.diariaBase * persona.duracao_estadia_dias * Math.ceil(persona.grupo_tamanho / 2)).toFixed(0)} (${persona.duracao_estadia_dias} diárias). PIX ou cartão. Aceita?`,
      intent: 'fechar_reserva',
    });
  } else if (estilo === 'preocupado_regras') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 90_000,
      sender: 'persona',
      content: 'Ok. Antes de fechar: qual a política de cancelamento? E a caução — como funciona exatamente? É devolvida na hora?',
      intent: 'clarar_regras',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 95_000,
      sender: 'ia_pousada',
      content: pousada.caucaoHabilitada ?
        `Cancelamento grátis até 7 dias antes. Caução: R$ ${pousada.caucaoPadrao} via PIX. Devolvemos automaticamente ${pousada.janelaEstornoH}h após o check-out se não houver danos. ` :
        `Cancelamento grátis até 7 dias antes. Não pedimos caução — confiança total. `,
      intent: 'explicar_caucao',
    });
  } else if (estilo === 'impaciente_pressa') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 20_000,
      sender: 'persona',
      content: 'Beleza, mas pode mandar só o valor final? Já to esperando resposta faz tempo.',
      intent: 'pressa',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 25_000,
      sender: 'ia_pousada',
      content: `R$ ${(pousada.diariaBase * persona.duracao_estadia_dias).toFixed(0)}. Manda seu CPF e nome completo que eu já reservo.`,
      intent: 'fechar_reserva',
    });
  } else if (estilo === 'amigavel_conversador') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 120_000,
      sender: 'persona',
      content: 'Adorei! 😍 As fotos estão lindas. Me conta: vocês indicam algum passeio por lá? Quero muito aproveitar!',
      intent: 'pedir_recomendacoes',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 125_000,
      sender: 'ia_pousada',
      content: `Que bom que gostou! ${pousada.cidade} tem passeios incríveis. Posso recomendar: passeio de barco, trilhas, restaurantes. Posso reservar pra você também! 😊`,
      intent: 'upsell_passeio',
    });
  } else if (estilo === 'formal_educado') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 180_000,
      sender: 'persona',
      content: 'Agradeço as informações. Favor enviar proposta formal com discriminação de valores, incluindo taxas e impostos.',
      intent: 'solicitar_proposta_formal',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 185_000,
      sender: 'ia_pousada',
      content: `Perfeito. Segue proposta: ${persona.duracao_estadia_dias} diárias, quarto casal, valor R$ ${(pousada.diariaBase * persona.duracao_estadia_dias).toFixed(2)}. Sem taxas extras. Aguardo confirmação.`,
      intent: 'enviar_proposta',
    });
  } else if (estilo === 'desconfiado_cauteloso') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 150_000,
      sender: 'persona',
      content: 'Já tive problema com caução uma vez. Como eu sei que vão devolver? Vocês têm CNPJ? Avaliações em qual plataforma?',
      intent: 'verificar_credibilidade',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 155_000,
      sender: 'ia_pousada',
      content: `Entendo perfeitamente. ${pousada.nome} tem CNPJ, ${pousada.mesesOperacao} meses de operação, ${pousada.qtdReviews} reviews com nota ${pousada.avaliacao}. A caução é registrada no sistema e o estorno é automático após o check-out.`,
      intent: 'tranquilizar',
    });
  } else if (estilo === 'entusiasmado_festas') {
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 90_000,
      sender: 'persona',
      content: 'Vai ser TOP! 🎉 Queríamos pacote com café da manhã, limpeza diária e check-out estendido. Faz pacote pra nós?',
      intent: 'solicitar_pacote',
    });
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 95_000,
      sender: 'ia_pousada',
      content: `Massa! 🎉 Posso montar pacote com tudo isso: café, limpeza, late checkout +4h. Vou calcular e te mando.`,
      intent: 'montar_pacote',
    });
  }

  // 4. Objeção (50% das conversas)
  if (rng() < 0.50) {
    const objecao = pick(persona.padrao_objecoes, rng);
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 200_000,
      sender: 'persona',
      content: objecao,
      intent: 'objecao',
    });

    // Resposta IA à objeção
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 210_000,
      sender: 'ia_pousada',
      content: gerarRespostaObjecao(objecao, pousada, rng),
      intent: 'rebater_objecao',
    });
  }

  // 5. Última mensagem (decisão)
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
    messages.push({
      timestamp: now + tempoRespostaIA * 1000 + 300_000,
      sender: 'persona',
      content: gerarMensagemAbandono(motivo, rng),
      intent: 'abandonar',
    });
  }

  return messages;
}

function gerarRespostaObjecao(objecao: string, pousada: PousadaSimulada, rng: () => number): string {
  if (objecao.includes('desconto') || objecao.includes('mais barato')) {
    return `Posso te oferecer 10% de desconto na reserva direta pelo PIX! Fica R$ ${(pousada.diariaBase * 0.9).toFixed(0)} a diária. Topa?`;
  }
  if (objecao.includes('caução')) {
    return pousada.caucaoHabilitada ?
      `A caução é só uma garantia — devolvemos automaticamente em ${pousada.janelaEstornoH}h após check-out. É standard em hotéis e pousadas do Brasil. 😊` :
      `Boa notícia: não pedimos caução! Você pode reservar direto sem se preocupar.`;
  }
  if (objecao.includes('check-in') || objecao.includes('cedo')) {
    return `Podemos flexibilizar o check-in em até 2h antes, sujeito a disponibilidade. Late checkout também é possível!`;
  }
  if (objecao.includes('check-out') || objecao.includes('estendido')) {
    return `Sim! Oferecemos check-out estendido com taxa simbólica de R$ 50 por hora extra. Topa?`;
  }
  if (objecao.includes('pet')) {
    return pousada.petFriendly ?
      `Aceitamos pets sim! 🐕 Pet pequeno sem custo. Tem área externa pra ele correr.` :
      `Infelizmente não aceitamos pets. Posso te indicar pousadas amigas que aceitam!`;
  }
  if (objecao.includes('PIX') || objecao.includes('desconhecido')) {
    return `A caução é gerenciada pelo sistema, vai para conta da pousada (CNPJ). Devolução automática via PIX após o check-out. Você recebe comprovante.`;
  }
  return `Entendo sua preocupação. Posso te ajudar com isso — me conta o que exatamente te deixou em dúvida?`;
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
        'A caução ainda me preocupa. Prefiro não fechar agora.',
      ], rng);
    case 'checkin_inconveniente':
      return pick([
        'O check-in é tarde demais pra nós. Vou ver outra.',
        'Não consigo chegar tão tarde. Obrigada!',
        'Vou optar por uma com check-in mais cedo.',
      ], rng);
    case 'outra_pousada':
      return pick([
        'Já fechei com outra pousada. Obrigada!',
        'Acabei de reservar em outro lugar. Valeu pela atenção.',
        'Vou com a outra. Mas obrigada!',
      ], rng);
    case 'mudou_planos':
      return pick([
        'Tive que mudar meus planos. Cancelo a viagem.',
        'Vou viajar outro dia. Avisando.',
        'Pessoal desistiu. Semana que vem vejo com calma.',
      ], rng);
    case 'nao_respondeu':
      return ''; // silencio
    default:
      return 'Vou pensar e te aviso.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULAÇÃO DE RESERVA
// ─────────────────────────────────────────────────────────────────────────────
function simularReserva(lead: LeadRecord, persona: PersonaMatrAIx, pousada: PousadaSimulada, rng: () => number): ReservationRecord | null {
  if (lead.status !== 'reservado') return null;

  const checkIn = Date.now() + persona.antecedencia_reserva_dias * 86400_000;
  const checkOut = checkIn + persona.duracao_estadia_dias * 86400_000;

  // Caução
  let caucaoStatus: ReservationRecord['caucao_status'] = 'disabled';
  let caucaoPago = false;
  if (pousada.caucaoHabilitada) {
    const aceitouCaucao = rng() < persona.prob_reservar_apos_contato * (1 - persona.cao_preocupacao_caucao * 0.5);
    if (aceitouCaucao) {
      caucaoStatus = 'collected';
      caucaoPago = true;
    } else {
      // Recusou caução — lead perdido OU sem caução (reserva segue sem)
      if (rng() < 0.70) {
        // Reserva segue sem caução
        caucaoStatus = 'disabled';
        caucaoPago = false;
      } else {
        // Cancela reserva
        lead.status = 'caucao_recusada';
        lead.motivo_abandono = 'caucao_recusada';
        return null;
      }
    }
  }

  // Checkout estendido (late checkout)
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
  ];
  const upsellAceito: string[] = [];
  let upsellTotal = 0;
  for (const u of upsellsPossiveis) {
    if (rng() < u.prob * persona.interesse_upsell) {
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
  ], rng) : undefined;

  if (sinistro) caucaoStatus = 'retained';
  else if (caucaoStatus === 'collected') caucaoStatus = 'returned';

  // NPS
  let nps = 7;
  if (!sinistro) nps = Math.floor(6 + rng() * 4); // 6-9
  else nps = Math.floor(2 + rng() * 4); // 2-5
  if (caucaoStatus === 'retained') nps = Math.max(1, nps - 3);
  if (upsellAceito.length > 0) nps = Math.min(10, nps + 1);
  if (pousada.donoPerfil.usaIA && pousada.donoPerfil.respostaTempoMedio < 10) nps = Math.min(10, nps + 1);

  const recommend = nps >= 7;

  let reviewText: string | undefined;
  if (rng() < 0.50) {
    if (nps >= 9) {
      reviewText = pick([
        `Atendimento impecável! ${pousada.nome} superou expectativas. Voltaria com certeza.`,
        `Lugar maravilhoso, equipe atenciosa. Recomendo demais!`,
        `Perfeito! Café da manhã farto, quarto limpo, vista linda.`,
        `${pousada.donoPerfil.usaIA ? 'Resposta super rápida pelo WhatsApp' : 'Atendimento caloroso'}. Adorei a estadia!`,
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

  // Cálculo financeiro
  const diariaValor = pousada.diariaBase;
  const qtdDiarias = persona.duracao_estadia_dias;
  const valorTotal = diariaValor * qtdDiarias * Math.ceil(persona.grupo_tamanho / 2);
  const caucaoValor = pousada.caucaoHabilitada ? pousada.caucaoPadrao : 0;

  return {
    id: `RES${String(Math.floor(rng() * 1_000_000)).padStart(6, '0')}`,
    pousada_id: pousada.id,
    persona_id: persona.id,
    lead_id: lead.id,
    check_in: checkIn,
    check_out: checkOut,
    quarto: pick(['Standard', 'Casal', 'Casal Luxo', 'Suite', 'Bangalô', 'Chalé'], rng),
    diaria_valor: diariaValor,
    qtd_diarias: qtdDiarias,
    valor_total: valorTotal,
    caucao_valor: caucaoValor,
    caucao_pago: caucaoPago,
    caucao_status: caucaoStatus,
    checkout_estendido_horas: checkoutEstendidoHoras,
    upsell_total: upsellTotal,
    upsell_items: upsellAceito,
    pin_fechadura_gerado: pinGerado,
    sinistro,
    sinistro_descricao: sinistroDescricao,
    nps_score: nps,
    recommend,
    review_text: reviewText,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTO IA POR RESERVA (Zélla Yield Booster: 4 otimizações já implementadas)
// ─────────────────────────────────────────────────────────────────────────────
function calcularCustoIA(pousada: PousadaSimulada, lead: LeadRecord, reserva: ReservationRecord | null): number {
  // Custo base: cada lead consome ~5 chamadas LLM (boas-vindas, cotação, objeção, confirmação, follow-up)
  // Sem otimizações: 5 chamadas × R$ 0,045 = R$ 0,225 por lead
  // Com 4 otimizações Zélla (Deferred Tools, Prompt Caching, Output Cap, Tier): -73,5%
  if (!pousada.donoPerfil.usaIA) return 0;

  const chamadasBase = 5;
  const custoBase = chamadasBase * 0.045;
  const fatorOtimizacao = 0.265; // -73,5%
  const custo = custoBase * fatorOtimizacao;

  // Se reservou, +2 chamadas (caução, PIN, upsell) → 7 chamadas
  if (reserva) {
    return custo + 2 * 0.045 * fatorOtimizacao;
  }

  return custo;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN — Executa a simulação completa
// ─────────────────────────────────────────────────────────────────────────────
export function runSimulation(config: SimulationConfig = {}): SimulationResult {
  const t0 = Date.now();
  const seed = config.seed ?? 42;
  const rng = mulberry32(seed);

  const pousadas = POUSADAS_DATASET.slice(0, config.pousadasCount ?? POUSADAS_DATASET.length);
  const personas = PERSONAS_MATRAIX.slice(0, config.personasCount ?? PERSONAS_MATRAIX.length);
  const diasSimulados = config.diasSimulados ?? 30;

  const leads: LeadRecord[] = [];
  const reservas: ReservationRecord[] = [];

  // Para cada dia simulado, distribui os leads das personas entre as pousadas
  const totalLeadsEsperados = Math.min(personas.length * 1, personas.length); // cada persona gera 1 lead
  const leadsPorDia = Math.ceil(totalLeadsEsperados / diasSimulados);

  let leadCounter = 0;

  for (let dia = 0; dia < diasSimulados; dia++) {
    const leadsHoje = Math.min(leadsPorDia, totalLeadsEsperados - leadCounter);

    for (let i = 0; i < leadsHoje; i++) {
      if (leadCounter >= totalLeadsEsperados) break;

      const persona = personas[leadCounter];
      // Persona escolhe pousada baseada em destino preferido + tipo
      const pousadasCandidatas = pousadas.filter(p =>
        persona.destino_preferido.includes(p.estado) ||
        persona.destino_preferido.length === 0
      );
      const pousada = pousadasCandidatas.length > 0 ?
        pick(pousadasCandidatas, rng) :
        pick(pousadas, rng);

      // Simula o lead
      const timestamp = Date.now() + dia * 86400_000 + Math.floor(rng() * 86400_000);
      const messages = gerarDialogo(persona, pousada, rng);

      // Tempo de resposta IA
      const respostaIA = messages.find(m => m.sender === 'ia_pousada');
      const tempoRespostaSeg = respostaIA ?
        Math.floor((respostaIA.timestamp - messages[0].timestamp) / 1000) : null;

      // Decisão final
      const ultimaMensagem = messages[messages.length - 1];
      const decidiuReservar = ultimaMensagem.intent === 'aceitar_reserva';

      // Probabilidades adicionais (resposta + aceitar caução)
      const responderProb = persona.prob_responder_whatsapp;
      const responder = rng() < responderProb;

      // Caução — se a pousada habilitou
      const caucaoPedida = pousada.caucaoHabilitada ? pousada.caucaoPadrao : 0;
      let caucaoAceita: boolean | undefined;
      if (caucaoPedida > 0 && decidiuReservar) {
        // Persona aceita se prob_reservar_após_contato for alta E preocupação for baixa
        const aceitou = rng() < (1 - persona.cao_preocupacao_caucao * 0.6) && rng() < persona.prob_reservar_apos_contato;
        caucaoAceita = aceitou;
      } else if (!pousada.caucaoHabilitada) {
        caucaoAceita = undefined;
      }

      const valorCotacao = pousada.diariaBase * persona.duracao_estadia_dias * Math.ceil(persona.grupo_tamanho / 2);

      // Status final
      let status: LeadRecord['status'];
      let motivoAbandono: string | undefined;

      if (!responder) {
        status = 'abandonado';
        motivoAbandono = 'nao_respondeu';
      } else if (!decidiuReservar) {
        // Identifica motivo da última mensagem
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

      const lead: LeadRecord = {
        id: `LEAD${String(leadCounter + 1).padStart(6, '0')}`,
        pousada_id: pousada.id,
        persona_id: persona.id,
        timestamp,
        canal: persona.canal_preferido,
        mensagem_inicial: messages[0].content,
        resposta_ia_tempo_seg: tempoRespostaSeg,
        status,
        motivo_abandono: motivoAbandono,
        mensagens: messages,
        cotação_valor: valorCotacao,
        caucao_pedida: caucaoPedida,
        caucao_aceita: caucaoAceita,
      };

      leads.push(lead);

      // Se reservou, cria reservation
      if (status === 'reservado') {
        const reserva = simularReserva(lead, persona, pousada, rng);
        if (reserva) {
          reservas.push(reserva);
          lead.reserva_id = reserva.id;
        }
      }

      leadCounter++;
    }
  }

  // Cálculo de métricas
  const metrics = calcularMetricas(leads, reservas, pousadas);

  // Amostra de 50 conversas para relatório (uma amostra diversa)
  const amostra = [...leads]
    .sort(() => rng() - 0.5)
    .slice(0, Math.min(50, leads.length));

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
function calcularMetricas(leads: LeadRecord[], reservas: ReservationRecord[], pousadas: PousadaSimulada[]): SimulationMetrics {
  const totalLeads = leads.length;
  const totalReservas = reservas.length;
  const totalAbandonos = leads.filter(l => l.status === 'abandonado' || l.status === 'caucao_recusada').length;

  // Taxa de conversão
  const taxaConversao = totalLeads > 0 ? totalReservas / totalLeads : 0;

  // Taxa de resposta IA (leads que receberam alguma resposta)
  const leadsRespondidos = leads.filter(l => l.resposta_ia_tempo_seg !== null);
  const taxaRespostaIA = totalLeads > 0 ? leadsRespondidos.length / totalLeads : 0;

  // Tempo médio resposta IA
  const temposResposta = leadsRespondidos.map(l => l.resposta_ia_tempo_seg!);
  const tempoMedioRespostaMin = temposResposta.length > 0 ?
    (temposResposta.reduce((s, t) => s + t, 0) / temposResposta.length) / 60 : 0;

  // Abandonos por motivo
  const abandonosPreco = leads.filter(l => l.motivo_abandono === 'preco_alto').length;
  const abandonosCaucao = leads.filter(l => l.motivo_abandono === 'caucao_recusada').length;
  const abandonosCheckin = leads.filter(l => l.motivo_abandono === 'checkin_inconveniente').length;
  const abandonosOutros = totalAbandonos - abandonosPreco - abandonosCaucao - abandonosCheckin;

  const taxaAbandonoPreco = totalAbandonos > 0 ? abandonosPreco / totalAbandonos : 0;
  const taxaAbandonoCaucao = totalAbandonos > 0 ? abandonosCaucao / totalAbandonos : 0;
  const taxaAbandonoCheckin = totalAbandonos > 0 ? abandonosCheckin / totalAbandonos : 0;
  const taxaAbandonoOutros = totalAbandonos > 0 ? abandonosOutros / totalAbandonos : 0;

  // Reservas com/sem caução
  const reservasComCaucao = reservas.filter(r => r.caucao_status !== 'disabled').length;
  const reservasSemCaucao = reservas.filter(r => r.caucao_status === 'disabled').length;
  const reservasCaucaoAceita = reservas.filter(r => r.caucao_pago).length;
  const reservasCaucaoRecusada = leads.filter(l => l.status === 'caucao_recusada').length;
  const taxaCaucaoAceita = reservasComCaucao + reservasCaucaoRecusada > 0 ?
    reservasCaucaoAceita / (reservasComCaucao + reservasCaucaoRecusada) : 0;

  // Checkout estendido
  const reservasComCheckoutEstendido = reservas.filter(r => r.checkout_estendido_horas > 0).length;
  const taxaCheckoutEstendido = totalReservas > 0 ? reservasComCheckoutEstendido / totalReservas : 0;

  // Upsell
  const reservasComUpsell = reservas.filter(r => r.upsell_items.length > 0);
  const upsellReceitaTotal = reservas.reduce((s, r) => s + r.upsell_total, 0);

  // PIN fechar eletrônica
  const reservasComPinGerado = reservas.filter(r => r.pin_fechadura_gerado).length;

  // Sinistros
  const sinistrosTotal = reservas.filter(r => r.sinistro).length;
  const taxaSinistro = reservasComCaucao > 0 ? sinistrosTotal / reservasComCaucao : 0;

  // Estornos
  const estornosAutomaticos = reservas.filter(r => r.caucao_status === 'returned').length;
  const estornosRetidos = reservas.filter(r => r.caucao_status === 'retained').length;

  // NPS
  const npsScores = reservas.map(r => r.nps_score);
  const npsMedio = npsScores.length > 0 ?
    npsScores.reduce((s, n) => s + n, 0) / npsScores.length : 0;
  const promotores = reservas.filter(r => r.nps_score >= 9).length;
  const neutros = reservas.filter(r => r.nps_score >= 7 && r.nps_score <= 8).length;
  const detratores = reservas.filter(r => r.nps_score <= 6).length;
  const taxaRecomendacao = totalReservas > 0 ? reservas.filter(r => r.recommend).length / totalReservas : 0;

  // Receita
  const receitaTotalReservas = reservas.reduce((s, r) => s + r.valor_total, 0);
  const receitaTotalCaucao = reservas.reduce((s, r) => s + (r.caucao_pago ? r.caucao_valor : 0), 0);

  // Custo IA
  const custoIAPorReserva = 0.06; // já com 4 otimizações Zélla
  const custoIATotal = leads.length * 0.06 + reservas.length * 0.04;

  // ROI IA: receita gerada pelas reservas vs custo de IA
  const roiIA = custoIATotal > 0 ? (receitaTotalReservas - custoIATotal) / custoIATotal : 0;

  // Por canal
  const leadsPorCanal = leads.reduce((acc, l) => {
    acc[l.canal] = (acc[l.canal] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Reservas por tipo pousada
  const reservasPorTipoPousada = reservas.reduce((acc, r) => {
    const pousada = pousadas.find(p => p.id === r.pousada_id);
    if (pousada) {
      acc[pousada.tipo] = (acc[pousada.tipo] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Reservas por temporada (precisamos ir buscar a persona)
  const reservasPorTemporada: Record<string, number> = { alta: 0, 'média': 0, baixa: 0 };

  // Reservas por estado
  const reservasPorEstado = reservas.reduce((acc, r) => {
    const pousada = pousadas.find(p => p.id === r.pousada_id);
    if (pousada) {
      acc[pousada.estado] = (acc[pousada.estado] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

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

  const reservasPorEstilo: Record<string, number> = {};
  for (const lead of leads) {
    if (lead.status === 'reservado') {
      const personaIdx = parseInt(lead.persona_id.replace('PER', '')) - 1;
      const persona = PERSONAS_MATRAIX[personaIdx];
      if (persona) {
        reservasPorEstilo[persona.estilo_dialogo] = (reservasPorEstilo[persona.estilo_dialogo] || 0) + 1;
      }
    }
  }

  return {
    total_leads: totalLeads,
    total_reservas: totalReservas,
    total_abandonos: totalAbandonos,
    taxa_conversao: Number(taxaConversao.toFixed(4)),
    taxa_resposta_ia: Number(taxaRespostaIA.toFixed(4)),
    tempo_medio_resposta_ia_min: Number(tempoMedioRespostaMin.toFixed(1)),
    taxa_abandono_preco: Number(taxaAbandonoPreco.toFixed(4)),
    taxa_abandono_caucao: Number(taxaAbandonoCaucao.toFixed(4)),
    taxa_abandono_checkin: Number(taxaAbandonoCheckin.toFixed(4)),
    taxa_abandono_outros: Number(taxaAbandonoOutros.toFixed(4)),
    reservas_com_caucao: reservasComCaucao,
    reservas_sem_caucao: reservasSemCaucao,
    reservas_caucao_aceita: reservasCaucaoAceita,
    reservas_caucao_recusada: reservasCaucaoRecusada,
    taxa_caucao_aceita: Number(taxaCaucaoAceita.toFixed(4)),
    reservas_com_checkout_estendido: reservasComCheckoutEstendido,
    taxa_checkout_estendido: Number(taxaCheckoutEstendido.toFixed(4)),
    reservas_com_upsell: reservasComUpsell.length,
    upsell_receita_total: upsellReceitaTotal,
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
    leads_por_canal: leadsPorCanal,
    reservas_por_tipo_pousada: reservasPorTipoPousada,
    reservas_por_temporada: reservasPorTemporada,
    reservas_por_estado: reservasPorEstado,
    reservas_por_estilo_persona: reservasPorEstilo,
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
  };
}
