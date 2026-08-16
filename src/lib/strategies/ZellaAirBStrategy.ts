// =============================================================================
// ZELLA AIRB STRATEGY — Prova de Conceito Isolada
// =============================================================================
//
// ARQUITETURA: Strategy Pattern aplicado ao "Brain" do Zélla
//
// Este arquivo demonstra como o Zélla AirB teria seu PRÓPRIO cérebro
// (prompts, intenções, tools, tom de voz) enquanto COMPARTILHA toda a
// infraestrutura (webhook, segurança, LLM router, banco, plan features).
//
// ⚠️  NENHUM arquivo existente do Zélla Pousada é modificado.
// ⚠️  Este é um arquivo ISOLADO para validação do conceito.
//
// COMPARAÇÃO COM O CÓDIGO EXISTENTE:
//
//   Zélla Pousada (whatsapp-ai-responder.ts:363-364):
//     "Você é a ZÉLLA, uma assistente virtual de inteligência artificial
//      ultra-atenciosa e hospitaleira da pousada X.
//      Seu objetivo é sanar dúvidas, encantar o hóspede, sugerir acomodações
//      e incentivar a reserva direta..."
//
//   Zélla AirB (este arquivo):
//     "Você é o anfitrião do [imóvel]. Sabe cada detalhe — onde fica a chave,
//      como funciona o ar, qual a melhor padaria da rua.
//      O hóspede já reservou. Seu papel é fazer ele se sentir em casa."
//
// =============================================================================

// ── 1. TIPOS FUNDAMENTAIS ──────────────────────────────────────────────────────

/**
 * O "modo" do tenant — define qual Strategy o orquestrador usa.
 *
 * No código atual, Property.type suporta: pousada|hotel|hostel|chalé|resort
 * Para o AirB, precisamos adicionar: apartamento|casa|studio|loft
 *
 * Mas MAIS IMPORTANTE que o tipo de imóvel é o MODO DE OPERAÇÃO:
 * - "pousada" = Zélla Pousada (secretária vendedora)
 * - "airbnb"  = Zélla AirB (anfitrião que sabe tudo)
 */
export type OperatingMode = 'pousada' | 'airbnb';

/**
 * Metadados do imóvel Airbnb — informações que o anfitrião conhece profundamente.
 *
 * No código atual (Property model):
 *   - NÃO tem airbnbListingId
 *   - NÃO tem latitude/longitude
 *   - NÃO tem checkInInstructions
 *   - NÃO tem houseRules
 *   - NÃO tem lockProvider (fechadura inteligente)
 *
 * ESTE tipo define o que o Zélla AirB PRECISARIA extrair do imóvel.
 */
export interface AirbnbPropertyContext {
  // Identificação
  id: string;
  name: string;                     // "Apartamento Vista Mar"
  airbnbListingId?: string;         // ID do anúncio no Airbnb
  type: 'apartamento' | 'casa' | 'studio' | 'loft' | 'chalé' | 'outro';

  // Localização (campos que Property JÁ TEM parcialmente)
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;

  // Instruções de acesso (NOVO — Property NÃO tem)
  checkInInstructions: string;      // "A chave está no lockbox código 4521"
  lockProvider?: 'lockbox' | 'smart_lock' | 'key_handoff' | 'building_staff';
  lockCode?: string;                // "4521" (se lockbox) ou código da fechadura
  wifiNetwork: string;              // "CasaVistaMar_5G"
  wifiPassword: string;             // "praia2024"
  parkingInstructions?: string;     // "Vaga 14 na garagem do prédio"

  // Regras da casa (NOVO — Property NÃO tem)
  houseRules: string[];             // ["Sem festas", "Sem fumar", "Pet permitido até 10kg"]
  quietHoursStart?: string;         // "22:00"
  quietHoursEnd?: string;           // "08:00"
  maxGuests: number;                // 4
  allowsPets: boolean;
  allowsSmoking: boolean;
  allowsParties: boolean;

  // Conhecimento do anfitrião sobre o imóvel (NOVO — o diferencial)
  hostKnowledge: HostKnowledgeEntry[];

  // Dicas do bairro (NOVO — Property NÃO tem)
  neighborhoodTips: NeighborhoodTip[];

  // Equipamentos e como usar (NOVO)
  equipment: EquipmentEntry[];

  // Emergência (NOVO)
  emergencyContacts: EmergencyContact[];
  nearestHospital?: string;
  nearestPharmacy?: string;
}

/**
 * Conhecimento que só o dono do imóvel tem.
 * Exemplo: "A torneira da cozinha demora 30s pra esquentar — é normal"
 *          "O ar do quarto tem que ligar no modo cool, não auto"
 *          "A porta da varanda emperra — empurra pra cima enquanto gira a maçaneta"
 */
export interface HostKnowledgeEntry {
  id: string;
  category: 'quirk' | 'tip' | 'warning' | 'how_to';
  title: string;                    // "Torneira da cozinha"
  description: string;              // "Demora 30s pra esquentar, é normal!"
  isImportant: boolean;             // true = incluir no check-in message
}

/**
 * Dica do bairro que só quem mora ali conhece.
 * Exemplo: "A padaria da esquina tem pão fresco às 6h"
 *          "O restaurante do Seu João entrega até 22h — 11999990000"
 *          "Não estacione na rua de trás — é zona azul"
 */
export interface NeighborhoodTip {
  id: string;
  category: 'food' | 'transport' | 'leisure' | 'warning' | 'service' | 'shopping';
  name: string;                     // "Padaria da Esquina"
  description: string;              // "Pão fresco às 6h, melhor da rua"
  distance?: string;                // "2 min a pé"
  phone?: string;
  hours?: string;                   // "5h-20h"
}

/**
 * Equipamento do imóvel com instruções de uso.
 * Exemplo: "Ar-condicionado — Ligar no modo Cool, 23°C. Controle na gaveta da mesa"
 */
export interface EquipmentEntry {
  id: string;
  name: string;                     // "Ar-condicionado do quarto"
  location: string;                 // "Quarto principal"
  instructions: string;             // "Ligar no modo Cool, 23°C"
  whereIsRemote?: string;           // "Controle na gaveta da mesa de cabeceira"
  troubleshooting?: string;         // "Se não ligar, verificar disjuntor na caixa do corredor"
}

/**
 * Contato de emergência.
 */
export interface EmergencyContact {
  name: string;                     // "Síndico — Carlos"
  phone: string;
  role: string;                     // "Síndico do prédio"
  availableHours?: string;          // "8h-18h"
}


// ── 2. INTENÇÕES DO ZÉLLA AIRB ────────────────────────────────────────────────

/**
 * Set de intenções do Zélla AirB — COMPLETAMENTE diferente do Zélla Pousada.
 *
 * Comparação:
 *   Zélla Pousada (brain/intent-classifier.ts):
 *     RESERVATION_CREATE, RESERVATION_MODIFY, RESERVATION_CANCEL,
 *     ROOM_AVAILABILITY, PRICE_INQUIRY, CHECK_IN, CHECK_OUT,
 *     HOUSEKEEPING_REQUEST, AMENITIES_INQUIRY, LOCAL_INFO,
 *     PAYMENT_STATUS, CANCELATION_POLICY, GREETING, FAREWELL,
 *     SUPPLIER_INQUIRY, UNKNOWN
 *
 *   Zélla Pousada (ai/intent-router.ts):
 *     cotacao_reserva, reserva_direta, suporte_tecnico, info_geral,
 *     checkin_checkout, cancelamento, agradecimento, desconhecido,
 *     human_handover, duvida_geral
 *
 *   Zélla AirB (este arquivo):
 *     CHECK_IN_GUIDE, SELF_CHECK_IN, HOUSE_RULES, WIFI_INFO,
 *     EQUIPMENT_HELP, NEIGHBORHOOD_TIPS, PARKING_INFO, EMERGENCY,
 *     HOST_GREETING, HOST_FAREWELL, EXTEND_STAY, CLEANING_REQUEST,
 *     MAINTENANCE_ISSUE, LOCAL_RECOMMENDATION, UNKNOWN, HUMAN_HANDOVER
 */
export type AirBIntent =
  | 'CHECK_IN_GUIDE'           // "Como faço check-in?"
  | 'SELF_CHECK_IN'            // "Qual o código do lockbox?"
  | 'HOUSE_RULES'              // "Posso ter visita? Posso fumar?"
  | 'WIFI_INFO'                // "Qual a senha do wifi?"
  | 'EQUIPMENT_HELP'           // "Como liga o ar? Onde fica o ferro?"
  | 'NEIGHBORHOOD_TIPS'        // "Tem padaria perto? Onde comer?"
  | 'PARKING_INFO'             // "Onde estaciono?"
  | 'EMERGENCY'                // "Vazou água! / Perdi a chave!"
  | 'HOST_GREETING'            // Primeiro contato — boas-vindas do anfitrião
  | 'HOST_FAREWELL'            // "Obrigado pela estadia!"
  | 'EXTEND_STAY'              // "Posso ficar mais um dia?"
  | 'CLEANING_REQUEST'         // "Preciso de limpeza / toalhas extras"
  | 'MAINTENANCE_ISSUE'        // "Chuveiro não funciona / ar quebrou"
  | 'LOCAL_RECOMMENDATION'     // "O que fazer por aqui? Praia? Passeio?"
  | 'HUMAN_HANDOVER'           // Precisa do anfitrião real
  | 'UNKNOWN';

/**
 * Labels para exibição (como no intent-router.ts:296-308)
 */
export const AIRB_INTENT_LABELS: Record<AirBIntent, string> = {
  CHECK_IN_GUIDE:          '🔑 Guia de Check-in',
  SELF_CHECK_IN:           '🔢 Self Check-in',
  HOUSE_RULES:             '📜 Regras da Casa',
  WIFI_INFO:               '📶 Informações WiFi',
  EQUIPMENT_HELP:          '🔧 Ajuda com Equipamento',
  NEIGHBORHOOD_TIPS:       '🗺️ Dicas do Bairro',
  PARKING_INFO:            '🅿️ Estacionamento',
  EMERGENCY:               '🚨 Emergência',
  HOST_GREETING:           '👋 Boas-vindas do Anfitrião',
  HOST_FAREWELL:           '👋 Despedida',
  EXTEND_STAY:             '📅 Estender Estadia',
  CLEANING_REQUEST:        '🧹 Limpeza/Toalhas',
  MAINTENANCE_ISSUE:       '🔩 Problema Manutenção',
  LOCAL_RECOMMENDATION:    '⭐ Recomendação Local',
  HUMAN_HANDOVER:          '👤 Transferir p/ Anfitrião',
  UNKNOWN:                 '❓ Desconhecido',
};


// ── 3. CLASSIFICAÇÃO DE INTENÇÃO (Heurísticas + LLM) ──────────────────────────

/**
 * Padrões heurísticos para classificação rápida de intenções AirB.
 *
 * Inspirado no ai/intent-router.ts (linhas 55-110) que usa regex patterns,
 * mas TOTALMENTE adaptado para o contexto de hóspede Airbnb.
 */
// ORDEM IMPORTA! Intenções mais específicas devem vir ANTES das genéricas.
// Ex: "Qual a senha do wifi?" → WIFI_INFO (não SELF_CHECK_IN, embora tenha "senha")
// Ex: "O chuveiro não esquenta" → MAINTENANCE_ISSUE (não EQUIPMENT_HELP)
// Ex: "Posso ficar mais um dia?" → EXTEND_STAY (não HOUSE_RULES, embora tenha "posso")
const AIRB_INTENT_PATTERNS: Array<{
  intent: AirBIntent;
  patterns: Array<{ regex: RegExp; confidence: number }>;
}> = [
  // ── PRIORIDADE ALTA: Segurança primeiro ──
  {
    intent: 'EMERGENCY',
    patterns: [
      { regex: /\b(emergencia|emergência|vazou|vazamento|incendio|incêndio|fogo|trancado|perdi a chave|sem luz|sem agua|sem água)\b/i, confidence: 0.95 },
      { regex: /\b(socorro|urgente|perigo)\b/i, confidence: 0.97 },
    ],
  },
  {
    intent: 'HUMAN_HANDOVER',
    patterns: [
      { regex: /\b(quero falar (com|para) (o|um) (dono|anfitriao|anfitrião|proprietario|proprietário|humano|pessoa|responsavel|responsável))\b/i, confidence: 0.95 },
      { regex: /\b(advogado|processo|procon|reclame|denuncia|denúncia)\b/i, confidence: 0.92 },
    ],
  },

  // ── PRIORIDADE MÉDIA-ALTA: Intenções com palavras-chave muito específicas ──

  // WiFi ANTES de Self Check-in ("senha do wifi" vs "código do lockbox")
  {
    intent: 'WIFI_INFO',
    patterns: [
      { regex: /\b(wifi|wi[\s-]?fi|internet)\b/i, confidence: 0.95 },
      { regex: /\b(senha (do|da) (wifi|internet|rede))\b/i, confidence: 0.97 },
      { regex: /\b(nao (consigo|to) (conectar|acessar|entrar) (no|na) (wifi|internet|rede))\b/i, confidence: 0.92 },
    ],
  },

  // Limpeza ANTES de House Rules ("toalhas" é específico)
  {
    intent: 'CLEANING_REQUEST',
    patterns: [
      { regex: /\b(toalha[s]?|limpez[a]|lençol|lencol|sabonete|papel higienico|cobertor|travesseiro[s]? extra)\b/i, confidence: 0.93 },
      { regex: /\b(preciso (de|mais)|trocar|repor) .* \b(toalha|lençol|cobertor|sabonete|papel|limpez)\b/i, confidence: 0.94 },
    ],
  },

  // Estender estadia ANTES de House Rules ("ficar mais" vs "posso fumar")
  {
    intent: 'EXTEND_STAY',
    patterns: [
      { regex: /\b(estender|ficar (mais|outro)|prolongar|adiantar|checkout tarde|late checkout|mais (uma|1) (noite|diaria|dia))\b/i, confidence: 0.92 },
      { regex: /\b(posso (ficar|estender|pernoitar|permanecer) (mais|outro|at[eé]))\b/i, confidence: 0.93 },
    ],
  },

  // Manutenção ANTES de Equipment Help ("não funciona" = problema, não ajuda)
  {
    intent: 'MAINTENANCE_ISSUE',
    patterns: [
      { regex: /\b(n[aã]o (funciona|liga|esquenta|gela|pega|aciona)|quebrad[oa]|defeito|estravad[oa])\b/i, confidence: 0.93 },
      { regex: /\b((chuveiro|ar|tv|luz|tomada|janela|porta|torneira|descarga|vaso|fog[aã]o|microondas|m[aá]quina) (nao|n[aã]o) (funciona|liga|esquenta|gela|pega))\b/i, confidence: 0.95 },
      { regex: /\b((est[aá]|t[aá]) (quebrad|estravad|entupid|fend|gotejando|pingando))\b/i, confidence: 0.90 },
    ],
  },

  // Estacionamento (padrão específico)
  {
    intent: 'PARKING_INFO',
    patterns: [
      { regex: /\b(estacionamento|estacionar|estaciono|vaga|garagem|parking)\b/i, confidence: 0.92 },
      { regex: /\b(onde (estaciono|paro|deixo) (o |meu )?(carro|ve[ií]culo)?)\b/i, confidence: 0.94 },
    ],
  },

  // ── PRIORIDADE MÉDIA: Intenções gerais ──

  // Self Check-in (SEM a palavra "senha" genérica — WiFi já captura)
  {
    intent: 'SELF_CHECK_IN',
    patterns: [
      { regex: /\b(lockbox|fechadura|como (entro|acesso|abrir a porta))\b/i, confidence: 0.94 },
      { regex: /\b(c[oó]digo (do|da) (lockbox|porta|chave|acesso))\b/i, confidence: 0.95 },
      { regex: /\b(chequei|cheguei|to (na|no) (local|imovel|im[oó]vel|apartamento|casa|predio|pr[eé]dio))\b/i, confidence: 0.85 },
      { regex: /\b(nao (consigo|consegui|to conseguindo) (entrar|abrir|achar))\b/i, confidence: 0.90 },
    ],
  },

  // House Rules (SEM capturar "posso ficar mais" ou "toalhas")
  {
    intent: 'HOUSE_RULES',
    patterns: [
      { regex: /\b(regra[s]?|permitido|proibido|pode (fumar|ter visita|fazer festa|levar pet|cachorro|gato|animal))\b/i, confidence: 0.90 },
      { regex: /\b(posso (fumar|levar pet|ter (visita|convidado|h[oó]spede|amigo)|fazer festa|usar a churrasqueira))\b/i, confidence: 0.92 },
      { regex: /\b(visita|festa|barulho|fumar|pet|cachorro|gato)\b/i, confidence: 0.80 },
    ],
  },

  // Equipment Help (SEM capturar "não funciona" — isso é manutenção)
  {
    intent: 'EQUIPMENT_HELP',
    patterns: [
      { regex: /\b(como (liga|funciona|usa|aciona|oper))\b/i, confidence: 0.90 },
      { regex: /\b(onde (fica|est[aá]|[eé]h) (o|a) (ferro|secador|controle|m[aá]quina|aspirador|extens[aã]o))\b/i, confidence: 0.88 },
    ],
  },

  // Dicas do bairro
  {
    intent: 'NEIGHBORHOOD_TIPS',
    patterns: [
      { regex: /\b(padaria|supermercado|mercado|farmacia|farm[aá]cia|restaurante|bar|lanchonete|pizzaria)\b.*\b(perto|proximo|pr[oó]ximo|aqui|ao redor|por aqui)\b/i, confidence: 0.92 },
      { regex: /\b(onde (comprar|comer|beber|achar|encontrar|fazer))\b/i, confidence: 0.88 },
      { regex: /\b(tem (mercado|padaria|farmacia|restaurante|banco|caixa))\b/i, confidence: 0.85 },
    ],
  },

  // Recomendação local
  {
    intent: 'LOCAL_RECOMMENDATION',
    patterns: [
      { regex: /\b(o que (fazer|tem)|passeio|praia|trilha|ponto turistico|tur[ií]stico|dica|recomend|sugest[aã]o)\b/i, confidence: 0.85 },
      { regex: /\b(o que (fa[cç]o|posso fazer)|programa|roteiro|conhecer|visitar)\b/i, confidence: 0.83 },
    ],
  },

  // ── PRIORIDADE BAIXA: Saudação e despedida (genéricas, por último) ──
  {
    intent: 'HOST_GREETING',
    patterns: [
      { regex: /^(oi|ola|ol[aá]|bom dia|boa tarde|boa noite|hey|eai|e ai)\b/i, confidence: 0.70 },
    ],
  },
  {
    intent: 'HOST_FAREWELL',
    patterns: [
      { regex: /\b(obrigado|obrigada|valeu|at[eé]|tchau|adeus|vlw|muito obrigad)\b/i, confidence: 0.85 },
    ],
  },
];

/**
 * Classifica a intenção de uma mensagem de hóspede Airbnb.
 *
 * Mesma estrutura do intent-router.ts (heurística → LLM → fallback),
 * mas com o set de intenções e padrões do AirB.
 */
export function classifyAirBIntent(message: string): { intent: AirBIntent; confidence: number; method: 'heuristic' | 'llm' | 'fallback' } {
  const lower = message.toLowerCase().trim();

  // Passo 1: Heurística rápida (igual ao intent-router.ts:138-253)
  for (const { intent, patterns } of AIRB_INTENT_PATTERNS) {
    for (const { regex, confidence } of patterns) {
      if (regex.test(lower)) {
        return { intent, confidence, method: 'heuristic' };
      }
    }
  }

  // Passo 2: Em produção, chamaria LLM aqui (como intent-router.ts:256-284)
  // Por ora, fallback para desconhecido
  return { intent: 'UNKNOWN', confidence: 0.3, method: 'fallback' };
}


// ── 4. TOOLS DO ZÉLLA AIRB ────────────────────────────────────────────────────

/**
 * Ferramentas do Zélla AirB — completamente diferentes do Zélla Pousada.
 *
 * Comparação:
 *   Zélla Pousada (zehla-tools.ts):
 *     zehla_analisar_ocupacao  → Analisa taxa de ocupação
 *     zehla_sugerir_preco      → Sugere preço ótimo
 *     zehla_analisar_reviews   → Analisa reviews
 *     zehla_gerar_relatorio_diario → Relatório operacional diário
 *     zehla_buscar_dados_property  → Dados cadastrais da pousada
 *
 *   Zélla AirB (este arquivo):
 *     airb_get_checkin_guide   → Guia completo de check-in
 *     airb_get_house_rules     → Regras da casa
 *     airb_get_wifi_info       → Dados do WiFi
 *     airb_get_equipment_help  → Como usar equipamentos
 *     airb_get_neighborhood_tips → Dicas do bairro
 *     airb_get_emergency_info  → Contatos de emergência
 *     airb_get_host_knowledge  → Conhecimento do anfitrião sobre o imóvel
 */
export interface AirBToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, any>, context: AirbnbPropertyContext) => Promise<string>;
}

/**
 * Builder de tools — recebe o contexto do imóvel e retorna funções executáveis.
 *
 * No Zélla Pousada (zehla-tools.ts:12-20), as tools fazem queries no banco
 * usando db.lead, db.booking, etc. No AirB, as tools consultam o
 * AirbnbPropertyContext que já foi carregado pelo orquestrador.
 */
export function buildAirBTools(context: AirbnbPropertyContext): AirBToolDefinition[] {
  return [
    {
      name: 'airb_get_checkin_guide',
      description: 'Retorna o guia completo de check-in com instruções de acesso, lockbox, estacionamento e boas-vindas.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const parts: string[] = [];
        parts.push(`📍 ${context.name}`);
        parts.push(`📌 ${context.address}, ${context.neighborhood} — ${context.city}/${context.state}`);

        if (context.checkInInstructions) {
          parts.push(`\n🔑 Check-in: ${context.checkInInstructions}`);
        }
        if (context.lockCode) {
          parts.push(`🔐 Código: ${context.lockCode}`);
        }
        if (context.parkingInstructions) {
          parts.push(`🅿️ Estacionamento: ${context.parkingInstructions}`);
        }
        parts.push(`📶 WiFi: ${context.wifiNetwork} / Senha: ${context.wifiPassword}`);

        // Incluir "quirks" importantes
        const importantQuirks = context.hostKnowledge.filter(k => k.isImportant);
        if (importantQuirks.length > 0) {
          parts.push('\n⚠️ Atenção:');
          for (const q of importantQuirks) {
            parts.push(`  • ${q.title}: ${q.description}`);
          }
        }

        return JSON.stringify({ guide: parts.join('\n') });
      },
    },

    {
      name: 'airb_get_house_rules',
      description: 'Retorna as regras da casa: horário silencioso, festas, pets, fumo, etc.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const rules: string[] = [];
        for (const rule of context.houseRules) {
          rules.push(`• ${rule}`);
        }
        if (context.quietHoursStart && context.quietHoursEnd) {
          rules.push(`• Horário silencioso: ${context.quietHoursStart} às ${context.quietHoursEnd}`);
        }
        rules.push(`• Máximo de hóspedes: ${context.maxGuests}`);
        rules.push(`• Pets: ${context.allowsPets ? 'Permitidos' : 'Não permitidos'}`);
        rules.push(`• Fumo: ${context.allowsSmoking ? 'Permitido' : 'Não permitido'}`);
        rules.push(`• Festas: ${context.allowsParties ? 'Permitidas' : 'Não permitidas'}`);

        return JSON.stringify({ rules });
      },
    },

    {
      name: 'airb_get_wifi_info',
      description: 'Retorna dados da rede WiFi do imóvel.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        return JSON.stringify({
          network: context.wifiNetwork,
          password: context.wifiPassword,
        });
      },
    },

    {
      name: 'airb_get_equipment_help',
      description: 'Retorna instruções de uso de equipamentos do imóvel. Filtrar por nome se fornecido.',
      parameters: {
        type: 'object',
        properties: {
          equipment_name: { type: 'string', description: 'Nome ou parte do nome do equipamento' },
        },
      },
      execute: async (args) => {
        const filter = (args.equipment_name || '').toLowerCase();
        const matches = filter
          ? context.equipment.filter(e => e.name.toLowerCase().includes(filter) || e.location.toLowerCase().includes(filter))
          : context.equipment;

        if (matches.length === 0) {
          return JSON.stringify({ message: 'Equipamento não encontrado. Equipamentos disponíveis: ' + context.equipment.map(e => e.name).join(', ') });
        }

        return JSON.stringify(matches.map(e => ({
          name: e.name,
          location: e.location,
          instructions: e.instructions,
          whereIsRemote: e.whereIsRemote,
          troubleshooting: e.troubleshooting,
        })));
      },
    },

    {
      name: 'airb_get_neighborhood_tips',
      description: 'Retorna dicas do bairro: padarias, restaurantes, farmácias, etc. Filtrar por categoria se fornecido.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'food|transport|leisure|warning|service|shopping' },
        },
      },
      execute: async (args) => {
        const category = args.category;
        const tips = category
          ? context.neighborhoodTips.filter(t => t.category === category)
          : context.neighborhoodTips;

        if (tips.length === 0) {
          return JSON.stringify({ message: 'Nenhuma dica encontrada para essa categoria.' });
        }

        return JSON.stringify(tips.map(t => ({
          name: t.name,
          category: t.category,
          description: t.description,
          distance: t.distance,
          phone: t.phone,
          hours: t.hours,
        })));
      },
    },

    {
      name: 'airb_get_emergency_info',
      description: 'Retorna contatos de emergência e informações de saúde próximas.',
      parameters: { type: 'object', properties: {} },
      execute: async () => {
        const info: Record<string, any> = {};
        info.contacts = context.emergencyContacts;
        if (context.nearestHospital) info.nearestHospital = context.nearestHospital;
        if (context.nearestPharmacy) info.nearestPharmacy = context.nearestPharmacy;
        return JSON.stringify(info);
      },
    },

    {
      name: 'airb_get_host_knowledge',
      description: 'Retorna conhecimento específico do anfitrião sobre o imóvel (peculiaridades, dicas, avisos). Filtrar por categoria.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'quirk|tip|warning|how_to' },
          search: { type: 'string', description: 'Termo de busca' },
        },
      },
      execute: async (args) => {
        let entries = context.hostKnowledge;
        if (args.category) {
          entries = entries.filter(e => e.category === args.category);
        }
        if (args.search) {
          const term = (args.search as string).toLowerCase();
          entries = entries.filter(e =>
            e.title.toLowerCase().includes(term) || e.description.toLowerCase().includes(term)
          );
        }
        return JSON.stringify(entries.map(e => ({
          category: e.category,
          title: e.title,
          description: e.description,
          isImportant: e.isImportant,
        })));
      },
    },
  ];
}


// ── 5. PROMPT BUILDER — O CORAÇÃO DO ZÉLLA AIRB ──────────────────────────────

/**
 * Constrói o system prompt do Zélla AirB.
 *
 * Comparação com o código existente:
 *
 *   PromptBuilder.ts (brain/processors/PromptBuilder.ts:39-53):
 *     "Você é o assistente virtual da ${property.name}.
 *      Atende pelo WhatsApp de forma calorosa e eficiente.
 *      REGRAS: Sempre gentil, use emojis com moderação,
 *              NÃO negocie preços, NÃO faça estornos."
 *
 *   whatsapp-ai-responder.ts (linha 363-380):
 *     "Você é a ZÉLLA, uma assistente virtual de inteligência artificial
 *      ultra-atenciosa e hospitaleira da pousada X.
 *      Seu objetivo é sanar dúvidas, encantar o hóspede, sugerir acomodações
 *      e incentivar a reserva direta de forma natural, educada e calorosa."
 *
 *   *** NENHUM dos dois serve para Airbnb. O tom de vendedor é tóxico. ***
 */
export function buildAirBSystemPrompt(
  context: AirbnbPropertyContext,
  intent: AirBIntent,
  conversationHistory?: string,
): string {
  // ── Identidade do anfitrião ──
  const identityBlock = `Você é o ANFITRIÃO do "${context.name}".
Você NÃO é uma secretária, NÃO é um robô de atendimento, NÃO é um chatbot genérico.
Você é como o DONO do imóvel que está recebendo um amigo em casa.
Conhece CADA DETALHE do imóvel — onde fica a chave, como funciona o ar,
qual a melhor padaria da rua, qual quarto tem o travesseiro mais macio.

Tom: Pessoal, acolhedor, como um amigo que te empresta a casa.
     NUNCA use linguagem corporativa ou de "atendimento ao cliente".
     NUNCA diga "Como posso ajudar?" — soa robótico.
     NUNCA tente vender nada — o hóspede JÁ reservou.

Imóvel: ${context.name}
Tipo: ${context.type}
Localização: ${context.address}, ${context.neighborhood} — ${context.city}/${context.state}
Capacidade: Até ${context.maxGuests} hóspedes`;

  // ── Regras do anfitrião ──
  const rulesBlock = `REGRAS DO ANFITRIÃO:
1. Responda como se VOCÊ fosse o dono do imóvel — não como um atendente.
2. Seja CONCISO — mensagens de WhatsApp longas cansam. Máximo 3 parágrafos curtos.
3. Use emojis com moderação — como uma pessoa real, não um panfleto.
4. Se não souber algo, diga "Deixa eu verificar isso pra você" — NÃO invente.
5. NUNCA mencione preços, reservas, ou tente vender algo.
6. NUNCA use "Estou aqui para ajudar" ou frases de call center.
7. Emergências são PRIORIDADE — responda rápido e dê contatos claros.
8. Sempre em português do Brasil, natural e coloquial.`;

  // ── Conhecimento do anfitrião ──
  const knowledgeBlock = buildHostKnowledgeBlock(context);

  // ── Histórico da conversa ──
  const historyBlock = conversationHistory
    ? `\n\n=== HISTÓRICO DA CONVERSA ===\n${conversationHistory}`
    : '';

  // ── Diretrizes específicas por intenção ──
  const intentBlock = buildIntentSpecificBlock(intent, context);

  return `${identityBlock}\n\n${rulesBlock}\n\n${knowledgeBlock}${historyBlock}\n\n${intentBlock}`;
}

/**
 * Constrói o bloco de conhecimento do anfitrião para o prompt.
 * Inclui: peculiaridades do imóvel, equipamentos, regras, e dicas do bairro.
 */
function buildHostKnowledgeBlock(context: AirbnbPropertyContext): string {
  const parts: string[] = ['=== O QUE VOCÊ SABE SOBRE O IMÓVEL ==='];

  // Acesso
  parts.push('\n🔑 Acesso:');
  parts.push(`  Check-in: ${context.checkInInstructions}`);
  if (context.lockCode) parts.push(`  Código/Chave: ${context.lockCode}`);
  parts.push(`  WiFi: ${context.wifiNetwork} / Senha: ${context.wifiPassword}`);
  if (context.parkingInstructions) parts.push(`  Estacionamento: ${context.parkingInstructions}`);

  // Regras resumidas
  parts.push('\n📜 Regras da Casa:');
  for (const rule of context.houseRules.slice(0, 5)) {
    parts.push(`  • ${rule}`);
  }
  if (context.quietHoursStart) {
    parts.push(`  • Horário silencioso: ${context.quietHoursStart} às ${context.quietHoursEnd}`);
  }

  // Conhecimento do anfitrião (peculiaridades e avisos importantes)
  const importantKnowledge = context.hostKnowledge.filter(k => k.isImportant || k.category === 'warning');
  if (importantKnowledge.length > 0) {
    parts.push('\n⚠️ Atenção (coisas que o hóspede precisa saber):');
    for (const k of importantKnowledge) {
      parts.push(`  • ${k.title}: ${k.description}`);
    }
  }

  // Equipamentos resumidos
  if (context.equipment.length > 0) {
    parts.push('\n🔧 Equipamentos:');
    for (const eq of context.equipment) {
      parts.push(`  • ${eq.name} (${eq.location}): ${eq.instructions}`);
    }
  }

  // Dicas do bairro (top 5)
  if (context.neighborhoodTips.length > 0) {
    parts.push('\n🗺️ Bairro:');
    const topTips = context.neighborhoodTips.slice(0, 5);
    for (const tip of topTips) {
      parts.push(`  • ${tip.name}: ${tip.description}${tip.distance ? ` (${tip.distance})` : ''}`);
    }
  }

  // Emergência
  if (context.emergencyContacts.length > 0) {
    parts.push('\n🚨 Emergência:');
    for (const contact of context.emergencyContacts) {
      parts.push(`  • ${contact.name} (${contact.role}): ${contact.phone}${contact.availableHours ? ` — ${contact.availableHours}` : ''}`);
    }
  }

  return parts.join('\n');
}

/**
 * Diretrizes específicas por intenção — equivalente ao PromptBuilder.ts:47-53
 * mas adaptado para o contexto Airbnb.
 */
function buildIntentSpecificBlock(intent: AirBIntent, context: AirbnbPropertyContext): string {
  const blocks: Record<AirBIntent, string> = {
    CHECK_IN_GUIDE: `ORIENTAÇÃO: O hóspede quer saber como fazer check-in.
Dê instruções claras e acolhedoras. Inclua: endereço, código de acesso, WiFi, e dica rápida.
Exemplo de tom: "Chegou? Que bom! A chave tá no lockbox, código 4521. O wifi é Casa123 com senha praia2024."`,

    SELF_CHECK_IN: `ORIENTAÇÃO: O hóspede está NO LOCAL e precisa de acesso.
Responda RÁPIDO com o código/chave. Depois dê as boas-vindas.
Exemplo de tom: "Código do lockbox: 4521! Tá na portinha preta perto da porta. Qualquer coisa me chama!"`,

    HOUSE_RULES: `ORIENTAÇÃO: O hóspede quer saber as regras.
Seja direto mas sem tom de proibição — como um amigo explicando como as coisas funcionam.
Exemplo de tom: "Aqui pedimos silêncio depois das 22h pros vizinhos, e infelizmente não pode fumar dentro. Mas a varanda é toda sua!"`,

    WIFI_INFO: `ORIENTAÇÃO: O hóspede precisa do WiFi.
Responda DIRETO: rede e senha. Se tiver problema, dica de troubleshooting.
Exemplo de tom: "WiFi: CasaVistaMar_5G, senha: praia2024. Se não conectar, reinicia o roteador — tá na sala perto da TV."`,

    EQUIPMENT_HELP: `ORIENTAÇÃO: O hóspede precisa de ajuda com equipamento.
Dê instruções passo a passo, como você explicaria pra um amigo.
Exemplo de tom: "O ar do quarto é assim: pega o controle (tá na gaveta da mesinha), aperta Power, seleciona Cool e coloca 23 graus. Funciona melhor assim!"`,

    NEIGHBORHOOD_TIPS: `ORIENTAÇÃO: O hóspede quer dicas do bairro.
Recomende como um local — não como um guia turístico. Foque no que você REALMENTE gosta.
Exemplo de tom: "A padaria da esquina (2 min andando) tem o melhor pão francês. O restaurante do Seu João, na outra quadra, faz um bolinho de peixe incrível."`,

    PARKING_INFO: `ORIENTAÇÃO: O hóspede precisa de info sobre estacionamento.
Seja claro sobre onde, como e restrições.
Exemplo de tom: "Sua vaga é a 14 na garagem do prédio. Entra pela porta da lateral, usa o controle que tá na gaveta da entrada."`,

    EMERGENCY: `ORIENTAÇÃO: EMERGÊNCIA — prioridade máxima.
Seja calmo mas assertivo. Dê contatos claros e ação imediata.
Se for vazamento/problema físico: síndico e anfitrião.
Se for saúde: hospital e farmácia mais próximos.
Exemplo de tom: "Calma! Se for vazamento, fecha o registro geral (fica debaixo da pia da cozinha). Liga pro síndico Carlos: 11999... Eu já tô sabendo."`,

    HOST_GREETING: `ORIENTAÇÃO: Primeiro contato — boas-vindas calorosas.
Não seja formal. Seja como o amigo que acabou de te receber em casa.
Se for ANTES do check-in: dê entusiasmo + info útil.
Se for DEPOIS do check-in: pergunte como tá sendo a estadia.
Exemplo de tom: "E aí, tudo certo pra sexta? O apartamento tá impecável te esperando! Qualquer dúvida me chama aqui."`,

    HOST_FAREWELL: `ORIENTAÇÃO: Agradecimento pela estadia.
Seja genuíno, não genérico. Mencione algo específico se possível.
Exemplo de tom: "Que bom que curtiu! Volta sempre, a porta tá sempre aberta. 😊"`,

    EXTEND_STAY: `ORIENTAÇÃO: O hóspede quer ficar mais.
Verifique disponibilidade (consulta o iCal/API) e seja simpático.
Exemplo de tom: "Quer ficar mais? Que massa! Deixa eu ver se tá livre... Sim, pode ficar até domingo!"`,

    CLEANING_REQUEST: `ORIENTAÇÃO: O hóspede precisa de limpeza ou itens extras.
Seja prestativo, confirme o que precisa e quando.
Exemplo de tom: "Claro! Mando toalhas limpas agora. Precisa de mais alguma coisa?"`,

    MAINTENANCE_ISSUE: `ORIENTAÇÃO: Algo quebrou ou não funciona.
Empatia primeiro, depois solução. Se não souber resolver, escalar pro anfitrião.
Exemplo de tom: "Poxa, que chato! O chuveiro às vezes faz isso — tenta girar o regulador até o fim e volta. Se não resolver, eu aviso o maintainer pra ir lá."`,

    LOCAL_RECOMMENDATION: `ORIENTAÇÃO: O hóspede quer dicas de passeio/atividade.
Recomende como um LOCAL, não como TripAdvisor. Foque no autêntico.
Exemplo de tom: "Se tá com sol, a trilha da Praia Seca é incrível — 20 min de caminhada e você chega num paraíso. Leva água!"`,

    HUMAN_HANDOVER: `ORIENTAÇÃO: O hóspede quer falar com o anfitrião diretamente.
Transfira com empatia, não como um robô de "não posso ajudar".
Exemplo de tom: "Claro, vou pedir pro dono te contactar agora. Ele responde rápido!"`,

    UNKNOWN: `ORIENTAÇÃO: Não entendeu a mensagem.
Seja honesto, não invente. Pergunte de forma natural.
Exemplo de tom: "Hmm, não entendi muito bem — pode explicar de outro jeito?"`,
  };

  return blocks[intent] || blocks.UNKNOWN;
}


// ── 6. USER PROMPT BUILDER ────────────────────────────────────────────────────

/**
 * Constrói o user prompt para o LLM.
 *
 * Comparação com PromptBuilder.ts:56-58:
 *   `Mensagem: "${message}"\nIntent: ${classified.intent}\n...`
 *
 * No AirB, mantemos a estrutura mas com o contexto específico.
 */
export function buildAirBUserPrompt(
  message: string,
  intent: AirBIntent,
  confidence: number,
): string {
  return `Mensagem do hóspede: "${message}"
Intenção detectada: ${intent} (confiança: ${(confidence * 100).toFixed(1)}%)
Responda como o anfitrião do imóvel.`;
}


// ── 7. EXEMPLO CONCRETO DE CONTEXTO ──────────────────────────────────────────

/**
 * Dados de exemplo para TESTE da prova de conceito.
 * Simula um apartamento de praia em Florianópolis.
 */
export const SAMPLE_AIRBNB_CONTEXT: AirbnbPropertyContext = {
  id: 'prop_airb_sample_001',
  name: 'Apartamento Vista Mar - Jurere Internacional',
  airbnbListingId: '1234567890',
  type: 'apartamento',
  address: 'Rua das Gaivotas, 320, Apto 804',
  neighborhood: 'Jurerê Internacional',
  city: 'Florianópolis',
  state: 'SC',
  latitude: -27.4407,
  longitude: -48.4907,

  checkInInstructions: 'Lockbox preto na portaria. Código: 4521. Pegue a chave do apto 804, 8o andar, torre B.',
  lockProvider: 'lockbox',
  lockCode: '4521',
  wifiNetwork: 'VistaMar_5G',
  wifiPassword: 'jurere2024',
  parkingInstructions: 'Vaga 14 na garagem G2 (subsolo). Controle da cancela na gaveta da entrada.',

  houseRules: [
    'Sem festas ou eventos',
    'Sem fumar no apartamento',
    'Silêncio após 22h',
    'Pet permitido até 15kg (com taxa)',
    'Fechar janelas ao sair (vento forte)',
    'Não pendurar toalhas na varanda',
  ],
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  maxGuests: 4,
  allowsPets: true,
  allowsSmoking: false,
  allowsParties: false,

  hostKnowledge: [
    {
      id: 'hk1',
      category: 'quirk',
      title: 'Torneira da cozinha',
      description: 'Demora uns 30 segundos pra esquentar — é normal, o cano é longo.',
      isImportant: true,
    },
    {
      id: 'hk2',
      category: 'how_to',
      title: 'Ar-condicionado do quarto',
      description: 'Ligar no modo Cool, 23°C. O modo Auto não funciona bem — o sensor é defeituoso.',
      isImportant: true,
    },
    {
      id: 'hk3',
      category: 'quirk',
      title: 'Porta da varanda',
      description: 'Emperra um pouco. Empurra pra cima enquanto gira a maçaneta.',
      isImportant: true,
    },
    {
      id: 'hk4',
      category: 'tip',
      title: 'Vento da tarde',
      description: 'Depois das 15h venta MUITO. Feche as janelas antes de sair, senão cortina voa.',
      isImportant: true,
    },
    {
      id: 'hk5',
      category: 'tip',
      title: 'Chuveiro do banheiro social',
      description: 'Tem que girar o regulador até o fim e voltar um pouquinho. No meio não esquenta.',
      isImportant: false,
    },
    {
      id: 'hk6',
      category: 'warning',
      title: 'Chave do portão',
      description: 'A chave da portaria às vezes não destrava de primeira. Insiste 2-3 vezes com calma.',
      isImportant: false,
    },
  ],

  neighborhoodTips: [
    {
      id: 'nt1',
      category: 'food',
      name: 'Padaria Aroma do Pão',
      description: 'Melhor pão francês de Jurerê. Croissant de chocolate é sensacional.',
      distance: '3 min a pé',
      phone: '48999990001',
      hours: '5h30-20h',
    },
    {
      id: 'nt2',
      category: 'food',
      name: 'Restaurante do Seu Zé',
      description: 'Peixe frito com pirão de primeira. Faz entrega até 22h.',
      distance: '5 min a pé',
      phone: '48999990002',
      hours: '11h-22h',
    },
    {
      id: 'nt3',
      category: 'service',
      name: 'Farmácia Jurerê',
      description: 'Aberta até meia-noite. Tem de tudo.',
      distance: '8 min a pé',
      phone: '48999990003',
      hours: '7h-00h',
    },
    {
      id: 'nt4',
      category: 'leisure',
      name: 'Praia de Jurerê',
      description: '5 min andando. Barracas na frente do Il Campanario. Água calma, boa pra criança.',
      distance: '5 min a pé',
    },
    {
      id: 'nt5',
      category: 'warning',
      name: 'Rua sem saída',
      description: 'A rua de trás (Rua das Andorinhas) é sem saída. Não tente cortar caminho por ali de carro.',
    },
    {
      id: 'nt6',
      category: 'food',
      name: 'Supermercado Bistek',
      description: 'O mais próximo. Bom pra comprar água, cerveja e lanches.',
      distance: '10 min a pé',
      hours: '7h-22h',
    },
  ],

  equipment: [
    {
      id: 'eq1',
      name: 'Ar-condicionado do quarto principal',
      location: 'Quarto principal',
      instructions: 'Ligar no modo Cool, 23°C. NÃO usar o modo Auto.',
      whereIsRemote: 'Gaveta da mesa de cabeceira, lado esquerdo',
      troubleshooting: 'Se não ligar, verifique o disjuntor na caixa do corredor (segundo da esquerda)',
    },
    {
      id: 'eq2',
      name: 'Ar-condicionado do quarto de hóspedes',
      location: 'Quarto de hóspedes',
      instructions: 'Ligar no modo Cool, 22°C.',
      whereIsRemote: 'Na parede ao lado da porta',
    },
    {
      id: 'eq3',
      name: 'Máquina de café Nespresso',
      location: 'Cozinha, balcão',
      instructions: 'Colocar cápsula, apertar botão pequeno (espresso) ou grande (lungo). Desligar depois.',
      whereIsRemote: 'Cápsulas na gaveta de baixo do balcão',
    },
    {
      id: 'eq4',
      name: 'TV Samsung 55"',
      location: 'Sala',
      instructions: 'Controle na mesa de centro. Fonte 1 = TV a cabo, Fonte 2 = Chromecast (Netflix, YouTube)',
      whereIsRemote: 'Mesa de centro da sala',
      troubleshooting: 'Se a tela ficar preta, aperte Source no controle e selecione HDMI 1 ou 2',
    },
    {
      id: 'eq5',
      name: 'Fogão Electrolux',
      location: 'Cozinha',
      instructions: 'Girar o botão e apertar o acendedor. Se não acender, mantenha girado por 3 segundos.',
      troubleshooting: 'Se vazar gás, feche o registro atrás do fogão e ligue pro síndico.',
    },
  ],

  emergencyContacts: [
    {
      name: 'Carlos (Síndico)',
      phone: '48988880001',
      role: 'Síndico do edifício',
      availableHours: '8h-18h',
    },
    {
      name: 'Ana (Minha esposa)',
      phone: '48988880002',
      role: 'Anfitriã reserva',
      availableHours: 'Qualquer hora (emergências)',
    },
  ],
  nearestHospital: 'Hospital Albert Einstein — 15 min de carro',
  nearestPharmacy: 'Farmácia Jurerê — 8 min a pé (aberta até meia-noite)',
};


// ── 8. PIPELINE DE EXECUÇÃO (Prova de Conceito) ──────────────────────────────

/**
 * Resultado do processamento do Zélla AirB.
 */
export interface AirBProcessResult {
  intent: AirBIntent;
  confidence: number;
  systemPrompt: string;
  userPrompt: string;
  toolResults: Array<{ tool: string; result: any }>;
  /** A resposta final seria gerada pelo LLM — aqui só montamos o prompt */
  readyForLLM: boolean;
}

/**
 * Pipeline completo de processamento do Zélla AirB.
 *
 * Este é o equivalente ao chain de handlers do agent-orchestrator.ts:
 *   SecurityHandler → IntentClassifierHandler → TrialValidatorHandler →
 *   ReceiptHandler → PromptBuilderHandler → ToolCallingHandler →
 *   SemanticCacheHandler → LLMExecutionHandler → LoggingHandler → VoiceHandler
 *
 * Mas simplificado para a POC e com a lógica específica do AirB.
 *
 * No código real, este pipeline seria injetado no orquestrador
 * quando Property.type for um tipo AirB (apartamento|casa|studio|loft)
 * OU quando o tenant estiver no modo "airbnb".
 */
export async function processAirBMessage(
  message: string,
  context: AirbnbPropertyContext,
  conversationHistory?: string,
): Promise<AirBProcessResult> {
  // 1. Classificar intenção (equivalente ao IntentClassifierHandler)
  const { intent, confidence } = classifyAirBIntent(message);

  // 2. Construir system prompt (equivalente ao PromptBuilderHandler)
  const systemPrompt = buildAirBSystemPrompt(context, intent, conversationHistory);

  // 3. Construir user prompt
  const userPrompt = buildAirBUserPrompt(message, intent, confidence);

  // 4. Executar tools relevantes (equivalente ao ToolCallingHandler)
  const toolResults = await executeAirBToolsForIntent(intent, context);

  // 5. Montar resultado
  return {
    intent,
    confidence,
    systemPrompt,
    userPrompt,
    toolResults,
    readyForLLM: true,
  };
}

/**
 * Executa as tools relevantes para a intenção detectada.
 *
 * No orquestrador atual (agent-orchestrator.ts:115-127),
 * o ToolCallingHandler sempre chama zehla_buscar_dados_property.
 * No AirB, chamamos as tools relevantes para a intenção.
 */
async function executeAirBToolsForIntent(
  intent: AirBIntent,
  context: AirbnbPropertyContext,
): Promise<Array<{ tool: string; result: any }>> {
  const tools = buildAirBTools(context);
  const results: Array<{ tool: string; result: any }> = [];

  // Mapeamento intenção → tools
  const intentToolMap: Record<AirBIntent, string[]> = {
    CHECK_IN_GUIDE:          ['airb_get_checkin_guide'],
    SELF_CHECK_IN:           ['airb_get_checkin_guide', 'airb_get_wifi_info'],
    HOUSE_RULES:             ['airb_get_house_rules'],
    WIFI_INFO:               ['airb_get_wifi_info'],
    EQUIPMENT_HELP:          ['airb_get_equipment_help'],
    NEIGHBORHOOD_TIPS:       ['airb_get_neighborhood_tips'],
    PARKING_INFO:            ['airb_get_checkin_guide'],  // parking está no checkin guide
    EMERGENCY:               ['airb_get_emergency_info'],
    HOST_GREETING:           ['airb_get_checkin_guide'],
    HOST_FAREWELL:           [],
    EXTEND_STAY:             [],
    CLEANING_REQUEST:        [],
    MAINTENANCE_ISSUE:       ['airb_get_equipment_help', 'airb_get_host_knowledge'],
    LOCAL_RECOMMENDATION:    ['airb_get_neighborhood_tips', 'airb_get_host_knowledge'],
    HUMAN_HANDOVER:          [],
    UNKNOWN:                 ['airb_get_host_knowledge'],
  };

  const toolNames = intentToolMap[intent] || [];

  for (const toolName of toolNames) {
    const tool = tools.find(t => t.name === toolName);
    if (tool) {
      try {
        const result = await tool.execute({}, context);
        results.push({ tool: toolName, result: JSON.parse(result) });
      } catch (err) {
        results.push({ tool: toolName, result: { error: String(err) } });
      }
    }
  }

  return results;
}


// ── 9. INTERFACE DO STRATEGY (ponto de integração futuro) ─────────────────────

/**
 * Interface que define o contrato de uma Strategy.
 *
 * No futuro, o orquestrador (agent-orchestrator.ts) será modificado para:
 * 1. Receber o OperatingMode do Property/Tenant
 * 2. Selecionar a Strategy correta
 * 3. Delegar a construção de prompts, intents e tools para a Strategy
 *
 * EXEMPLO DE INTEGRAÇÃO FUTURA (NÃO IMPLEMENTAR AGORA):
 *
 *   // No agent-orchestrator.ts
 *   const mode = await getOperatingMode(request.propertyId);
 *   const strategy = mode === 'airbnb' ? new AirBStrategy() : new PousadaStrategy();
 *   const systemPrompt = strategy.buildSystemPrompt(property, intent, context);
 *   const tools = strategy.getTools(property);
 *   const intents = strategy.getIntents();
 */
export interface IZellaStrategy {
  readonly mode: OperatingMode;

  /** Classifica a intenção de uma mensagem */
  classifyIntent(message: string): Promise<{ intent: string; confidence: number }>;

  /** Constrói o system prompt */
  buildSystemPrompt(
    property: AirbnbPropertyContext,
    intent: string,
    context?: Record<string, unknown>,
  ): string;

  /** Constrói o user prompt */
  buildUserPrompt(
    message: string,
    intent: string,
    confidence: number,
    context?: Record<string, unknown>,
  ): string;

  /** Retorna as tools disponíveis */
  getTools(property: AirbnbPropertyContext): AirBToolDefinition[];

  /** Retorna o nome do agente para a intent */
  getAgentName(intent: string): string;

  /** Retorna se deve incluir CTA de venda (Pousada: sim, AirB: não) */
  shouldIncludeSalesCTA(): boolean;
}

/**
 * Implementação concreta da Strategy para o Zélla AirB.
 */
export class ZellaAirBStrategy implements IZellaStrategy {
  readonly mode: OperatingMode = 'airbnb';

  async classifyIntent(message: string): Promise<{ intent: string; confidence: number }> {
    return classifyAirBIntent(message);
  }

  buildSystemPrompt(property: AirbnbPropertyContext, intent: string): string {
    return buildAirBSystemPrompt(property, intent as AirBIntent);
  }

  buildUserPrompt(message: string, intent: string, confidence: number): string {
    return buildAirBUserPrompt(message, intent as AirBIntent, confidence);
  }

  getTools(property: AirbnbPropertyContext): AirBToolDefinition[] {
    return buildAirBTools(property);
  }

  getAgentName(intent: string): string {
    const map: Record<AirBIntent, string> = {
      CHECK_IN_GUIDE: 'HOST', SELF_CHECK_IN: 'HOST', HOUSE_RULES: 'HOST',
      WIFI_INFO: 'HOST', EQUIPMENT_HELP: 'HOST', NEIGHBORHOOD_TIPS: 'LOCAL_GUIDE',
      PARKING_INFO: 'HOST', EMERGENCY: 'HOST', HOST_GREETING: 'HOST',
      HOST_FAREWELL: 'HOST', EXTEND_STAY: 'HOST', CLEANING_REQUEST: 'HOST',
      MAINTENANCE_ISSUE: 'HOST', LOCAL_RECOMMENDATION: 'LOCAL_GUIDE',
      HUMAN_HANDOVER: 'SYSTEM', UNKNOWN: 'HOST',
    };
    return map[intent as AirBIntent] || 'HOST';
  }

  shouldIncludeSalesCTA(): boolean {
    return false; // NUNCA inclui CTA de venda — o hóspede JÁ reservou
  }
}


// =============================================================================
// 10. COMPARAÇÃO VISUAL: Zélla Pousada vs Zélla AirB
// =============================================================================
//
// Dimensão              | Zélla Pousada (atual)           | Zélla AirB (este arquivo)
// ──────────────────────┼─────────────────────────────────┼───────────────────────────────
// Papel                 | Secretária recepcionista        | O dono/anfitrião do imóvel
// Objetivo              | Vender quartos, fechar reserva  | Fazer o hóspede se sentir em casa
// Tom                   | Profissional, hospitaleiro      | Pessoal, íntimo, amigo
// CTA                   | "Quer reservar? Mande o PIX!"   | "Qualquer coisa me chama!"
// Conhecimento          | Tipos de quarto, preços         | Onde fica a chave, melhor padaria
// Intenções             | RESERVATION_CREATE, PRICE_INQUIRY| CHECK_IN_GUIDE, HOUSE_RULES
// Tools                 | zehla_sugerir_preco             | airb_get_checkin_guide
//                       | zehla_analisar_ocupacao         | airb_get_host_knowledge
// Prompt builder        | "…da pousada X"                 | "Você é o ANFITRIÃO de X"
// Persona default       | "hospitalidade premium"         | "amigo que te empresta a casa"
// Venda direta          | SIM (PIX, link pagamento)       | NÃO
// Contexto do imóvel    | Property (endereço, quartos)    | AirbnbPropertyContext (lock, wifi, dicas)
// Fechadura inteligente | Não suportado                   | lockProvider + lockCode
// Dicas do bairro       | GENÉRICO ("seja entusiasta")    | ESPECÍFICO (padaria da esquina, 3 min)
// Emergência            | Não estruturado                 | Contatos, hospital, farmácia
// =============================================================================
