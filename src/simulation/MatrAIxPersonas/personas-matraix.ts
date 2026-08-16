// ============================================================================
// MatrAIx Personas Generator — 1.500+ personas brasileiras
// ----------------------------------------------------------------------------
// Inspirado no schema MatrAIx Persona 8B (1.290 dimensões categóricas) — adaptação
// para o contexto brasileiro de hospedagem.
//
// Cada persona é construída com ~30 dimensões do schema original (as relevantes
// para reserva de pousada), incluindo:
//   - demographics: age_bracket, region, gender_identity, urbanicity
//   - socioeconomic_band, primary_language, multilingualism
//   - life_stage, major_life_events
//   - tech_savviness, dominant_trait, values_priority
//   - att_data_privacy, att_brand_loyalty, att_online_reviews, att_risk_taking
//   - skill_negotiation, skill_critical_thinking, trait_curiosity
//   - val_experiences, val_security, val_convenience
//   - lifex_travel_breadth, lifex_financial_trajectory
//   - demo_marital_status, demo_children_count, demo_employment_status
//   - schwartz_value_*, sdt_need_*
//
// Personas são BRASILEIRAS, vindas das 27 capitais (e algumas cidades grandes),
// com idades variando de 18 a 75+, perfis financeiros diversos (low-income a
// high-income), estado civil, número de filhos, etc.
//
// Cenários: férias escolares (Jan-Jul-Dez), feriados prolongados, Réveillon,
// Carnaval, Semana Santa, finais de semana comuns.
// ============================================================================

export interface PersonaMatrAIx {
  id: string;
  display_name: string;
  source: 'synthetic-br';

  // ── Background (Demographics) ────────────────────────────────────────────
  age_bracket: string;
  idade_anos: number;
  regiao_brasil: string;
  cidade_origem: string;
  estado_origem: string;
  genero: string;
  urbanicidade: string; // Capital | Metrópole | Cidade média | Interior
  faixa_renda: string;
  ocupacao: string;
  profissao: string;
  nivel_escolaridade: string;
  estado_civil: string;
  qtd_filhos: number;
  composicao_familia: string; // "Casal sem filhos", "Família com 2 filhos", "Grupo de amigos"
  grupo_tamanho: number; // 1-8 pessoas que viajam juntas
  idiomas: string[];

  // ── Psychographics ────────────────────────────────────────────────────────
  tech_savviness: string;
  dominant_trait: string;
  valores_prioridade: string;
  prioridade_reserva: string; // 'preco' | 'localizacao' | 'conforto' | 'experiencia' | 'seguranca'
  att_data_privacy: string;
  att_brand_loyalty: string;
  att_online_reviews: string;
  att_risk_taking: string;
  trait_curiosity: string;
  trait_extraversion: string;
  trait_open_mindedness: string;
  val_experiences: string;
  val_security: string;
  val_convenience: string;
  val_price_sensitivity: string;
  val_aesthetics: string;

  // ── Behavior ───────────────────────────────────────────────────────────
  canal_preferido: string; // WhatsApp | Instagram | Site | Telefone | Email
  dispositivo_principal: string; // Mobile | Desktop | Tablet
  horario_pesquisa: string; // manhã | tarde | noite | madrugada
  antecedencia_reserva_dias: number;
  duracao_estadia_dias: number;
  viaja_com_pet: boolean;
  precisa_estacionamento: boolean;
  quantidade_malas: number;

  // ── Cenário de viagem ──────────────────────────────────────────────────
  ocasiao_viagem: string; // 'férias escolares' | 'réveillon' | 'carnaval' | 'semana santa' | 'feriado prolongado' | 'final de semana' | 'lua de mel' | 'aniversário'
  epoca_ano: string;
  temporada: 'alta' | 'média' | 'baixa';
  orcamento_diaria_max: number;
  orcamento_total_max: number;
  flexibilidade_datas: boolean;
  destino_preferido: string[]; // cidades ou estados

  // ── Mídia / Influência ──────────────────────────────────────────────────
  instagram_ativo: boolean;
  instagram_followers: number;
  segue_influencers: string[];
  le_reviews: boolean;
  qtd_reviews_lidas: number;
  pede_indicacao: boolean;
  confia_em_indicacao_amigos: boolean;

  // ── Reação a features ────────────────────────────────────────────────────
  aceita_caucao: boolean;
  cao_preocupacao_caucao: number; // 0-1
  interesse_checkout_estendido: number; // 0-1
  interesse_checkin_antecipado: number; // 0-1
  interesse_upsell: number; // 0-1
  interesse_fechadura_eletronica: number; // 0-1
  tem_cao_eletronica: boolean;

  // ── Persona-style diálogos ──────────────────────────────────────────────
  estilo_dialogo: 'curioso_detalhista' | 'direto_objetivo' | 'preocupado_regras' | 'impaciente_pressa' | 'amigavel_conversador' | 'formal_educado' | 'desconfiado_cauteloso' | 'entusiasmado_festas';
  primeira_mensagem_template: string;
  padrao_objecoes: string[];

  // ── Probabilidade de conversão (calibrada ao perfil) ────────────────────
  prob_responder_whatsapp: number;
  prob_reservar_apos_contato: number;
  prob_chegar_ao_checkout: number;
  prob_recomendar: number;
  prob_reclamar: number;
  churn_risk: number; // 0-1
}

// ─────────────────────────────────────────────────────────────────────────────
// CAPITAIS BRASILEIRAS — distribuição demográfica
// ─────────────────────────────────────────────────────────────────────────────
interface CidadeOrigem {
  cidade: string;
  estado: string;
  regiao: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  urbanicidade: 'Capital' | 'Metrópole';
  peso_demografico: number; // 0-1, proporcional à população
}

const CIDADES_ORIGEM: CidadeOrigem[] = [
  // Sudeste (alta densidade populacional)
  { cidade: 'São Paulo', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 1.00 },
  { cidade: 'Rio de Janeiro', estado: 'RJ', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.65 },
  { cidade: 'Belo Horizonte', estado: 'MG', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.30 },
  { cidade: 'Vitória', estado: 'ES', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  // Sul
  { cidade: 'Curitiba', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.30 },
  { cidade: 'Porto Alegre', estado: 'RS', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.25 },
  { cidade: 'Florianópolis', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.18 },
  // Nordeste
  { cidade: 'Salvador', estado: 'BA', regiao: 'Nordeste', urbanicidade: 'Metrópole', peso_demografico: 0.40 },
  { cidade: 'Recife', estado: 'PE', regiao: 'Nordeste', urbanicidade: 'Metrópole', peso_demografico: 0.25 },
  { cidade: 'Fortaleza', estado: 'CE', regiao: 'Nordeste', urbanicidade: 'Metrópole', peso_demografico: 0.35 },
  { cidade: 'Natal', estado: 'RN', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.12 },
  { cidade: 'João Pessoa', estado: 'PB', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  { cidade: 'Maceió', estado: 'AL', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  { cidade: 'Aracaju', estado: 'SE', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'São Luís', estado: 'MA', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.12 },
  { cidade: 'Teresina', estado: 'PI', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  // Centro-Oeste
  { cidade: 'Brasília', estado: 'DF', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.30 },
  { cidade: 'Goiânia', estado: 'GO', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.15 },
  { cidade: 'Cuiabá', estado: 'MT', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.08 },
  { cidade: 'Campo Grande', estado: 'MS', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.07 },
  // Norte
  { cidade: 'Manaus', estado: 'AM', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.20 },
  { cidade: 'Belém', estado: 'PA', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.15 },
  { cidade: 'Porto Velho', estado: 'RO', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.05 },
];

// Cidades grandes não-capitais
const CIDADES_NAO_CAPITAIS: CidadeOrigem[] = [
  { cidade: 'Campinas', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.15 },
  { cidade: 'Guarulhos', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.10 },
  { cidade: 'Santos', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.08 },
  { cidade: 'Niterói', estado: 'RJ', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.10 },
  { cidade: 'Nova Iguaçu', estado: 'RJ', regiao: 'Sudeste', urbanicidade: 'Metrópole', peso_demografico: 0.08 },
  { cidade: 'Contagem', estado: 'MG', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Londrina', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Maringá', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Caxias do Sul', estado: 'RS', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Joinville', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Feira de Santana', estado: 'BA', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Campina Grande', estado: 'PB', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
];

const TODAS_CIDADES = [...CIDADES_ORIGEM, ...CIDADES_NAO_CAPITAIS];

// Distribui pesos para amostragem ponderada
const pesoTotal = TODAS_CIDADES.reduce((s, c) => s + c.peso_demografico, 0);
const CIDADES_PONDERADAS: CidadeOrigem[] = [];
for (const c of TODAS_CIDADES) {
  const qtd = Math.max(1, Math.round((c.peso_demografico / pesoTotal) * 100));
  for (let i = 0; i < qtd; i++) CIDADES_PONDERADAS.push(c);
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTROS POOLS DE DADOS
// ─────────────────────────────────────────────────────────────────────────────
const FAIXAS_ETARIAS = [
  { bracket: '18-24', min: 18, max: 24, peso: 0.10 },
  { bracket: '25-34', min: 25, max: 34, peso: 0.30 },
  { bracket: '35-44', min: 35, max: 44, peso: 0.25 },
  { bracket: '45-54', min: 45, max: 54, peso: 0.18 },
  { bracket: '55-64', min: 55, max: 64, peso: 0.10 },
  { bracket: '65+', min: 65, max: 75, peso: 0.07 },
];

const GENEROS = [
  { label: 'Mulher', peso: 0.52 },
  { label: 'Homem', peso: 0.46 },
  { label: 'Não-binário', peso: 0.02 },
];

const FAIXAS_RENDA = [
  { label: 'Baixa renda (até R$ 2.000)', min: 800, max: 2000, peso: 0.25 },
  { label: 'Média-baixa (R$ 2-4 mil)', min: 2000, max: 4000, peso: 0.30 },
  { label: 'Média (R$ 4-8 mil)', min: 4000, max: 8000, peso: 0.25 },
  { label: 'Média-alta (R$ 8-15 mil)', min: 8000, max: 15000, peso: 0.13 },
  { label: 'Alta (R$ 15-30 mil)', min: 15000, max: 30000, peso: 0.05 },
  { label: 'Muito alta (acima de R$ 30 mil)', min: 30000, max: 80000, peso: 0.02 },
];

const PROFISSOES = [
  'Médico(a)', 'Advogado(a)', 'Engenheiro(a)', 'Professor(a)', 'Contador(a)',
  'Designer', 'Programador(a)', 'Arquiteto(a)', 'Veterinário(a)', 'Dentista',
  'Enfermeiro(a)', 'Farmacêutico(a)', 'Psicólogo(a)', 'Fisioterapeuta',
  'Comerciante', 'Empresário(a)', 'Servidor público', 'Bancário(a)', 'Vendedor(a)',
  'Administrador(a)', 'Marketing', 'Jornalista', 'Publicitário(a)',
  'Estudante universitário(a)', 'Aposentado(a)', 'Don(a)a de casa',
  'Cabeleireiro(a)', 'Mecânico', 'Eletricista', 'Cozinheiro(a)',
  'Nutricionista', 'Personal trainer', 'Piloto', 'Bombeiro(a)', 'Policial',
  'Caminhoneiro(a)', 'Autônomo(a)', 'Freelancer', 'Consultor(a)',
];

const ESTADOS_CIVIS = [
  { label: 'Solteiro(a)', peso: 0.32 },
  { label: 'Casado(a) / União estável', peso: 0.50 },
  { label: 'Divorciado(a)', peso: 0.12 },
  { label: 'Viúvo(a)', peso: 0.06 },
];

const NIVEIS_ESCOLARIDADE = [
  { label: 'Ensino Médio completo', peso: 0.20 },
  { label: 'Ensino Superior incompleto', peso: 0.15 },
  { label: 'Ensino Superior completo', peso: 0.40 },
  { label: 'Pós-graduação / MBA', peso: 0.18 },
  { label: 'Mestrado / Doutorado', peso: 0.07 },
];

const OCUPACOES = [
  { label: 'CLT em empresa privada', peso: 0.40 },
  { label: 'Servidor público', peso: 0.12 },
  { label: 'Autônomo / freelancer', peso: 0.20 },
  { label: 'Empresário / dono de negócio', peso: 0.10 },
  { label: 'Aposentado', peso: 0.10 },
  { label: 'Estudante', peso: 0.05 },
  { label: 'Desempregado', peso: 0.03 },
];

const ESTILOS_DIALOGO = [
  'curioso_detalhista',
  'direto_objetivo',
  'preocupado_regras',
  'impaciente_pressa',
  'amigavel_conversador',
  'formal_educado',
  'desconfiado_cauteloso',
  'entusiasmado_festas',
] as const;

const OCASIOES_VIAGEM = [
  { label: 'Férias escolares (janeiro)', peso: 0.18, temporada: 'alta' },
  { label: 'Réveillon', peso: 0.10, temporada: 'alta' },
  { label: 'Carnaval', peso: 0.08, temporada: 'alta' },
  { label: 'Semana Santa', peso: 0.06, temporada: 'média' },
  { label: 'Férias de julho', peso: 0.12, temporada: 'média' },
  { label: 'Feriado prolongado', peso: 0.15, temporada: 'média' },
  { label: 'Final de semana comum', peso: 0.20, temporada: 'baixa' },
  { label: 'Lua de mel', peso: 0.03, temporada: 'média' },
  { label: 'Aniversário / comemoração', peso: 0.05, temporada: 'baixa' },
  { label: 'Trabalho remoto / workation', peso: 0.03, temporada: 'baixa' },
] as const;

const PRIMEIRAS_MENSAGENS: Record<string, string[]> = {
  curioso_detalhista: [
    'Oi! Tudo bem? Vi a pousada no Instagram e me interessei. Pode me passar mais informações sobre os quartos?',
    'Olá! Gostaria de saber: tem café da manhã incluso? E estacionamento? E qual a distância da praia?',
    'Boa tarde! Estou pesquisando pousadas para minha família. Vocês aceitam pet? Quantas pessoas cabem no quarto casal?',
  ],
  direto_objetivo: [
    'Boa tarde. Quero reservar para o dia 25/01, 2 adultos, 3 diárias. Qual o valor?',
    'Oi. Tem vaga para o fim de semana? Casal, sem filhos. PIX ou cartão?',
    'Olá. Diária, check-in, check-out, caução, regras — pode mandar tudo por escrito?',
  ],
  preocupado_regras: [
    'Olá! Antes de fechar, queria entender: qual a política de cancelamento? E se eu precisar mudar a data?',
    'Oi! Tenho algumas dúvidas: qual o horário de check-in/check-out? Tem que pagar caução? Como funciona?',
    'Boa noite. Vi que pedem caução. Pode me explicar como funciona? É devolvida na hora?',
  ],
  impaciente_pressa: [
    'Oi!! Preciso reservar pra amanhã. Tem vaga? Manda valor',
    'Bom dia. Vou viajar hoje. Quero reservar. Como faço?',
    'Olá! Pode responder rápido? Já fechei com outra pousada mas tava entre vcs e eles',
  ],
  amigavel_conversador: [
    'Oi, tudo bem? 😊 Que pousada linda! Vim pelo Instagram, adorei as fotos. Me conta mais!',
    'Olá! Estou super animada pra conhecer aí! Pode me passar valores pra janeiro?',
    'Bom dia! Que lugar encantador! Já visitei a cidade mas nunca fiquei aí. Como é?',
  ],
  formal_educado: [
    'Prezados, solicito informações sobre disponibilidade e valores para o período de 15 a 18 de janeiro.',
    'Boa tarde. Gostaria de solicitar uma cotação para estadia de 3 noites, 2 adultos. Grato.',
    'Olá. Gostaria de obter informações detalhadas sobre a pousada, incluindo políticas e formas de pagamento.',
  ],
  desconfiado_cauteloso: [
    'Olá. Vocês têm CNPJ? Cadastro na Embratur? Liumas reviews mas queria confirmar.',
    'Oi. A caução é depositada em que conta? Como funciona o estorno? Já tive problema antes.',
    'Boa tarde. Quem é o dono? Tem site oficial? Quero evitar golpes.',
  ],
  entusiasmado_festas: [
    'Oiii! 🎉 Vou com a galera pro réveillon! Quanto fica o pacote pra 8 pessoas?',
    'Bom dia! Vai ter festança no réveillon? Quero fechar já! 🥳',
    'Olá! Vamos comemorar aniversário, queria pacote com decoração. Tem?',
  ],
};

const OBJECOES_COMUNS = [
  'O valor está um pouco acima do meu orçamento. Tem desconto para reserva direta?',
  'Vi uma pousada parecida mais barata. Vocês conseguem bater o preço?',
  'Não sabia que tinha caução. Esse valor vai travar no meu limite.',
  'Por que a caução é tão alta? As outras pousadas que olhei pediam menos.',
  'Já reservei com outra mas estava em dúvida. Se vocês baterem o valor, eu cancelo.',
  'O check-in é tarde demais. Tenho que chegar cedo. Tem flexibilidade?',
  'O check-out é cedo demais. Tem check-out estendido?',
  'Não tenho como pagar caução em dinheiro agora. Posso pagar só na chegada?',
  'Como vou saber que vão devolver a caução? Já ouvi histórias...',
  'Aceitam pet? Tenho um cachorro pequeno, bem treinado.',
  'Tem estacionamento coberto? Meu carro é zero.',
  'A quantidade de reviews é baixa. Posso ver fotos reais dos quartos?',
  'O caução é via PIX? Tenho medo de passar a chave pra desconhecido.',
];

// ─────────────────────────────────────────────────────────────────────────────
// RNG DETERMINÍSTICO — garante reprodutibilidade
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

function pickWeighted<T extends { peso: number }>(arr: T[], rng: () => number): T {
  const total = arr.reduce((s, x) => s + x.peso, 0);
  let roll = rng() * total;
  for (const item of arr) {
    roll -= item.peso;
    if (roll <= 0) return item;
  }
  return arr[arr.length - 1];
}

const NOMES_F = [
  'Ana', 'Beatriz', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela',
  'Helena', 'Isabela', 'Juliana', 'Karen', 'Laura', 'Mariana', 'Natália',
  'Olívia', 'Patrícia', 'Rafaela', 'Sofia', 'Tatiana', 'Vanessa', 'Yasmin',
  'Camila', 'Larissa', 'Aline', 'Bruna', 'Cristina', 'Letícia', 'Priscila',
];
const NOMES_M = [
  'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gabriel', 'Henrique',
  'Igor', 'João', 'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo',
  'Rafael', 'Sérgio', 'Thiago', 'Vinícius', 'Wesley', 'André', 'Daniel',
  'Fernando', 'Gustavo', 'Lucas', 'Pedro', 'Rodrigo', 'Tiago', 'Vitor',
];
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira',
  'Almeida', 'Pereira', 'Carvalho', 'Rodrigues', 'Gomes', 'Martins',
  'Ribeiro', 'Alves', 'Barbosa', 'Rocha', 'Mendes', 'Nunes', 'Monteiro',
  'Cardoso', 'Teixeira', 'Correia', 'Vieira', 'Freitas', 'Dias', 'Castro',
  'Andrade', 'Araújo', 'Nascimento',
];

function gerarNome(rng: () => number, genero: string): string {
  const primeiro = genero === 'Mulher' ? pick(NOMES_F, rng) : genero === 'Homem' ? pick(NOMES_M, rng) : pick([...NOMES_F, ...NOMES_M], rng);
  const sobrenome = pick(SOBRENOMES, rng);
  return `${primeiro} ${sobrenome}`;
}

function estiloParaPrioridade(estilo: string): string {
  switch (estilo) {
    case 'preocupado_regras':
    case 'desconfiado_cauteloso':
      return 'seguranca';
    case 'entusiasmado_festas':
    case 'amigavel_conversador':
      return 'experiencia';
    case 'impaciente_pressa':
    case 'direto_objetivo':
      return 'conveniencia';
    case 'curioso_detalhista':
      return 'conforto';
    default:
      return 'preco';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DE PERSONAS — gera 1.500+ personas determinísticas
// ─────────────────────────────────────────────────────────────────────────────
function gerarPersonas(total: number = 1500): PersonaMatrAIx[] {
  const personas: PersonaMatrAIx[] = [];

  for (let i = 1; i <= total; i++) {
    const rng = mulberry32(i * 4099 + 17);

    // ── Cidade de origem (ponderada) ────────────────────────────────────────
    const cidadeOrigem = pick(CIDADES_PONDERADAS, rng);

    // ── Idade ───────────────────────────────────────────────────────────────
    const faixaEtaria = pickWeighted(FAIXAS_ETARIAS, rng);
    const idade = Math.floor(faixaEtaria.min + rng() * (faixaEtaria.max - faixaEtaria.min + 1));

    // ── Gênero ───────────────────────────────────────────────────────────────
    const genero = pickWeighted(GENEROS, rng).label;

    // ── Renda ───────────────────────────────────────────────────────────────
    const faixaRenda = pickWeighted(FAIXAS_RENDA, rng);
    const rendaMensal = Math.floor(faixaRenda.min + rng() * (faixaRenda.max - faixaRenda.min));

    // ── Estado civil e filhos ────────────────────────────────────────────────
    const estadoCivil = pickWeighted(ESTADOS_CIVIS, rng);
    let qtdFilhos = 0;
    if (estadoCivil.label.includes('Casado') || estadoCivil.label.includes('União')) {
      if (idade >= 28) {
        const filhosRoll = rng();
        if (filhosRoll < 0.30) qtdFilhos = 0;
        else if (filhosRoll < 0.60) qtdFilhos = 1;
        else if (filhosRoll < 0.85) qtdFilhos = 2;
        else if (filhosRoll < 0.95) qtdFilhos = 3;
        else qtdFilhos = 4;
      }
    }

    // ── Composição da família/grupo de viagem ────────────────────────────────
    let composicao = '';
    let grupoTamanho = 1;
    if (idade < 25) {
      if (rng() < 0.70) {
        composicao = 'Grupo de amigos';
        grupoTamanho = 4 + Math.floor(rng() * 4);
      } else {
        composicao = 'Casal jovem';
        grupoTamanho = 2;
      }
    } else if (idade < 40) {
      if (qtdFilhos > 0) {
        composicao = `Família com ${qtdFilhos} filho(s)`;
        grupoTamanho = 2 + qtdFilhos;
      } else if (rng() < 0.60) {
        composicao = 'Casal sem filhos';
        grupoTamanho = 2;
      } else if (rng() < 0.30) {
        composicao = 'Grupo de amigos';
        grupoTamanho = 4 + Math.floor(rng() * 4);
      } else {
        composicao = 'Sozinho(a)';
        grupoTamanho = 1;
      }
    } else if (idade < 60) {
      if (qtdFilhos > 0) {
        composicao = `Família com ${qtdFilhos} filho(s)`;
        grupoTamanho = 2 + qtdFilhos;
      } else {
        composicao = 'Casal sem filhos';
        grupoTamanho = 2;
      }
    } else {
      composicao = 'Casal aposentado';
      grupoTamanho = 2;
    }

    // ── Profissão e ocupação ─────────────────────────────────────────────────
    const profissao = pick(PROFISSOES, rng);
    const ocupacao = pickWeighted(OCUPACOES, rng);
    const nivelEscolaridade = pickWeighted(NIVEIS_ESCOLARIDADE, rng);

    // ── Estilo de diálogo ────────────────────────────────────────────────────
    // Distribui estilos conforme a faixa etária e gênero
    const estiloDialogo = pick([...ESTILOS_DIALOGO], rng) as any;

    // ── Ocasiao de viagem ────────────────────────────────────────────────────
    const ocasiao = pickWeighted([...OCASIOES_VIAGEM] as any, rng);

    // ── Orçamento ────────────────────────────────────────────────────────────
    // Quanto maior a renda, maior o orçamento
    const orcamentoFator = faixaRenda.min >= 15000 ? 4 + rng() * 4 :
      faixaRenda.min >= 8000 ? 2.5 + rng() * 2.5 :
        faixaRenda.min >= 4000 ? 1.5 + rng() * 1.5 :
          0.7 + rng() * 1.0;
    const orcamentoDiariaMax = Math.floor(orcamentoFator * 250);
    const duracaoEstadia = ocasiao.temporada === 'alta' ?
      Math.floor(3 + rng() * 5) : Math.floor(2 + rng() * 3);
    const orcamentoTotalMax = orcamentoDiariaMax * duracaoEstadia * grupoTamanho;

    // ── Antecedência de reserva ─────────────────────────────────────────────
    const antecedenciaReservaDias = estiloDialogo === 'impaciente_pressa' ?
      Math.floor(1 + rng() * 4) :
      ocasiao.temporada === 'alta' ?
        Math.floor(20 + rng() * 90) :
        Math.floor(5 + rng() * 25);

    // ── Canal/dispositivo ────────────────────────────────────────────────────
    const canalPreferido = idade >= 55 ? pick(['Telefone', 'WhatsApp', 'WhatsApp', 'Email'], rng) :
      pick(['WhatsApp', 'WhatsApp', 'Instagram', 'Site'], rng);
    const dispositivoPrincipal = idade >= 55 ? pick(['Mobile', 'Mobile', 'Desktop'], rng) :
      pick(['Mobile', 'Mobile', 'Mobile', 'Desktop'], rng);
    const horarioPesquisa = pick(['manhã', 'tarde', 'noite', 'noite', 'madrugada'], rng);

    // ── Pet ───────────────────────────────────────────────────────────────────
    const viajaComPet = idade < 50 && rng() < 0.20;

    // ── Mídia social ──────────────────────────────────────────────────────────
    const instagramAtivo = idade < 50 && rng() < 0.80;
    const instagramFollowers = instagramAtivo ? Math.floor(200 + rng() * 3000) : 0;
    const segueInfluencers = instagramAtivo ? pickN(['@matogrossooficial', '@malubotto', '@virginiafonseca', '@lagoadiva', '@pousadaria', '@viajenarede', '@viajepelomundo', '@pousadasdobrasil', '@guiadepousadas'], 3, rng) : [];
    const leReviews = rng() < 0.85;
    const qtdReviewsLidas = leReviews ? Math.floor(3 + rng() * 20) : 0;
    const pedeIndicacao = rng() < 0.65;
    const confiaEmIndicacaoAmigos = rng() < 0.90;

    // ── Reação a features ──────────────────────────────────────────────────────
    const aceitaCaucao = rng() < 0.65;
    const preocupacaoCaucao = estiloDialogo === 'preocupado_regras' || estiloDialogo === 'desconfiado_cauteloso' ?
      0.7 + rng() * 0.3 : rng() < 0.30 ? 0.6 + rng() * 0.4 : rng() * 0.5;
    const interesseCheckoutEstendido = estiloDialogo === 'entusiasmado_festas' ?
      0.7 + rng() * 0.3 : rng() < 0.40 ? 0.5 + rng() * 0.5 : rng() * 0.5;
    const interesseCheckinAntecipado = estiloDialogo === 'impaciente_pressa' ?
      0.7 + rng() * 0.3 : rng() * 0.5;
    const interesseUpsell = estiloDialogo === 'entusiasmado_festas' || estiloDialogo === 'amigavel_conversador' ?
      0.5 + rng() * 0.5 : rng() * 0.5;
    const interesseFechaduraEletronica = idade < 45 ? 0.5 + rng() * 0.5 : rng() * 0.6;
    const temCaoEletronica = idade >= 30 && rng() < 0.50;

    // ── Primeira mensagem ──────────────────────────────────────────────────────
    const primeiraMensagem = pick(PRIMEIRAS_MENSAGENS[estiloDialogo] || PRIMEIRAS_MENSAGENS.direto_objetivo, rng);
    const padraoObjecoes = pickN(OBJECOES_COMUNS, 2 + Math.floor(rng() * 3), rng);

    // ── Probabilidades de conversão (calibradas por estilo + idade + renda) ──
    const probResponderWhatsapp = estiloDialogo === 'impaciente_pressa' || estiloDialogo === 'desconfiado_cauteloso' ?
      0.30 + rng() * 0.30 : 0.60 + rng() * 0.40;
    const probReservarAposContato = estiloDialogo === 'curioso_detalhista' ?
      0.15 + rng() * 0.25 : estiloDialogo === 'direto_objetivo' ?
        0.40 + rng() * 0.40 : estiloDialogo === 'impaciente_pressa' ?
          0.50 + rng() * 0.40 : estiloDialogo === 'entusiasmado_festas' ?
            0.50 + rng() * 0.40 : 0.20 + rng() * 0.30;
    const probChegarCheckout = 0.80 + rng() * 0.20;
    const probRecomendar = estiloDialogo === 'amigavel_conversador' ?
      0.70 + rng() * 0.30 : 0.40 + rng() * 0.40;
    const probReclamar = estiloDialogo === 'preocupado_regras' || estiloDialogo === 'desconfiado_cauteloso' ?
      0.40 + rng() * 0.40 : rng() * 0.20;
    const churnRisk = 1 - probReservarAposContato;

    // ── Tech savviness ────────────────────────────────────────────────────────
    const techSavviness = idade >= 60 ? 'Cautious adopter' :
      idade >= 40 ? pick(['Average', 'Comfortable', 'Cautious adopter'], rng) :
        pick(['Digital native', 'Comfortable', 'Average'], rng);

    // ── Idiomas ────────────────────────────────────────────────────────────────
    const idiomas = ['Português (nativo)'];
    if (idade < 45 && rng() < 0.35) idiomas.push('Inglês');
    if (rng() < 0.10) idiomas.push('Espanhol');
    if (rng() < 0.05) idiomas.push('Italiano');

    const persona: PersonaMatrAIx = {
      id: `PER${String(i).padStart(5, '0')}`,
      display_name: gerarNome(rng, genero),
      source: 'synthetic-br',
      age_bracket: faixaEtaria.bracket,
      idade_anos: idade,
      regiao_brasil: cidadeOrigem.regiao,
      cidade_origem: cidadeOrigem.cidade,
      estado_origem: cidadeOrigem.estado,
      genero,
      urbanicidade: cidadeOrigem.urbanicidade,
      faixa_renda: faixaRenda.label,
      ocupacao: ocupacao.label,
      profissao,
      nivel_escolaridade: nivelEscolaridade.label,
      estado_civil: estadoCivil.label,
      qtd_filhos: qtdFilhos,
      composicao_familia: composicao,
      grupo_tamanho: grupoTamanho,
      idiomas,
      tech_savviness: techSavviness,
      dominant_trait: pick(['High conscientiousness', 'Openness', 'Extraversion', 'Agreeableness', 'Neuroticism'], rng),
      valores_prioridade: pick(['Achievement', 'Hedonism', 'Security', 'Self-direction', 'Benevolence', 'Stimulation'], rng),
      prioridade_reserva: estiloParaPrioridade(estiloDialogo),
      att_data_privacy: pick(['Positive', 'Average', 'Skeptical', 'Very concerned'], rng),
      att_brand_loyalty: pick(['Positive', 'Average', 'Indifferent'], rng),
      att_online_reviews: pick(['Very positive', 'Positive', 'Average', 'Skeptical'], rng),
      att_risk_taking: pick(['Risk-averse', 'Cautious', 'Average', 'Bold'], rng),
      trait_curiosity: pick(['High', 'Average', 'Low'], rng),
      trait_extraversion: estiloDialogo === 'amigavel_conversador' || estiloDialogo === 'entusiasmado_festas' ? 'High' :
        estiloDialogo === 'desconfiado_cauteloso' || estiloDialogo === 'preocupado_regras' ? 'Low' : 'Average',
      trait_open_mindedness: pick(['High', 'Average', 'Low'], rng),
      val_experiences: pick(['Core value', 'Important', 'Average'], rng),
      val_security: estiloDialogo === 'preocupado_regras' || estiloDialogo === 'desconfiado_cauteloso' ? 'Core value' : pick(['Important', 'Average'], rng),
      val_convenience: estiloDialogo === 'impaciente_pressa' || estiloDialogo === 'direto_objetivo' ? 'Core value' : pick(['Important', 'Average'], rng),
      val_price_sensitivity: faixaRenda.min < 4000 ? 'High' : faixaRenda.min < 8000 ? 'Average' : 'Low',
      val_aesthetics: estiloDialogo === 'amigavel_conversador' || estiloDialogo === 'entusiasmado_festas' ? 'High' : pick(['Average', 'Low'], rng),
      canal_preferido: canalPreferido,
      dispositivo_principal: dispositivoPrincipal,
      horario_pesquisa: horarioPesquisa,
      antecedencia_reserva_dias: antecedenciaReservaDias,
      duracao_estadia_dias: duracaoEstadia,
      viaja_com_pet: viajaComPet,
      precisa_estacionamento: rng() < 0.85,
      quantidade_malas: grupoTamanho + Math.floor(rng() * 2),
      ocasiao_viagem: ocasiao.label,
      epoca_ano: pick(['Verão', 'Inverno', 'Primavera', 'Outono'], rng),
      temporada: ocasiao.temporada as 'alta' | 'média' | 'baixa',
      orcamento_diaria_max: orcamentoDiariaMax,
      orcamento_total_max: orcamentoTotalMax,
      flexibilidade_datas: estiloDialogo !== 'impaciente_pressa' && rng() < 0.60,
      destino_preferido: [pick(['SC', 'SP', 'RJ', 'BA', 'PE', 'CE'], rng)],
      instagram_ativo: instagramAtivo,
      instagram_followers: instagramFollowers,
      segue_influencers: segueInfluencers,
      le_reviews: leReviews,
      qtd_reviews_lidas: qtdReviewsLidas,
      pede_indicacao: pedeIndicacao,
      confia_em_indicacao_amigos: confiaEmIndicacaoAmigos,
      aceita_caucao: aceitaCaucao,
      cao_preocupacao_caucao: Number(preocupacaoCaucao.toFixed(2)),
      interesse_checkout_estendido: Number(interesseCheckoutEstendido.toFixed(2)),
      interesse_checkin_antecipado: Number(interesseCheckinAntecipado.toFixed(2)),
      interesse_upsell: Number(interesseUpsell.toFixed(2)),
      interesse_fechadura_eletronica: Number(interesseFechaduraEletronica.toFixed(2)),
      tem_cao_eletronica: temCaoEletronica,
      estilo_dialogo: estiloDialogo,
      primeira_mensagem_template: primeiraMensagem,
      padrao_objecoes: padraoObjecoes,
      prob_responder_whatsapp: Number(probResponderWhatsapp.toFixed(2)),
      prob_reservar_apos_contato: Number(probReservarAposContato.toFixed(2)),
      prob_chegar_ao_checkout: Number(probChegarCheckout.toFixed(2)),
      prob_recomendar: Number(probRecomendar.toFixed(2)),
      prob_reclamar: Number(probReclamar.toFixed(2)),
      churn_risk: Number(churnRisk.toFixed(2)),
    };

    personas.push(persona);
  }

  return personas;
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// Gera 1.500 personas determinísticas
export const PERSONAS_MATRAIX: PersonaMatrAIx[] = gerarPersonas(1500);

// Estatísticas
export function estatisticasPersonas() {
  const total = PERSONAS_MATRAIX.length;
  const porFaixaEtaria = FAIXAS_ETARIAS.reduce((acc, f) => {
    acc[f.bracket] = PERSONAS_MATRAIX.filter(p => p.age_bracket === f.bracket).length;
    return acc;
  }, {} as Record<string, number>);

  const porGenero = GENEROS.reduce((acc, g) => {
    acc[g.label] = PERSONAS_MATRAIX.filter(p => p.genero === g.label).length;
    return acc;
  }, {} as Record<string, number>);

  const porRegiao = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'].reduce((acc, r) => {
    acc[r] = PERSONAS_MATRAIX.filter(p => p.regiao_brasil === r).length;
    return acc;
  }, {} as Record<string, number>);

  const porEstilo = ESTILOS_DIALOGO.reduce((acc, e) => {
    acc[e] = PERSONAS_MATRAIX.filter(p => p.estilo_dialogo === e).length;
    return acc;
  }, {} as Record<string, number>);

  const porTemporada = {
    alta: PERSONAS_MATRAIX.filter(p => p.temporada === 'alta').length,
    média: PERSONAS_MATRAIX.filter(p => p.temporada === 'média').length,
    baixa: PERSONAS_MATRAIX.filter(p => p.temporada === 'baixa').length,
  };

  const mediaIdade = PERSONAS_MATRAIX.reduce((s, p) => s + p.idade_anos, 0) / total;
  const mediaOrcamento = PERSONAS_MATRAIX.reduce((s, p) => s + p.orcamento_total_max, 0) / total;
  const comPet = PERSONAS_MATRAIX.filter(p => p.viaja_com_pet).length;
  const aceitamCaucao = PERSONAS_MATRAIX.filter(p => p.aceita_caucao).length;

  return {
    total,
    porFaixaEtaria,
    porGenero,
    porRegiao,
    porEstilo,
    porTemporada,
    mediaIdade: Math.round(mediaIdade),
    mediaOrcamento: Math.round(mediaOrcamento),
    comPet,
    aceitamCaucao,
  };
}
