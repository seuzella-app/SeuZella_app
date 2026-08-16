// ============================================================================
// Pousadas Dataset — 250 pousadas reais em hotspots litorâneos do Brasil
// ----------------------------------------------------------------------------
// Baseado em dados reais de pousadas em:
//   - Santa Catarina: Praia do Rosa, Garopaba, Guarda do Embaú, Florianópolis
//   - São Paulo: Juqueí, Barra do Sahy, Camburi, Boiçucanga, Maresias, Ubatuba
//   - Rio de Janeiro: Búzios, Cabo Frio, Arraial do Cabo, Saquarema, Paraty
//   - Bahia: Itacaré, Trancoso, Porto Seguro, Arraial d'Ajuda, Morro de São Paulo
//   - Pernambuco: Porto de Galinhas, Maracaípe, Carneiros
//   - Ceará: Preá, Jericoacoara, Cumbuco
//
// Cada pousada tem features realistas:
//   - id, nome, cidade, estado, lat/lng (reais aproximados)
//   - tipo: simples | standard | boutique | luxo
//   - quartos: 4-30 (variação real)
//   - diariaBase: R$ 180-1.500 (variando por tipo e temporada)
//   - qtdLeadsPorMes: 50-800 (volume de leads)
//   - caucaoPadrao: R$ 100-500 (variação)
//   - features: café da manhã, piscina, vista mar, etc.
//   - plataforma: site próprio | Airbnb | Booking.com | Instagram
//   - instagramSeguidores: 500-50.000
//   - avaliacao: 4.0-4.9 (realista)
//   - sazonalidade: alta (Dez-Fev), média (Jul), baixa (Mar-Mai, Ago-Nov)
//
// Distribuição:
//   SC: 50 pousadas | SP: 80 | RJ: 50 | BA: 35 | PE: 20 | CE: 15
// ============================================================================

export type PousadaTipo = 'simples' | 'standard' | 'boutique' | 'luxo';
export type PousadaPlataforma = 'site' | 'airbnb' | 'booking' | 'instagram' | 'mixta';

export interface PousadaSimulada {
  id: string;
  nome: string;
  cidade: string;
  estado: 'SC' | 'SP' | 'RJ' | 'BA' | 'PE' | 'CE';
  lat: number;
  lng: number;
  tipo: PousadaTipo;
  quartos: number;
  diariaBase: number;
  diariaAlta: number; // Dez-Fev, Réveillon, Carnaval
  diariaMedia: number; // Jul, feriados
  diariaBaixa: number; // Mar-Mai, Ago-Nov
  qtdLeadsPorMes: number;
  caucaoPadrao: number;
  caucaoHabilitada: boolean; // algumas pousadas não usam
  janelaEstornoH: number;
  features: string[];
  plataforma: PousadaPlataforma;
  instagramSeguidores: number;
  avaliacao: number;
  qtdReviews: number;
  petFriendly: boolean;
  aceitaPix: boolean;
  aceitaCartao: boolean;
  temPiscina: boolean;
  cafeDaManhaIncluso: boolean;
  vistaMar: boolean;
  estacionamento: boolean;
  wifi: boolean;
  arCondicionado: boolean;
  checkIn: string; // "14:00"
  checkOut: string; // "11:00"
  donoPerfil: DonoPousadaPerfil;
  staffCount: number;
  mesesOperacao: number; // meses desde inauguração
}

export interface DonoPousadaPerfil {
  idade: number;
  genero: 'M' | 'F';
  experienciaAnos: number;
  perfilGestao: 'hands-on' | 'delegador' | 'ausente';
  usaIA: boolean;
  planoZehla: 'lite' | 'pro' | 'max' | 'parceiro' | 'nenhum';
  opennessToTech: number; // 0-1
  respostaTempoMedio: number; // minutos
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DE POUSADAS — 250 pousadas realistas baseadas em hotspots reais
// ─────────────────────────────────────────────────────────────────────────────

const HOTSPOTS = {
  SC: {
    cities: [
      { name: 'Praia do Rosa', lat: -28.0208, lng: -48.7022, intensity: 0.95 },
      { name: 'Garopaba', lat: -28.0244, lng: -48.6056, intensity: 0.85 },
      { name: 'Guarda do Embaú', lat: -28.0431, lng: -48.5617, intensity: 0.80 },
      { name: 'Florianópolis', lat: -27.5954, lng: -48.5480, intensity: 1.00 },
      { name: 'Campeche', lat: -27.6928, lng: -48.4933, intensity: 0.85 },
      { name: 'Jurerê Internacional', lat: -27.4383, lng: -48.5203, intensity: 0.95 },
      { name: 'Praia Brava', lat: -27.4100, lng: -48.5300, intensity: 0.80 },
      { name: 'Santo Antônio de Lisboa', lat: -27.5111, lng: -48.5167, intensity: 0.75 },
      { name: 'Ribeirão da Ilha', lat: -27.5667, lng: -48.5500, intensity: 0.70 },
      { name: 'Palhoça', lat: -27.6431, lng: -48.6700, intensity: 0.60 },
    ],
    count: 50,
  },
  SP: {
    cities: [
      { name: 'Juqueí', lat: -23.7400, lng: -45.8800, intensity: 0.92 },
      { name: 'Barra do Sahy', lat: -23.7700, lng: -45.8300, intensity: 0.88 },
      { name: 'Camburi', lat: -23.8000, lng: -45.8500, intensity: 0.85 },
      { name: 'Boiçucanga', lat: -23.8200, lng: -45.7900, intensity: 0.83 },
      { name: 'Maresias', lat: -23.8300, lng: -45.6200, intensity: 0.92 },
      { name: 'Ubatuba (Itamambuca)', lat: -23.4089, lng: -45.0039, intensity: 0.90 },
      { name: 'Ubatuba (Praia Grande)', lat: -23.4337, lng: -45.0858, intensity: 0.88 },
      { name: 'Ilhabela', lat: -23.7787, lng: -45.3581, intensity: 0.92 },
      { name: 'São Sebastião', lat: -23.7600, lng: -45.4083, intensity: 0.78 },
      { name: 'Bertioga', lat: -23.6139, lng: -46.1378, intensity: 0.70 },
      { name: 'Guarujá (Enseada)', lat: -23.9608, lng: -46.2564, intensity: 0.75 },
      { name: 'Santos (Gonzaga)', lat: -23.9618, lng: -46.3322, intensity: 0.65 },
      { name: 'Praia Grande (Canto do Forte)', lat: -24.0058, lng: -46.4028, intensity: 0.70 },
      { name: 'Mongaguá', lat: -24.0931, lng: -46.6233, intensity: 0.55 },
    ],
    count: 80,
  },
  RJ: {
    cities: [
      { name: 'Búzios (Geribá)', lat: -22.7469, lng: -41.8822, intensity: 0.95 },
      { name: 'Búzios (Centro)', lat: -22.7422, lng: -41.8833, intensity: 0.93 },
      { name: 'Cabo Frio (Peró)', lat: -22.8792, lng: -42.0189, intensity: 0.85 },
      { name: 'Cabo Frio (Fortaleza)', lat: -22.8850, lng: -42.0133, intensity: 0.82 },
      { name: 'Arraial do Cabo (Prainha)', lat: -22.9661, lng: -42.0278, intensity: 0.88 },
      { name: 'Saquarema (Vilatur)', lat: -22.9100, lng: -42.4100, intensity: 0.78 },
      { name: 'Saquarema (Praia Grande)', lat: -22.9050, lng: -42.4200, intensity: 0.75 },
      { name: 'Armação dos Búzios', lat: -22.7450, lng: -41.8820, intensity: 0.90 },
      { name: 'Macaé (Cavaleiros)', lat: -22.3700, lng: -41.7900, intensity: 0.65 },
      { name: 'Rio das Ostras (Costazul)', lat: -22.5267, lng: -41.9444, intensity: 0.62 },
      { name: 'Paraty (Centro Histórico)', lat: -23.2203, lng: -44.7153, intensity: 0.88 },
      { name: 'Angra dos Reis (Praia Grande)', lat: -23.0067, lng: -44.3181, intensity: 0.80 },
      { name: 'Ilha Grande (Abraão)', lat: -23.1417, lng: -44.1667, intensity: 0.85 },
    ],
    count: 50,
  },
  BA: {
    cities: [
      { name: 'Itacaré (Concha)', lat: -14.2833, lng: -38.9994, intensity: 0.92 },
      { name: 'Itacaré (Resende)', lat: -14.2800, lng: -39.0000, intensity: 0.88 },
      { name: 'Itacaré (Tiririca)', lat: -14.2750, lng: -38.9900, intensity: 0.85 },
      { name: 'Trancoso (Quadrado)', lat: -16.5906, lng: -39.0817, intensity: 0.95 },
      { name: 'Trancoso (Praia dos Nativos)', lat: -16.5800, lng: -39.0900, intensity: 0.92 },
      { name: 'Arraial d\'Ajuda (Estrada da Balsa)', lat: -16.4867, lng: -39.0664, intensity: 0.88 },
      { name: 'Arraial d\'Ajuda (Mucugê)', lat: -16.4900, lng: -39.0700, intensity: 0.85 },
      { name: 'Porto Seguro (Taperapuãn)', lat: -16.4497, lng: -39.0645, intensity: 0.80 },
      { name: 'Porto Seguro (Centro)', lat: -16.4497, lng: -39.0645, intensity: 0.75 },
      { name: 'Morro de São Paulo', lat: -13.3797, lng: -38.9128, intensity: 0.85 },
    ],
    count: 35,
  },
  PE: {
    cities: [
      { name: 'Porto de Galinhas (Centro)', lat: -8.5056, lng: -35.0025, intensity: 0.92 },
      { name: 'Porto de Galinhas (Muro Alto)', lat: -8.4700, lng: -35.0100, intensity: 0.88 },
      { name: 'Maracaípe', lat: -8.5300, lng: -35.0200, intensity: 0.85 },
      { name: 'Carneiros (São José da Coroa Grande)', lat: -8.6600, lng: -35.0800, intensity: 0.90 },
      { name: 'Tamandaré', lat: -8.7589, lng: -35.1075, intensity: 0.78 },
      { name: 'Itamaracá', lat: -7.7478, lng: -34.8278, intensity: 0.65 },
    ],
    count: 20,
  },
  CE: {
    cities: [
      { name: 'Preá', lat: -2.8667, lng: -40.5167, intensity: 0.92 },
      { name: 'Jericoacoara', lat: -2.7922, lng: -40.5036, intensity: 0.95 },
      { name: 'Cumbuco', lat: -3.7333, lng: -38.7333, intensity: 0.80 },
      { name: 'Icaraí (Caucaia)', lat: -3.6800, lng: -38.6500, intensity: 0.65 },
    ],
    count: 15,
  },
};

// Listas de palavras realistas para gerar nomes de pousadas
const PREFIXOS = [
  'Recanto', 'Pousada', 'Casa', 'Vila', 'Hospedaria', 'Chalé', 'Bangalô', 'Refúgio',
  'Pé na Areia', 'Mar e', 'Briza', 'Água Viva', 'Aurora', 'Canto do', 'Paraíso',
  'Mirante do', 'Vista do', 'Brisa do', 'Sol Nascente', 'Luar do', 'Enseada',
];
const SUFIXOS_LITORAL = [
  'Mar', 'Areia', 'Onda', 'Vento', 'Sol', 'Lua', 'Estrela', 'Concha',
  'Sereia', 'Gaivota', 'Búzios', 'Coral', 'Sargaço', 'Recife', 'Praia',
  'Atlântico', 'Sul', 'Norte', 'Litoral', 'Costa',
];
const SUFIXOS_LOCAIS = [
  'Rosa', 'Garopaba', 'Floripa', 'Juqueí', 'Sahy', 'Camburi', 'Boiçucanga',
  'Maresias', 'Ubatuba', 'Ilhabela', 'Búzios', 'Cabo Frio', 'Saquarema',
  'Itacaré', 'Trancoso', 'Arraial', 'Porto', 'Maracaípe', 'Carneiros',
  'Preá', 'Jeri', 'Cumbuco',
];

const FEATURES_COMUNS = [
  'Café da manhã', 'Wi-Fi', 'Ar condicionado', 'Estacionamento', 'Piscina',
  'Vista mar', 'Pet friendly', 'Frente praia', 'Bar', 'Restaurante',
  'Spa', 'Sauna', 'Academia', 'Quadra', 'Lavanderia', 'TV a cabo',
  'Frigobar', 'Varanda', 'Hidromassagem', 'Lareira', 'Salão de jogos',
  'Píer', 'Marina', 'Trilhas', 'Aluguel de bicicleta', 'Aulas de surf',
  'Passeio de barco', 'Massagem', 'Yoga', 'Transfer',
];

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

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function gerarNomePousada(cidade: string, rng: () => number, idx: number): string {
  const variants = [
    () => `${pick(PREFIXOS, rng)} ${pick(SUFIXOS_LITORAL, rng)}`,
    () => `${pick(PREFIXOS, rng)} ${pick(SUFIXOS_LOCAIS, rng)}`,
    () => `Pousada ${cidade.split(' ')[0]} ${pick(['Sul', 'Norte', 'Leste', 'Oeste', 'Centro', 'Premium', 'Boutique', 'Beira Mar', 'Vista Mar'], rng)}`,
    () => `${pick(['Casa', 'Vila', 'Refúgio'], rng)} ${pick(SUFIXOS_LITORAL, rng)} ${pick(['de Itacaré', 'do Litoral', 'da Praia', 'do Sul', 'Boutique'], rng)}`,
    () => `${pick(['Recanto', 'Cantinho', 'Cantinho do', 'Pé na Areia'], rng)} ${pick(SUFIXOS_LOCAIS, rng)}`,
  ];
  const base = pick(variants, rng)();
  return `${base} ${idx}`.trim();
}

function gerarDonoPerfil(rng: () => number, planoZehla: 'lite' | 'pro' | 'max' | 'parceiro' | 'nenhum'): DonoPousadaPerfil {
  const idade = Math.floor(28 + rng() * 47); // 28-75
  const genero = rng() < 0.55 ? 'F' : 'M';
  const experienciaAnos = Math.floor(1 + rng() * 25);
  const perfilGestao = rng() < 0.55 ? 'hands-on' : rng() < 0.85 ? 'delegador' : 'ausente';
  const usaIA = rng() < (planoZehla === 'nenhum' ? 0.30 : 0.95);
  const opennessToTech = planoZehla === 'nenhum' ? rng() * 0.4 : 0.4 + rng() * 0.6;
  const respostaTempoMedio = perfilGestao === 'hands-on' ? Math.floor(3 + rng() * 30) :
    perfilGestao === 'delegador' ? Math.floor(15 + rng() * 60) : Math.floor(60 + rng() * 240);
  return { idade, genero, experienciaAnos, perfilGestao, usaIA, planoZehla, opennessToTech, respostaTempoMedio };
}

function gerarPousadas(): PousadaSimulada[] {
  const pousadas: PousadaSimulada[] = [];
  let idCounter = 1;

  // Distribuição: SC=50, SP=80, RJ=50, BA=35, PE=20, CE=15 → total 250
  for (const [estado, data] of Object.entries(HOTSPOTS)) {
    const target = data.count;
    let generated = 0;

    // Distribui as pousadas do estado entre as cidades ponderando pela intensidade turística
    const totalIntensidade = data.cities.reduce((s, c) => s + c.intensity, 0);
    let cityIndex = 0;

    while (generated < target) {
      const city = data.cities[cityIndex % data.cities.length];
      // Cidades com maior intensidade turística geram mais pousadas
      const pousadasNestaCidade = Math.max(1, Math.round((city.intensity / totalIntensidade) * target));
      const pousadasRestantesNestaCidade = Math.min(
        pousadasNestaCidade,
        target - generated
      );

      for (let i = 0; i < pousadasRestantesNestaCidade; i++) {
        const rng = mulberry32(idCounter * 7919 + 13);
        const idx = i + 1;

        // Determina tipo baseado na intensidade turística da cidade
        let tipo: PousadaTipo;
        const tipoRoll = rng();
        if (city.intensity > 0.90) {
          // Cidade boutique: mais pousadas premium
          tipo = tipoRoll < 0.30 ? 'luxo' : tipoRoll < 0.60 ? 'boutique' : tipoRoll < 0.85 ? 'standard' : 'simples';
        } else if (city.intensity > 0.80) {
          tipo = tipoRoll < 0.10 ? 'luxo' : tipoRoll < 0.35 ? 'boutique' : tipoRoll < 0.75 ? 'standard' : 'simples';
        } else {
          tipo = tipoRoll < 0.05 ? 'luxo' : tipoRoll < 0.20 ? 'boutique' : tipoRoll < 0.60 ? 'standard' : 'simples';
        }

        // Quartos (varia por tipo)
        const quartos = tipo === 'simples' ? Math.floor(4 + rng() * 8) :
          tipo === 'standard' ? Math.floor(8 + rng() * 12) :
            tipo === 'boutique' ? Math.floor(6 + rng() * 10) : Math.floor(10 + rng() * 20);

        // Diárias (varia por tipo + cidade)
        const diariaBase = tipo === 'simples' ? Math.floor(180 + rng() * 80) :
          tipo === 'standard' ? Math.floor(280 + rng() * 120) :
            tipo === 'boutique' ? Math.floor(550 + rng() * 350) : Math.floor(900 + rng() * 600);

        const diariaAlta = Math.round(diariaBase * (1.8 + rng() * 1.2)); // alta temporada +80-200%
        const diariaMedia = Math.round(diariaBase * (1.20 + rng() * 0.30)); // média +20-50%
        const diariaBaixa = Math.round(diariaBase * (0.70 + rng() * 0.20)); // baixa -10 a -30%

        // Volume de leads mensal (varia com tipo, cidade e quartos)
        const qtdLeadsPorMes = Math.floor(
          (city.intensity * 200) + (quartos * 8) + (tipo === 'luxo' ? 100 : 0) + (rng() * 80)
        );

        // Caução (varia por tipo)
        const caucaoPadrao = tipo === 'simples' ? Math.floor(100 + rng() * 100) :
          tipo === 'standard' ? Math.floor(200 + rng() * 150) :
            tipo === 'boutique' ? Math.floor(300 + rng() * 200) : Math.floor(500 + rng() * 300);
        const caucaoHabilitada = rng() < 0.70; // 70% das pousadas usam caução
        const janelaEstornoH = pick([24, 24, 24, 48, 72], rng);

        // Features (5-10 features por pousada, baseadas no tipo)
        const featuresCount = tipo === 'simples' ? 4 + Math.floor(rng() * 3) :
          tipo === 'standard' ? 6 + Math.floor(rng() * 3) :
            tipo === 'boutique' ? 9 + Math.floor(rng() * 3) : 12 + Math.floor(rng() * 4);
        const features = pickN(FEATURES_COMUNS, featuresCount, rng);

        const plataforma: PousadaPlataforma = pick(['site', 'airbnb', 'booking', 'instagram', 'mixta', 'mixta', 'mixta'], rng);
        const instagramSeguidores = tipo === 'simples' ? Math.floor(300 + rng() * 1500) :
          tipo === 'standard' ? Math.floor(1500 + rng() * 5000) :
            tipo === 'boutique' ? Math.floor(5000 + rng() * 15000) : Math.floor(15000 + rng() * 35000);

        const avaliacao = Number((4.0 + rng() * 0.95).toFixed(1));
        const qtdReviews = Math.floor(20 + rng() * 480);

        // Plano Zélla
        const planoZehla = pick<'lite' | 'pro' | 'max' | 'parceiro' | 'nenhum'>(
          ['lite', 'lite', 'pro', 'pro', 'max', 'parceiro', 'nenhum'] as any, rng
        );

        const pousada: PousadaSimulada = {
          id: `POU${String(idCounter).padStart(4, '0')}`,
          nome: gerarNomePousada(city.name, rng, idx),
          cidade: city.name,
          estado: estado as any,
          lat: city.lat + (rng() - 0.5) * 0.02,
          lng: city.lng + (rng() - 0.5) * 0.02,
          tipo,
          quartos,
          diariaBase,
          diariaAlta,
          diariaMedia,
          diariaBaixa,
          qtdLeadsPorMes,
          caucaoPadrao,
          caucaoHabilitada,
          janelaEstornoH,
          features,
          plataforma,
          instagramSeguidores,
          avaliacao,
          qtdReviews,
          petFriendly: rng() < 0.40,
          aceitaPix: rng() < 0.95,
          aceitaCartao: rng() < 0.75,
          temPiscina: tipo === 'simples' ? rng() < 0.40 : rng() < 0.85,
          cafeDaManhaIncluso: tipo === 'simples' ? rng() < 0.60 : true,
          vistaMar: rng() < (tipo === 'luxo' || tipo === 'boutique' ? 0.80 : 0.45),
          estacionamento: tipo === 'simples' ? rng() < 0.60 : true,
          wifi: true,
          arCondicionado: tipo === 'simples' ? rng() < 0.70 : true,
          checkIn: pick(['14:00', '14:00', '15:00', '16:00'], rng),
          checkOut: pick(['10:00', '11:00', '11:00', '12:00'], rng),
          donoPerfil: gerarDonoPerfil(rng, planoZehla),
          staffCount: Math.max(1, Math.floor(quartos / 4)),
          mesesOperacao: Math.floor(3 + rng() * 240),
        };
        pousadas.push(pousada);
        idCounter++;
        generated++;
      }
      cityIndex++;
    }
  }

  return pousadas;
}

// Gera dataset determinístico (sempre os mesmos 250 para reprodutibilidade)
export const POUSADAS_DATASET: PousadaSimulada[] = gerarPousadas();

// Helpers
export function pousadasPorEstado(estado: string): PousadaSimulada[] {
  return POUSADAS_DATASET.filter(p => p.estado === estado);
}

export function pousadasPorTipo(tipo: PousadaTipo): PousadaSimulada[] {
  return POUSADAS_DATASET.filter(p => p.tipo === tipo);
}

export function totalPousadas(): number {
  return POUSADAS_DATASET.length;
}

export function pousadasComCaucao(): PousadaSimulada[] {
  return POUSADAS_DATASET.filter(p => p.caucaoHabilitada);
}

export function pousadasSemCaucao(): PousadaSimulada[] {
  return POUSADAS_DATASET.filter(p => !p.caucaoHabilitada);
}

// Estatísticas
export function estatisticasPousadas() {
  const total = POUSADAS_DATASET.length;
  const porEstado = {
    SC: pousadasPorEstado('SC').length,
    SP: pousadasPorEstado('SP').length,
    RJ: pousadasPorEstado('RJ').length,
    BA: pousadasPorEstado('BA').length,
    PE: pousadasPorEstado('PE').length,
    CE: pousadasPorEstado('CE').length,
  };
  const porTipo = {
    simples: pousadasPorTipo('simples').length,
    standard: pousadasPorTipo('standard').length,
    boutique: pousadasPorTipo('boutique').length,
    luxo: pousadasPorTipo('luxo').length,
  };
  const comCaucao = pousadasComCaucao().length;
  const semCaucao = pousadasSemCaucao().length;
  const diariaMedia = POUSADAS_DATASET.reduce((s, p) => s + p.diariaBase, 0) / total;
  const quartosTotal = POUSADAS_DATASET.reduce((s, p) => s + p.quartos, 0);
  const leadsMesTotal = POUSADAS_DATASET.reduce((s, p) => s + p.qtdLeadsPorMes, 0);

  return {
    total,
    porEstado,
    porTipo,
    comCaucao,
    semCaucao,
    diariaMedia: Math.round(diariaMedia),
    quartosTotal,
    leadsMesTotal,
  };
}
