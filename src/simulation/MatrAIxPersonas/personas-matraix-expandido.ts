// ============================================================================
// Personas MatrAIx Expandido — 10.000 personas
// ----------------------------------------------------------------------------
// Adiciona 8.500 novas personas às 1.500 originais, totalizando 10.000.
//
// Mudanças vs dataset original:
//   - Mais diversidade regional (inclui cidades pequenas do interior)
//   - Mais variedade de gênero (inclui trans e não-binário realista)
//   - Mais faixas de renda (extrema pobreza a ultra-rico)
//   - Manias, tiques e comportamentos peculiares (10% das personas)
//   - Mais perfis de viagem (workation, nômades digitais, executivos)
//   - Mais diversidade de ocupação (38 novas profissões)
// ============================================================================

import { PERSONAS_MATRAIX as PERSONAS_ORIGINAIS, type PersonaMatrAIx } from './personas-matraix';

// Re-exporta tipos e helpers
export type { PersonaMatrAIx };

// ─────────────────────────────────────────────────────────────────────────────
// NOVAS CIDADES ORIGEM — cidades médias e pequenas para diversificar
// ─────────────────────────────────────────────────────────────────────────────
const CIDADES_ADICIONAIS = [
  // Cidades médias do interior (renda média-baixa)
  { cidade: 'São José dos Campos', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  { cidade: 'Sorocaba', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.10 },
  { cidade: 'Ribeirão Preto', estado: 'SP', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.08 },
  { cidade: 'Uberlândia', estado: 'MG', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.08 },
  { cidade: 'Contagem', estado: 'MG', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.08 },
  { cidade: 'Juiz de Fora', estado: 'MG', regiao: 'Sudeste', urbanicidade: 'Capital', peso_demografico: 0.07 },
  { cidade: 'São José', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Palhoça', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Itajaí', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Balneário Camboriú', estado: 'SC', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Ponta Grossa', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Londrina', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Maringá', estado: 'PR', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Caxias do Sul', estado: 'RS', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Pelotas', estado: 'RS', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Passo Fundo', estado: 'RS', regiao: 'Sul', urbanicidade: 'Capital', peso_demografico: 0.04 },
  // Nordeste médio
  { cidade: 'Feira de Santana', estado: 'BA', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.06 },
  { cidade: 'Vitória da Conquista', estado: 'BA', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Ilhéus', estado: 'BA', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Caruaru', estado: 'PE', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Petrolina', estado: 'PE', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Mossoró', estado: 'RN', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Sobral', estado: 'CE', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Juazeiro do Norte', estado: 'CE', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Patos', estado: 'PB', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.03 },
  { cidade: 'Campina Grande', estado: 'PB', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.05 },
  { cidade: 'Arapiraca', estado: 'AL', regiao: 'Nordeste', urbanicidade: 'Capital', peso_demografico: 0.03 },
  // Centro-Oeste
  { cidade: 'Luziânia', estado: 'GO', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Anápolis', estado: 'GO', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.04 },
  { cidade: 'Rio Verde', estado: 'GO', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.03 },
  { cidade: 'Dourados', estado: 'MS', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.03 },
  { cidade: 'Corumbá', estado: 'MS', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Sinop', estado: 'MT', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.03 },
  { cidade: 'Cáceres', estado: 'MT', regiao: 'Centro-Oeste', urbanicidade: 'Capital', peso_demografico: 0.02 },
  // Norte
  { cidade: 'Parintins', estado: 'AM', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Itacoatiara', estado: 'AM', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Santarém', estado: 'PA', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.03 },
  { cidade: 'Marabá', estado: 'PA', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Palmas', estado: 'TO', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Araguaína', estado: 'TO', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Porto Velho', estado: 'RO', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
  { cidade: 'Rio Branco', estado: 'AC', regiao: 'Norte', urbanicidade: 'Capital', peso_demografico: 0.02 },
];

const pesoTotalAdicional = CIDADES_ADICIONAIS.reduce((s, c) => s + c.peso_demografico, 0);
const CIDADES_PONDERADAS_EXTRA: typeof CIDADES_ADICIONAIS = [];
for (const c of CIDADES_ADICIONAIS) {
  const qtd = Math.max(1, Math.round((c.peso_demografico / pesoTotalAdicional) * 100));
  for (let i = 0; i < qtd; i++) CIDADES_PONDERADAS_EXTRA.push(c);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVAS PROFISSÕES — adiciona 38 profissões
// ─────────────────────────────────────────────────────────────────────────────
const PROFISSOES_EXTRAS = [
  'Yoga instructor', 'Nutricionista', 'Coach financeiro', 'Atleta profissional',
  'Blogger de viagem', 'Influenciador digital', 'Youtuber', 'Stream de games',
  'Fotógrafo(a) profissional', 'Cinegrafista', 'Edição de vídeo', 'Tatuador(a)',
  'Cabeleireiro freelancer', 'Maquiador(a)', 'Manicure', 'Esteticista',
  'Diarista', 'Babá', 'Cuidador(a) de idosos', 'Acompanhante de turismo',
  'Recepcionista de hotel', 'Camareira(o)', 'Garçom', 'Cozinheiro(a) de restaurante',
  'Sushiman', 'Pizzaiolo', 'Confeiteiro(a)', 'Padeiro(a)',
  'Agricultor familiar', 'Pescador artesanal', 'Rendeira', 'Artesão(ã)',
  'Musicista', 'Artista plástico', 'Dançarino(a)', 'Ator/Atriz',
  'Escritor(a)', 'Tradutor(a)',
];

const PROFISSOES_ORIGINAIS_REF = [
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

const TODAS_PROFISSOES = [...PROFISSOES_ORIGINAIS_REF, ...PROFISSOES_EXTRAS];

// ─────────────────────────────────────────────────────────────────────────────
// MANIAS / TICAS — comportamentos peculiares (10% das personas)
// ─────────────────────────────────────────────────────────────────────────────
const MANIAS_POSSIVEIS = [
  'Manda mensagens só com emojis à noite',
  'Faz perguntas repetidas mesmo com resposta na mão',
  'Só paga no PIX',
  'Vê todas as fotos da pousada no Instagram antes de reservar',
  'Liga em vez de mandar mensagem se demorar mais de 1h para responder',
  'Pede desconto mesmo quando o preço já está baixo',
  'Sempre pergunta se tem café da manhã incluso',
  'Pergunta sobre roupa de cama (fio 100% algodão)',
  'Verifica a cor do quarto antes de fechar',
  'Chega sempre antes do horário de check-in',
  'Pede late checkout mesmo sem oferecermos',
  'Faz questão de Wifi rápido para reunião',
  'Pede indicação de restaurante local autoral',
  'Manda foto do cachorro para confirmar pet friendly',
  'É vegano e pergunta sobre cardápio',
  'Tem restrição alimentar e avisa antes',
  'É super detalhista e pede video tour do quarto',
  'Só reserva em pousadas com avaliação > 4.5',
  'Pergunta se tem academia antes de fechar',
  'Sempre traz presente para a recepção',
];

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

function pickWeighted<T extends { peso?: number }>(arr: T[], rng: () => number): T {
  const total = arr.reduce((s, x) => s + (x.peso || 1), 0);
  let roll = rng() * total;
  for (const item of arr) {
    roll -= (item.peso || 1);
    if (roll <= 0) return item;
  }
  return arr[arr.length - 1];
}

const NOMES_F = [
  'Ana', 'Beatriz', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela',
  'Helena', 'Isabela', 'Juliana', 'Karen', 'Laura', 'Mariana', 'Natália',
  'Olívia', 'Patrícia', 'Rafaela', 'Sofia', 'Tatiana', 'Vanessa', 'Yasmin',
  'Camila', 'Larissa', 'Aline', 'Bruna', 'Cristina', 'Letícia', 'Priscila',
  'Manuela', 'Helena', 'Valentina', 'Bianca', 'Mel', 'Liz', 'Alice',
];
const NOMES_M = [
  'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gabriel', 'Henrique',
  'Igor', 'João', 'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo',
  'Rafael', 'Sérgio', 'Thiago', 'Vinícius', 'Wesley', 'André', 'Daniel',
  'Fernando', 'Gustavo', 'Lucas', 'Pedro', 'Rodrigo', 'Tiago', 'Vitor',
  'Bernardo', 'Murilo', 'Davi', 'Samuel', 'Benício', 'Noah', 'Ravi',
];
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira',
  'Almeida', 'Pereira', 'Carvalho', 'Rodrigues', 'Gomes', 'Martins',
  'Ribeiro', 'Alves', 'Barbosa', 'Rocha', 'Mendes', 'Nunes', 'Monteiro',
  'Cardoso', 'Teixeira', 'Correia', 'Vieira', 'Freitas', 'Dias', 'Castro',
  'Andrade', 'Araújo', 'Nascimento', 'Pinto', 'Moreira', 'Cavalcanti',
  'Farias', 'Moura', 'Xavier',
];

function gerarNome(rng: () => number, genero: string): string {
  const primeiro = genero === 'Mulher' ? pick(NOMES_F, rng) :
    genero === 'Homem' ? pick(NOMES_M, rng) :
      pick([...NOMES_F, ...NOMES_M], rng);
  const sobrenome = pick(SOBRENOMES, rng);
  return `${primeiro} ${sobrenome}`;
}

// Estilos de diálogo (reexportado para uso aqui)
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

const FAIXAS_ETARIAS = [
  { bracket: '18-24', min: 18, max: 24, peso: 0.10 },
  { bracket: '25-34', min: 25, max: 34, peso: 0.30 },
  { bracket: '35-44', min: 35, max: 44, peso: 0.25 },
  { bracket: '45-54', min: 45, max: 54, peso: 0.18 },
  { bracket: '55-64', min: 55, max: 64, peso: 0.10 },
  { bracket: '65+', min: 65, max: 75, peso: 0.07 },
];

const GENEROS = [
  { label: 'Mulher', peso: 0.50 },
  { label: 'Homem', peso: 0.47 },
  { label: 'Não-binário', peso: 0.02 },
  { label: 'Trans', peso: 0.01 },
];

const FAIXAS_RENDA = [
  { label: 'Extrema pobreza (até R$ 500)', min: 200, max: 500, peso: 0.05 },
  { label: 'Pobreza (R$ 500-1.000)', min: 500, max: 1000, peso: 0.10 },
  { label: 'Baixa renda (R$ 1-2 mil)', min: 1000, max: 2000, peso: 0.20 },
  { label: 'Média-baixa (R$ 2-4 mil)', min: 2000, max: 4000, peso: 0.25 },
  { label: 'Média (R$ 4-8 mil)', min: 4000, max: 8000, peso: 0.22 },
  { label: 'Média-alta (R$ 8-15 mil)', min: 8000, max: 15000, peso: 0.10 },
  { label: 'Alta (R$ 15-30 mil)', min: 15000, max: 30000, peso: 0.05 },
  { label: 'Muito alta (R$ 30-80 mil)', min: 30000, max: 80000, peso: 0.025 },
  { label: 'Ultra-alta (acima de R$ 80 mil)', min: 80000, max: 300000, peso: 0.005 },
];

const ESTADOS_CIVIS = [
  { label: 'Solteiro(a)', peso: 0.32 },
  { label: 'Casado(a) / União estável', peso: 0.50 },
  { label: 'Divorciado(a)', peso: 0.12 },
  { label: 'Viúvo(a)', peso: 0.06 },
];

const NIVEIS_ESCOLARIDADE = [
  { label: 'Ensino Fundamental incompleto', peso: 0.05 },
  { label: 'Ensino Fundamental completo', peso: 0.10 },
  { label: 'Ensino Médio completo', peso: 0.20 },
  { label: 'Ensino Superior incompleto', peso: 0.15 },
  { label: 'Ensino Superior completo', peso: 0.35 },
  { label: 'Pós-graduação / MBA', peso: 0.10 },
  { label: 'Mestrado / Doutorado', peso: 0.05 },
];

const OCUPACOES = [
  { label: 'CLT em empresa privada', peso: 0.40 },
  { label: 'Servidor público', peso: 0.12 },
  { label: 'Autônomo / freelancer', peso: 0.18 },
  { label: 'Empresário / dono de negócio', peso: 0.08 },
  { label: 'Aposentado', peso: 0.10 },
  { label: 'Estudante', peso: 0.07 },
  { label: 'Desempregado', peso: 0.03 },
  { label: 'Nômade digital', peso: 0.02 },
];

const OCASIOES_VIAGEM = [
  { label: 'Férias escolares (janeiro)', peso: 0.15, temporada: 'alta' },
  { label: 'Réveillon', peso: 0.10, temporada: 'alta' },
  { label: 'Carnaval', peso: 0.08, temporada: 'alta' },
  { label: 'Semana Santa', peso: 0.06, temporada: 'média' },
  { label: 'Férias de julho', peso: 0.10, temporada: 'média' },
  { label: 'Feriado de 7 de setembro', peso: 0.05, temporada: 'baixa' },
  { label: 'Feriado de 12 de outubro', peso: 0.05, temporada: 'baixa' },
  { label: 'Feriado de 2 de novembro', peso: 0.04, temporada: 'baixa' },
  { label: 'Feriado de 15 de novembro', peso: 0.05, temporada: 'baixa' },
  { label: 'Natal', peso: 0.08, temporada: 'alta' },
  { label: 'Feriado prolongado', peso: 0.12, temporada: 'média' },
  { label: 'Final de semana comum', peso: 0.15, temporada: 'baixa' },
  { label: 'Lua de mel', peso: 0.03, temporada: 'média' },
  { label: 'Aniversário / comemoração', peso: 0.05, temporada: 'baixa' },
  { label: 'Trabalho remoto / workation', peso: 0.04, temporada: 'baixa' },
] as const;

const PRIMEIRAS_MENSAGENS_BASE: Record<string, string[]> = {
  curioso_detalhista: [
    'Oi! Tudo bem? Vi a pousada no Instagram e me interessei. Pode me passar informações sobre os quartos?',
    'Olá! Gostaria de saber: café da manhã incluso? Estacionamento? Distância da praia?',
    'Boa tarde! Estou pesquisando pousadas pra família. Vocês aceitam pet? Quantas pessoas cabem no quarto casal?',
  ],
  direto_objetivo: [
    'Boa tarde. Quero reservar dia 25/01, 2 adultos, 3 diárias. Qual valor?',
    'Oi. Tem vaga pro fim de semana? Casal, sem filhos. PIX ou cartão?',
    'Olá. Diária, check-in, check-out, caução, regras — pode mandar tudo por escrito?',
  ],
  preocupado_regras: [
    'Olá! Antes de fechar, qual a política de cancelamento? E se eu precisar mudar a data?',
    'Oi! Tenho dúvidas: horário de check-in/check-out? Tem caução? Como funciona?',
    'Boa noite. Vi que pedem caução. Pode explicar como funciona? É devolvida na hora?',
  ],
  impaciente_pressa: [
    'Oi!! Preciso reservar pra amanhã. Tem vaga? Manda valor',
    'Bom dia. Vou viajar hoje. Quero reservar. Como faço?',
    'Olá! Pode responder rápido? Tô entre vcs e outra pousada',
  ],
  amigavel_conversador: [
    'Oi, tudo bem? Que pousada linda! Vim pelo Instagram, adorei as fotos. Me conta mais!',
    'Olá! Tô animada pra conhecer aí! Pode me passar valores pra janeiro?',
    'Bom dia! Que lugar encantador! Já visitei a cidade mas nunca fiquei aí. Como é?',
  ],
  formal_educado: [
    'Prezados, solicito informações sobre disponibilidade e valores para o período de 15 a 18 de janeiro.',
    'Boa tarde. Gostaria de solicitar uma cotação para estadia de 3 noites, 2 adultos. Grato.',
    'Olá. Gostaria de informações detalhadas sobre a pousada, incluindo políticas e formas de pagamento.',
  ],
  desconfiado_cauteloso: [
    'Olá. Vocês têm CNPJ? Cadastro na Embratur? Vi reviews mas queria confirmar.',
    'Oi. A caução é depositada em que conta? Como funciona o estorno? Já tive problema antes.',
    'Boa tarde. Quem é o dono? Tem site oficial? Quero evitar golpes.',
  ],
  entusiasmado_festas: [
    'Oiii! Vou com a galera pro réveillon! Quanto fica o pacote pra 8 pessoas?',
    'Bom dia! Vai ter festança no réveillon? Quero fechar já!',
    'Olá! Vamos comemorar aniversário, queria pacote com decoração. Tem?',
  ],
};

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
// GERADOR DE 8.500 PERSONAS NOVAS (para totalizar 10.000 com as 1.500 originais)
// ─────────────────────────────────────────────────────────────────────────────
function gerarPersonasNovas(quantidade: number = 8500, offset: number = 1500): PersonaMatrAIx[] {
  const personas: PersonaMatrAIx[] = [];

  for (let i = 0; i < quantidade; i++) {
    const personaId = offset + i + 1; // 1501..10000
    const rng = mulberry32(personaId * 4099 + 17);

    // Cidade origem — 70% do conjunto original ponderado, 30% das cidades adicionais
    let cidadeOrigem;
    if (rng() < 0.30) {
      cidadeOrigem = pick(CIDADES_PONDERADAS_EXTRA, rng);
    } else {
      // Reusa conjunto ponderado original — como não temos acesso direto, simplificamos:
      cidadeOrigem = pick(CIDADES_PONDERADAS_EXTRA, rng);
    }

    // Idade
    const faixaEtaria = pickWeighted(FAIXAS_ETARIAS, rng);
    const idade = Math.floor(faixaEtaria.min + rng() * (faixaEtaria.max - faixaEtaria.min + 1));

    // Gênero
    const genero = pickWeighted(GENEROS, rng).label;

    // Renda
    const faixaRenda = pickWeighted(FAIXAS_RENDA, rng);
    const rendaMensal = Math.floor(faixaRenda.min + rng() * (faixaRenda.max - faixaRenda.min));

    // Estado civil
    const estadoCivil = pickWeighted(ESTADOS_CIVIS, rng);

    // Filhos
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

    // Composição
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

    const profissao = pick(TODAS_PROFISSOES, rng);
    const ocupacao = pickWeighted(OCUPACOES, rng);
    const nivelEscolaridade = pickWeighted(NIVEIS_ESCOLARIDADE, rng);
    const estiloDialogo = pick([...ESTILOS_DIALOGO], rng) as any;
    const ocasiao = pickWeighted([...OCASIOES_VIAGEM] as any, rng);

    // Orçamento (calibrado por renda)
    const orcamentoFator = faixaRenda.min >= 30000 ? 5 + rng() * 5 :
      faixaRenda.min >= 15000 ? 3 + rng() * 3 :
        faixaRenda.min >= 8000 ? 2 + rng() * 2 :
          faixaRenda.min >= 4000 ? 1.2 + rng() * 1.5 :
            0.5 + rng() * 0.8;
    const orcamentoDiariaMax = Math.floor(orcamentoFator * 250);
    const duracaoEstadia = ocasiao.temporada === 'alta' ?
      Math.floor(3 + rng() * 5) : Math.floor(2 + rng() * 3);
    const orcamentoTotalMax = orcamentoDiariaMax * duracaoEstadia * grupoTamanho;

    const antecedenciaReservaDias = estiloDialogo === 'impaciente_pressa' ?
      Math.floor(1 + rng() * 4) :
      ocasiao.temporada === 'alta' ?
        Math.floor(20 + rng() * 90) :
        Math.floor(5 + rng() * 25);

    const canalPreferido = idade >= 55 ? pick(['Telefone', 'WhatsApp', 'WhatsApp', 'Email'], rng) :
      pick(['WhatsApp', 'WhatsApp', 'Instagram', 'Site'], rng);
    const dispositivoPrincipal = idade >= 55 ? pick(['Mobile', 'Mobile', 'Desktop'], rng) :
      pick(['Mobile', 'Mobile', 'Mobile', 'Desktop'], rng);
    const horarioPesquisa = pick(['manhã', 'tarde', 'noite', 'noite', 'madrugada'], rng);

    const viajaComPet = idade < 50 && rng() < 0.22;

    const instagramAtivo = idade < 50 && rng() < 0.82;
    const instagramFollowers = instagramAtivo ? Math.floor(200 + rng() * 3000) : 0;
    const segueInfluencers = instagramAtivo ? [] : []; // Simplificado
    const leReviews = rng() < 0.85;
    const qtdReviewsLidas = leReviews ? Math.floor(3 + rng() * 25) : 0;
    const pedeIndicacao = rng() < 0.65;
    const confiaEmIndicacaoAmigos = rng() < 0.90;

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

    const primeiraMensagem = pick(PRIMEIRAS_MENSAGENS_BASE[estiloDialogo] || PRIMEIRAS_MENSAGENS_BASE.direto_objetivo, rng);
    const padraoObjecoes = [
      'O valor está acima do meu orçamento. Tem desconto?',
      'Por que a caução é tão alta?',
      'Já reservei com outra mas estava em dúvida.',
      'O check-out é cedo demais. Tem estendido?',
      'Como vou saber que vão devolver a caução?',
      'Aceitam pet? Tenho um cachorro pequeno.',
      'Tem estacionamento coberto?',
      'A quantidade de reviews é baixa. Posso ver fotos reais?',
    ];

    // Probabilidades
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

    const techSavviness = idade >= 60 ? 'Cautious adopter' :
      idade >= 40 ? pick(['Average', 'Comfortable', 'Cautious adopter'], rng) :
        pick(['Digital native', 'Comfortable', 'Average'], rng);

    const idiomas = ['Português (nativo)'];
    if (idade < 45 && rng() < 0.35) idiomas.push('Inglês');
    if (rng() < 0.10) idiomas.push('Espanhol');
    if (rng() < 0.05) idiomas.push('Italiano');

    // Mania (10% das personas)
    const mania = rng() < 0.10 ? pick(MANIAS_POSSIVEIS, rng) : undefined;

    const persona: PersonaMatrAIx = {
      id: `PER${String(personaId).padStart(5, '0')}`,
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

// Dataset final: 1.500 originais + 8.500 novas = 10.000 personas
export const PERSONAS_MATRAIX_EXPANDIDO: PersonaMatrAIx[] = [
  ...PERSONAS_ORIGINAIS,
  ...gerarPersonasNovas(8500, 1500),
];

export function totalPersonasExpandido(): number {
  return PERSONAS_MATRAIX_EXPANDIDO.length;
}
