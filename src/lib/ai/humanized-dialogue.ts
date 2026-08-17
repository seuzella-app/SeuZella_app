// ============================================================================
// Motor de Diálogo Humanizado — Zélla / Zé
// ----------------------------------------------------------------------------
// Reformula totalmente a forma como a IA conversa com o hóspede:
//
//   1. Saudação variada (NUNCA mais "Olá, como é bom te ver por aqui")
//   2. Identidade: quando hóspede pergunta com quem fala → "Sou a Zélla,
//      pode me chamar de Zé" (introduz naturalmente a identidade)
//   3. Detecção de emoção nas primeiras 2-3 mensagens (entusiasmo, ansiedade,
//      pressa, desconfiança, curiosidade) e calibração do tom de resposta
//   4. Reconhecimento de hóspede recorrente (pós-reserva voltou a chamar):
//      não repetir saudação robotizada, tratar pelo nome, contexto de "já
//      estamos cuidando de tudo"
//   5. Máximo 1 emoji por mensagem, e só em ~30% das mensagens
//   6. Sem melodrama ("que alegria imensa", "que privilégio") — direto mas
//      caloroso, como um bom recepcionista brasileiro
//   7. Respostas curtas e objetivas em alguns estilos (impaciente, direto)
//   8. Respostas completas e detalhadas em outros (curioso, preocupado)
// ============================================================================

// ============================================================================
// Tipos de contexto de conversa — usados pelo motor humanizado
// ============================================================================

export interface HospedeContext {
  display_name: string;
  idade_anos?: number;
  genero?: string;
  cidade_origem?: string;
  estado_origem?: string;
  estilo_dialogo?: EstiloDialogo;
  prob_reservar_apos_contato?: number;
  cao_preocupacao_deposito?: number;
  interesse_checkout_estendido?: number;
  interesse_upsell?: number;
  interesse_fechadura_eletronica?: number;
  canal_preferido?: string;
  duracao_estadia_dias?: number;
  grupo_tamanho?: number;
  padrao_objecoes?: string[];
  primeira_mensagem_template?: string;
  isRecorrente?: boolean;
  reservaConfirmada?: boolean;
}

export type EstiloDialogo =
  | 'curioso_detalhista'
  | 'direto_objetivo'
  | 'preocupado_regras'
  | 'impaciente_pressa'
  | 'amigavel_conversador'
  | 'formal_educado'
  | 'desconfiado_cauteloso'
  | 'entusiasmado_festas'
  | 'neutro';

export interface PousadaContext {
  nome: string;
  cidade: string;
  estado: string;
  tipo?: 'simples' | 'standard' | 'boutique' | 'luxo';
  diariaBase: number;
  cafeDaManhaIncluso?: boolean;
  temPiscina?: boolean;
  vistaMar?: boolean;
  estacionamento?: boolean;
  checkIn?: string;
  checkOut?: string;
  petFriendly?: boolean;
  depositoHabilitada?: boolean;
  depositoPadrao?: number;
  janelaEstornoH?: number;
  mesesOperacao?: number;
  qtdReviews?: number;
  avaliacao?: number;
  donoPerfil?: {
    usaIA?: boolean;
    respostaTempoMedio?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECÇÃO DE EMOÇÃO — analisa primeira mensagem do hóspede
// ─────────────────────────────────────────────────────────────────────────────
export type EmocaoHospede =
  | 'entusiasmo'      // emojis, exclamações, "amei", "top", "vai ser massa"
  | 'ansiedade'       // muitas perguntas, "como funciona", "e se", "tenho medo"
  | 'pressa'          // "rápido", "urgente", "hoje", "agora", várias mensagens curtas
  | 'desconfianca'    // "é confiável?", "já ouvi histórias", "CNPJ?"
  | 'curiosidade'     // perguntas detalhadas sobre features, passeios, experiência
  | 'preocupacao_fin' // "caro", "orçamento", "fora do meu alcance"
  | 'calor'           // saudação amigável, "tudo bem", conversa fácil
  | 'neutro';

export interface EmocaoResult {
  emocao: EmocaoHospede;
  confianca: number; // 0-1
  intensidade: 'leve' | 'moderada' | 'forte';
}

export function detectarEmocao(mensagem: string): EmocaoResult {
  const msg = mensagem.toLowerCase();

  // Sinais de entusiasmo
  if (/(amei|adorei|amei|top|massa|demais|inc[rí]vel|fenomenal|!!+|😍|🥳|🎉|❤️|🔥| maravilhoso| perfeito|sonho)/i.test(msg)) {
    const intensidade = (msg.match(/!/g)?.length || 0) >= 3 ? 'forte' : 'moderada';
    return { emocao: 'entusiasmo', confianca: 0.85, intensidade };
  }

  // Sinais de ansiedade
  if (/(e se|tenho medo|preocupad|ficou sabido|garantia|seguro|seguranç|posso confiar)/i.test(msg)) {
    return { emocao: 'ansiedade', confianca: 0.80, intensidade: 'moderada' };
  }

  // Sinais de pressa
  if (/(urgente|hoje|agora|rápido|rapido|já|pressa|correndo|hoje mesmo|o mais rápido)/i.test(msg)) {
    return { emocao: 'pressa', confianca: 0.90, intensidade: 'forte' };
  }

  // Sinais de desconfiança
  if (/(confiá|confiavel|golpe|calote|cnpj|embratur|reclame aqu|reclameaqui|já ouvi histórias|problema com)/i.test(msg)) {
    return { emocao: 'desconfianca', confianca: 0.85, intensidade: 'moderada' };
  }

  // Sinais de curiosidade
  if (/(como funciona|me conta|me fala sobre|quero saber|pode explicar|diferencial|passeio|atraç|experiência|atividade)/i.test(msg)) {
    return { emocao: 'curiosidade', confianca: 0.75, intensidade: 'moderada' };
  }

  // Preocupação financeira
  if (/(caro|caríssimo|carissimo|orçamento|fora do meu|apertado|aperto|não tenho como|difícil pagar|difícil cobrir)/i.test(msg)) {
    return { emocao: 'preocupacao_fin', confianca: 0.80, intensidade: 'moderada' };
  }

  // Calor humano
  if (/(tudo bem|como vai|oi, tudo certo|bom dia|boa tarde|boa noite|como está|espero que esteja bem)/i.test(msg)) {
    return { emocao: 'calor', confianca: 0.70, intensidade: 'leve' };
  }

  return { emocao: 'neutro', confianca: 0.50, intensidade: 'leve' };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAUDAÇÕES VARIADAS — primeira resposta da IA
// ─────────────────────────────────────────────────────────────────────────────
const SAUDACOES_POR_ESTILO: Record<string, string[]> = {
  // Para personas calorosas / amigáveis
  amigavel_conversador: [
    'Oi {nome}! Como vai? Que bom que você chamou. Sou a Zélla, pode me chamar de Zé.',
    'Oi, {nome}! Tudo bem por aqui? Aqui é a Zélla — pode me chamar de Zé, viu?',
    'Olá, {nome}! Como posso te ajudar hoje? Aqui é a Zélla.',
    'Oi, {nome}! Como vai? Sou a Zélla, mas pode me chamar de Zé, fica à vontade.',
  ],
  // Para personas curiosas —开场 com pergunta sobre o que quer saber
  curioso_detalhista: [
    'Oi, {nome}! Como posso te ajudar? Sou a Zélla. Pode me chamar de Zé.',
    'Olá, {nome}! Tudo bem? Aqui é a Zélla. O que você quer saber sobre a pousada?',
    'Oi, {nome}! Que bom ter você aqui. Sou a Zélla. Me conta: o que você procura pra sua estadia?',
  ],
  // Para personas diretas — direto ao ponto
  direto_objetivo: [
    'Oi, {nome}. Aqui é a Zélla. Pode me chamar de Zé. O que você precisa?',
    'Olá, {nome}. Zélla aqui. Como posso ajudar?',
    'Oi, {nome}. Sou a Zélla. Manda aí o que você precisa.',
  ],
  // Para personas preocupadas com regras — tranquilizadora
  preocupado_regras: [
    'Oi, {nome}. Aqui é a Zélla, pode me chamar de Zé. Tudo bem? Pode perguntar o que quiser.',
    'Olá, {nome}. Zélla aqui. Fique à vontade pra tirar suas dúvidas — sem compromisso.',
    'Oi, {nome}. Sou a Zélla. Que bom que você perguntou antes de fechar. Como posso ajudar?',
  ],
  // Para personas com pressa — resposta curta
  impaciente_pressa: [
    'Oi, {nome}. Zélla aqui. Manda rápido o que precisa.',
    'Olá, {nome}. Aqui é a Zélla. Como posso ajudar, rápido?',
    'Oi, {nome}. Zélla. O que você precisa agora?',
  ],
  // Para personas formais — formal mas acessível
  formal_educado: [
    'Boa tarde, {nome}. Aqui é a Zélla. Como posso ajudá-lo(a) hoje?',
    'Olá, {nome}. Zélla, da pousada. Em que posso ser útil?',
    'Prezado(a) {nome}, aqui é a Zélla. Como posso ajudar?',
  ],
  // Para personas desconfiadas — constrói confiança
  desconfiado_cauteloso: [
    'Oi, {nome}. Aqui é a Zélla — pode me chamar de Zé. Pode perguntar o que quiser, vou ser transparente.',
    'Olá, {nome}. Zélla aqui. Entendo sua cautela — pode perguntar tudo, sem problema.',
    'Oi, {nome}. Sou a Zélla. Que bom que você verificou antes de fechar. Pode mandar.',
  ],
  // Para personas entusiasmadas — acompanha a energia mas sem exagero
  entusiasmado_festas: [
    'Oi, {nome}! Zélla aqui. Como vai? Que massa que vocês vão comemorar!',
    'Olá, {nome}! Aqui é a Zélla. Vai ser especial, né? Como posso ajudar a montar o pacote?',
    'Oi, {nome}! Zélla. Que data legal! Vou te ajudar a fechar tudo.',
  ],
};

const SAUDACOES_GENERICAS = [
  'Oi, {nome}. Aqui é a Zélla. Como posso te ajudar?',
  'Olá, {nome}. Zélla aqui. Como vai?',
  'Oi, {nome}! Sou a Zélla — pode me chamar de Zé. O que você procura?',
];

// ─────────────────────────────────────────────────────────────────────────────
// RESPOSTAS A "com quem estou falando?" / "quem é você?"
// ─────────────────────────────────────────────────────────────────────────────
const RESPOSTAS_IDENTIDADE = [
  'Sou a Zélla — pode me chamar de Zé, se preferir. Estou aqui pra te ajudar com a reserva.',
  'Aqui é a Zélla. Mas pode me chamar de Zé, fica mais fácil. Cuido da sua reserva do começo ao fim.',
  'Zélla. Mas todo mundo me chama de Zé — pode chamar também. O que você precisa?',
  'Sou a Zélla, da equipe da {pousada}. Pode me chamar de Zé. Em que posso ajudar?',
];

// ─────────────────────────────────────────────────────────────────────────────
// RECONHECIMENTO DE HÓSPEDE RECORRENTE (pós-reserva, voltou a chamar)
// ─────────────────────────────────────────────────────────────────────────────
const SAUDACOES_RECORRENTE = [
  'Oi, {nome}! Tudo certo por aqui? Você já tá com a reserva confirmada — algo que precise ajudar agora?',
  'Olá, {nome}! Como vai? Sua reserva tá em dia. Pode perguntar o que quiser.',
  'Oi, {nome}. Vi que você já reservou com a gente. Zélla aqui — pode me chamar de Zé. O que houve?',
  'Oi, {nome}. Tudo bem? Você já tá com a gente pra essa data. Posso te ajudar com mais alguma coisa?',
];

const RESPOSTAS_DUVIDAS_RECORRENTE = [
  'Claro, {nome}. Me fala o que aconteceu que eu te ajudo agora.',
  'Sem problema, {nome}. Pode me explicar o que tá precisando?',
  'Tranquilo, {nome}. Tô aqui pra te ajudar. Qual é a dúvida?',
  'Posso sim, {nome}. Me conta o que aconteceu.',
];

// ─────────────────────────────────────────────────────────────────────────────
// VARIAÇÕES DE FECHAMENTO — convite para reservar sem ser meloso
// ─────────────────────────────────────────────────────────────────────────────
const FECHAMENTOS = [
  'Quer que eu feche a reserva agora?',
  'Posso segurar o quarto pra você agora?',
  'Quer que eu monte a proposta final?',
  'Posso seguir com a reserva?',
  'Fechamos agora?',
  'Quer que eu reserve agora?',
  'Posso confirmar a reserva?',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function substituirPlaceholders(texto: string, nome: string, pousada?: PousadaContext): string {
  let result = texto.replace(/\{nome\}/g, nome);
  if (pousada) {
    result = result.replace(/\{pousada\}/g, pousada.nome);
    result = result.replace(/\{cidade\}/g, pousada.cidade);
    result = result.replace(/\{estado\}/g, pousada.estado);
  }
  return result;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Emojis permitidos (máx 1 por mensagem, em ~30% das mensagens)
const EMOJIS_PERMITIDOS = ['😊', '👍', '✨', '🌿', '📍', '💡'];

function talvezEmoji(rng: () => number, probabilidade: number = 0.30): string {
  if (rng() < probabilidade) {
    return ' ' + pick(EMOJIS_PERMITIDOS, rng);
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DE PRIMEIRA RESPOSTA HUMANIZADA
// ─────────────────────────────────────────────────────────────────────────────
export function gerarPrimeiraResposta(
  hospede: HospedeContext,
  pousada: PousadaContext,
  emocao: EmocaoResult,
  rng: () => number,
  isRecorrente: boolean = false,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];

  // Se é hóspede recorrente (pós-reserva, voltou a chamar), usa saudação de reconhecimento
  if (isRecorrente) {
    const saudacao = pick(SAUDACOES_RECORRENTE, rng);
    return {
      content: substituirPlaceholders(saudacao, nome, pousada),
      intent: 'saudacao_recorrente',
    };
  }

  // Saudação conforme estilo da persona
  const saudacoes = SAUDACOES_POR_ESTILO[hospede.estilo_dialogo] || SAUDACOES_GENERICAS;
  let saudacao = pick(saudacoes, rng);

  // Ajuste conforme emoção detectada
  if (emocao.emocao === 'pressa') {
    // Para pressa, corta a saudação — vai direto ao ponto
    return {
      content: `Oi, ${nome}. Zélla aqui. Manda o que você precisa.`,
      intent: 'primeira_resposta_pressa',
    };
  }
  if (emocao.emocao === 'desconfianca') {
    // Para desconfiança, reforça transparência
    return {
      content: substituirPlaceholders(
        pick([
          'Oi, {nome}. Aqui é a Zélla — pode me chamar de Zé. Pode perguntar tudo, vou ser transparente com você.',
          'Olá, {nome}. Zélla aqui. Que bom que você veio tirar suas dúvidas antes de fechar. Pode mandar.',
        ], rng),
        nome, pousada,
      ),
      intent: 'primeira_resposta_transparencia',
    };
  }
  if (emocao.emocao === 'entusiasmo' && emocao.intensidade === 'forte') {
    // Acompanha a energia, mas sem exagero
    return {
      content: substituirPlaceholders(
        pick([
          'Oi, {nome}! Zélla aqui. Que bom que você animou! Vou te ajudar a fechar tudo.',
          'Olá, {nome}! Aqui é a Zélla. Vai ser massa, né? Como posso ajudar?',
        ], rng),
        nome, pousada,
      ),
      intent: 'primeira_resposta_entusiasmo',
    };
  }

  // Default: saudação por estilo + info da pousada (sem emojis em excesso)
  let info = '';
  // Informações da pousada conforme relevância
  const partesInfo: string[] = [];
  partesInfo.push(`${pousada.nome} fica em ${pousada.cidade}/${pousada.estado}`);
  partesInfo.push(`diária R$ ${pousada.diariaBase.toFixed(0)}`);
  if (pousada.cafeDaManhaIncluso) partesInfo.push('café da manhã incluso');
  if (pousada.temPiscina) partesInfo.push('tem piscina');
  if (pousada.vistaMar) partesInfo.push('vista mar');

  // Combina de forma natural (não lista robotizada)
  info = partesInfo.join(' · ');

  // Convite final varia
  const fechamento = pick([
    'Quer que eu monte uma proposta?',
    'Quer que eu verifique disponibilidade?',
    'Quer que eu te mostre os quartos?',
    'Como posso te ajudar exatamente?',
  ], rng);

  // Emoji opcional (30% de chance)
  const emoji = talvezEmoji(rng, 0.20);

  return {
    content: `${substituirPlaceholders(saudacao, nome, pousada)} ${info}.${emoji} ${fechamento}`,
    intent: 'primeira_resposta',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPOSTA A "quem é você?" / "com quem falo?"
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRespostaIdentidade(
  hospede: HospedeContext,
  pousada: PousadaContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  const resposta = pick(RESPOSTAS_IDENTIDADE, rng);
  return {
    content: substituirPlaceholders(resposta, nome, pousada),
    intent: 'apresentar_identidade',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPOSTAS A OBJEÇÕES — humanizadas, sem robotização
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRespostaObjecaoHumanizada(
  objecao: string,
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  const obj = objecao.toLowerCase();

  // Preço / desconto
  if (obj.includes('desconto') || obj.includes('mais barato') || obj.includes('caro') || obj.includes('orçamento')) {
    // Yield Booster: desconto direto para PIX (10% off)
    const desconto = Math.round(pousada.diariaBase * 0.9);
    return {
      content: pick([
        `Posso te fazer 10% de desconto na reserva direta pelo PIX. Fica R$ ${desconto.toFixed(0)} a diária. Topa, ${nome}?`,
        `Entendo, ${nome}. Se fechar pelo PIX, consigo 10% off: R$ ${desconto.toFixed(0)} por diária. Fica melhor?`,
        `Olha, posso ajustar: 10% de desconto no PIX, fica R$ ${desconto.toFixed(0)} a diária. Melhor assim?`,
      ], rng),
      intent: 'rebater_preco',
    };
  }

  // Depósito
  if (obj.includes('deposit') || obj.includes('deposito') || obj.includes('depósito')) {
    if (pousada.depositoHabilitada) {
      return {
        content: pick([
          `A depósito é uma garantia comum em hotéis e pousadas, ${nome}. Devolvemos em ${pousada.janelaEstornoH}h após o check-out se não houver danos. É automático, você nem precisa pedir.`,
          `Entendo sua preocupação, ${nome}. A depósito fica registrada no sistema e o estorno é automático em ${pousada.janelaEstornoH}h após o check-out. Sem dor de cabeça.`,
          `${nome}, a depósito é só uma garantia — igual ao que hotel faz. Volta pra você em ${pousada.janelaEstornoH}h após o check-out, automaticamente.`,
        ], rng),
        intent: 'rebater_deposito',
      };
    } else {
      return {
        content: `Boa notícia, ${nome}: não pedimos depósito aqui. Você reserva direto, sem se preocupar.`,
        intent: 'rebater_deposito_desligada',
      };
    }
  }

  // Check-in
  if (obj.includes('check-in') || obj.includes('check in') || obj.includes('cedo')) {
    return {
      content: pick([
        `Podemos flexibilizar o check-in em até 2h antes, ${nome}. Depende da limpeza do dia. Posso confirmar na véspera.`,
        `Se o quarto estiver pronto, liberamos antes, ${nome}. Te aviso na véspera.`,
      ], rng),
      intent: 'rebater_checkin',
    };
  }

  // Check-out estendido / late checkout
  if (obj.includes('check-out') || obj.includes('checkout') || obj.includes('estendido') || obj.includes('tarde')) {
    return {
      content: pick([
        `Sim, ${nome}! Oferecemos late checkout com taxa de R$ 50 por hora extra. Topa?`,
        `Tem sim, ${nome}. Late checkout: R$ 50/hora extra. Fica mais confortado pra viajar.`,
      ], rng),
      intent: 'oferecer_late_checkout',
    };
  }

  // Pet
  if (obj.includes('pet') || obj.includes('cachorro') || obj.includes('gato') || obj.includes('animal')) {
    if (pousada.petFriendly) {
      return {
        content: pick([
          `Aceitamos pets sim, ${nome}! Pet pequeno sem custo. Tem área externa pra ele.`,
          `Pet é bem-vindo, ${nome}! Sem taxa pra pet pequeno.`,
        ], rng),
        intent: 'rebater_pet_ok',
      };
    } else {
      return {
        content: `Infelizmente não aceitamos pets, ${nome}. Posso te indicar pousadas amigas que aceitam, se quiser.`,
        intent: 'rebater_pet_nao',
      };
    }
  }

  // PIX / medo de desconhecido
  if (obj.includes('pix') && obj.includes('desconhec') || obj.includes('calote') || obj.includes('golpe')) {
    return {
      content: pick([
        `A depósito vai pra conta CNPJ da pousada, ${nome}. Devolução automática via PIX após o check-out. Você recebe comprovante.`,
        `${nome}, a operação é registrada no sistema. Tudo documentado, com estorno automático.`,
      ], rng),
      intent: 'rebater_confianca',
    };
  }

  // Reviews / credibilidade
  if (obj.includes('review') || obj.includes('avaliaç') || obj.includes('cnpj') || obj.includes('embratur')) {
    return {
      content: `Boa pergunta, ${nome}. A ${pousada.nome} tem CNPJ, está há ${pousada.mesesOperacao} meses em operação e tem ${pousada.qtdReviews} reviews com nota ${pousada.avaliacao}. Pode verificar.`,
      intent: 'rebater_credibilidade',
    };
  }

  // Default
  return {
    content: pick([
      `Entendo, ${nome}. Me conta o que exatamente te deixou em dúvida que eu te ajudo.`,
      `Sem problema, ${nome}. Pode explicar melhor o que você precisa?`,
      `Tô aqui pra ajudar, ${nome}. O que você quer saber?`,
    ], rng),
    intent: 'rebater_default',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA RESPOSTAS DE DETALHES (para personas curiosas/preocupadas)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRespostaDetalhes(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  return {
    content: `Claro, ${nome}! Café da manhã das 7h às 10h. ` +
      `Estacionamento ${pousada.estacionamento ? 'coberto, sim' : 'não temos'}. ` +
      `Check-in a partir das ${pousada.checkIn}, check-out até as ${pousada.checkOut}. ` +
      pick(['Quer reservar?', 'Fechamos agora?', 'Posso segurar o quarto?'], rng),
    intent: 'detalhes',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA COTAÇÃO DIRETA (para personas diretas/impacientes)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarCotacaoDireta(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  const total = pousada.diariaBase * hospede.duracao_estadia_dias * Math.ceil(hospede.grupo_tamanho / 2);
  return {
    content: pick([
      `Total: R$ ${total.toFixed(0)} (${hospede.duracao_estadia_dias} diárias, ${hospede.grupo_tamanho} pessoas). PIX ou cartão, ${nome}.`,
      `R$ ${total.toFixed(0)} no total, ${nome}. ${hospede.duracao_estadia_dias} diárias. Como prefere pagar?`,
      `${nome}, fica R$ ${total.toFixed(0)} (${hospede.duracao_estadia_dias} diárias). PIX ou cartão?`,
    ], rng),
    intent: 'cotacao_direta',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA EXPLICAÇÃO DE CAUÇÃO (para personas preocupadas)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarExplicacaoDeposito(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  if (pousada.depositoHabilitada) {
    return {
      content: pick([
        `Cancelamento grátis até 7 dias antes, ${nome}. Depósito: R$ ${pousada.depositoPadrao} via PIX. Devolvo em ${pousada.janelaEstornoH}h após o check-out se não houver danos. Automático.`,
        `Política de cancelamento: 7 dias antes sem custo. Depósito R$ ${pousada.depositoPadrao} — volta em ${pousada.janelaEstornoH}h após o check-out. Sem dor de cabeça, ${nome}.`,
      ], rng),
      intent: 'explicar_deposito',
    };
  }
  return {
    content: `Cancelamento grátis até 7 dias antes, ${nome}. Não pedimos depósito aqui — confiança total.`,
    intent: 'sem_deposito',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA PROPOSTA FORMAL (para personas formais)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarPropostaFormal(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  const total = pousada.diariaBase * hospede.duracao_estadia_dias * Math.ceil(hospede.grupo_tamanho / 2);
  return {
    content: `Perfeito, ${nome}. Segue proposta: ${hospede.duracao_estadia_dias} diárias, ` +
      `quarto casal, valor R$ ${total.toFixed(2)}. Sem taxas extras. ` +
      `Aguardo confirmação.`,
    intent: 'enviar_proposta',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA RESPOSTA A PEDIDO DE RECOMENDAÇÕES (passeios, restaurantes)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRespostaRecomendacoes(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  const recomendacoes = {
    SC: ['passeio de barco pela Costa Verde & Mar', 'trilha até a Praia do Rosa', 'mercado de ostras da Ribeirão'],
    SP: ['passeio de escunaia em Ilhabela', 'trilha do Camburi', 'Cachoeira da Praia Vermelha'],
    RJ: ['passeio de barco em Arraial do Cabo', 'Cabo Frio histórico', 'trilha do Pontal do Atalaia'],
    BA: ['passeio às praias de Itacaré', 'Rafting no Rio Contas', 'tour gastronômico em Trancoso'],
    PE: ['passeio de jangada em Porto de Galinhas', 'Muro Alto', 'passeio de bugue em Maracaípe'],
    CE: ['passeio de bugue em Jericoacoara', 'Pedra Furada', 'lagoa do Paraíso'],
  };
  const recs = recomendacoes[pousada.estado as keyof typeof recomendacoes] || ['passeios locais'];
  return {
    content: pick([
      `Que bom que perguntou, ${nome}! Posso recomendar: ${recs[0]}, ${recs[1] || 'trilhas'} e ${recs[2] || 'restaurantes locais'}. Posso reservar pra você também.`,
      `Tem muita coisa legal em ${pousada.cidade}, ${nome}: ${recs[0]}, ${recs[1] || 'passeios'}... Me diz o que curte que eu te indico.`,
    ], rng),
    intent: 'recomendar_passeios',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA PACOTE FESTA (para personas entusiasmadas)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarRespostaPacote(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  return {
    content: pick([
      `Massa, ${nome}! Posso montar pacote com café da manhã, limpeza diária e late checkout +4h. Calculo e te mando.`,
      `Boa, ${nome}! Pacote: café, limpeza, late checkout +4h. Em instantes te passo o valor.`,
    ], rng),
    intent: 'montar_pacote',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA TRANQUILIZAÇÃO (para personas desconfiadas)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarTranquilizacao(
  pousada: PousadaContext,
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  return {
    content: `Entendo perfeitamente, ${nome}. A ${pousada.nome} tem CNPJ, ` +
      `${pousada.mesesOperacao} meses de operação, ${pousada.qtdReviews} reviews com nota ${pousada.avaliacao}. ` +
      `A depósito é registrada no sistema e o estorno é automático após o check-out.`,
    intent: 'tranquilizar',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERA FECHAMENTO (convite final para reservar)
// ─────────────────────────────────────────────────────────────────────────────
export function gerarFechamento(
  hospede: HospedeContext,
  rng: () => number,
): { content: string; intent: string } {
  const nome = hospede.display_name.split(' ')[0];
  return {
    content: pick([
      `Quer que eu feche a reserva agora, ${nome}?`,
      `Posso segurar o quarto pra você, ${nome}?`,
      `Fechamos agora, ${nome}?`,
    ], rng),
    intent: 'fechar_reserva',
  };
}
