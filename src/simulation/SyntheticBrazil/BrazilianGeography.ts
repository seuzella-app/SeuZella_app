// ============================================================================
// Brazilian Geography — seed data for Synthetic Brazil
// ----------------------------------------------------------------------------
// All 27 federative units (26 states + DF) with their major tourist cities.
// Each city has a real-world coordinate and a "tourism intensity" factor
// that drives pousada / Airbnb density.
// ============================================================================

export interface BrazilianState {
  code: string; // 'SP', 'RJ', ...
  name: string;
  region: 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';
  tourismIntensity: number; // 0..1, drives density of synthetic properties
}

export interface BrazilianCity {
  name: string;
  stateCode: string;
  lat: number;
  lng: number;
  population: number;
  tourismIntensity: number; // 0..1
  /** Whether this is a coastal city (drives Airbnb density up). */
  coastal: boolean;
  /** Tourist season: 'summer' (Dec-Feb), 'winter' (Jun-Aug), 'year-round'. */
  peakSeason: 'summer' | 'winter' | 'year-round' | 'carnaval' | 'easter';
}

export const BRAZILIAN_STATES: BrazilianState[] = [
  { code: 'AC', name: 'Acre', region: 'Norte', tourismIntensity: 0.2 },
  { code: 'AL', name: 'Alagoas', region: 'Nordeste', tourismIntensity: 0.7 },
  { code: 'AP', name: 'Amapá', region: 'Norte', tourismIntensity: 0.2 },
  { code: 'AM', name: 'Amazonas', region: 'Norte', tourismIntensity: 0.5 },
  { code: 'BA', name: 'Bahia', region: 'Nordeste', tourismIntensity: 0.9 },
  { code: 'CE', name: 'Ceará', region: 'Nordeste', tourismIntensity: 0.8 },
  { code: 'DF', name: 'Distrito Federal', region: 'Centro-Oeste', tourismIntensity: 0.4 },
  { code: 'ES', name: 'Espírito Santo', region: 'Sudeste', tourismIntensity: 0.5 },
  { code: 'GO', name: 'Goiás', region: 'Centro-Oeste', tourismIntensity: 0.4 },
  { code: 'MA', name: 'Maranhão', region: 'Nordeste', tourismIntensity: 0.4 },
  { code: 'MT', name: 'Mato Grosso', region: 'Centro-Oeste', tourismIntensity: 0.6 },
  { code: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste', tourismIntensity: 0.7 },
  { code: 'MG', name: 'Minas Gerais', region: 'Sudeste', tourismIntensity: 0.7 },
  { code: 'PA', name: 'Pará', region: 'Norte', tourismIntensity: 0.3 },
  { code: 'PB', name: 'Paraíba', region: 'Nordeste', tourismIntensity: 0.6 },
  { code: 'PR', name: 'Paraná', region: 'Sul', tourismIntensity: 0.6 },
  { code: 'PE', name: 'Pernambuco', region: 'Nordeste', tourismIntensity: 0.8 },
  { code: 'PI', name: 'Piauí', region: 'Nordeste', tourismIntensity: 0.4 },
  { code: 'RJ', name: 'Rio de Janeiro', region: 'Sudeste', tourismIntensity: 1.0 },
  { code: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste', tourismIntensity: 0.7 },
  { code: 'RS', name: 'Rio Grande do Sul', region: 'Sul', tourismIntensity: 0.8 },
  { code: 'RO', name: 'Rondônia', region: 'Norte', tourismIntensity: 0.2 },
  { code: 'RR', name: 'Roraima', region: 'Norte', tourismIntensity: 0.1 },
  { code: 'SC', name: 'Santa Catarina', region: 'Sul', tourismIntensity: 0.9 },
  { code: 'SP', name: 'São Paulo', region: 'Sudeste', tourismIntensity: 1.0 },
  { code: 'SE', name: 'Sergipe', region: 'Nordeste', tourismIntensity: 0.4 },
  { code: 'TO', name: 'Tocantins', region: 'Norte', tourismIntensity: 0.3 },
];

// A curated set of ~120 well-known tourist cities across all 27 states.
// Synthetic Brazil expands this list to 400 cities programmatically by
// generating smaller satellites around these anchors.
export const ANCHOR_CITIES: BrazilianCity[] = [
  // SP
  { name: 'São Paulo', stateCode: 'SP', lat: -23.5505, lng: -46.6333, population: 12_000_000, tourismIntensity: 0.9, coastal: false, peakSeason: 'year-round' },
  { name: 'Praia Grande', stateCode: 'SP', lat: -24.0058, lng: -46.4028, population: 320_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Ubatuba', stateCode: 'SP', lat: -23.4337, lng: -45.0858, population: 90_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Ilhabela', stateCode: 'SP', lat: -23.7787, lng: -45.3581, population: 35_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Campos do Jordão', stateCode: 'SP', lat: -22.7297, lng: -45.5914, population: 52_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'winter' },
  { name: 'Santos', stateCode: 'SP', lat: -23.9618, lng: -46.3322, population: 430_000, tourismIntensity: 0.7, coastal: true, peakSeason: 'summer' },
  { name: 'Guarujá', stateCode: 'SP', lat: -23.9608, lng: -46.2564, population: 320_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'São Sebastião', stateCode: 'SP', lat: -23.7600, lng: -45.4083, population: 90_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'Aparecida', stateCode: 'SP', lat: -22.8456, lng: -45.2328, population: 36_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'year-round' },
  { name: 'Holambra', stateCode: 'SP', lat: -22.6872, lng: -47.0589, population: 13_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },

  // RJ
  { name: 'Rio de Janeiro', stateCode: 'RJ', lat: -22.9068, lng: -43.1729, population: 6_700_000, tourismIntensity: 1.0, coastal: true, peakSeason: 'year-round' },
  { name: 'Búzios', stateCode: 'RJ', lat: -22.7469, lng: -41.8822, population: 30_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Paraty', stateCode: 'RJ', lat: -23.2203, lng: -44.7153, population: 38_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Angra dos Reis', stateCode: 'RJ', lat: -23.0067, lng: -44.3181, population: 200_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Petrópolis', stateCode: 'RJ', lat: -22.5050, lng: -43.1786, population: 300_000, tourismIntensity: 0.6, coastal: false, peakSeason: 'winter' },
  { name: 'Cabo Frio', stateCode: 'RJ', lat: -22.8792, lng: -42.0189, population: 230_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'Arraial do Cabo', stateCode: 'RJ', lat: -22.9661, lng: -42.0278, population: 30_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },

  // BA
  { name: 'Salvador', stateCode: 'BA', lat: -12.9714, lng: -38.5014, population: 2_900_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'carnaval' },
  { name: 'Porto Seguro', stateCode: 'BA', lat: -16.4497, lng: -39.0645, population: 140_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Arraial d\'Ajuda', stateCode: 'BA', lat: -16.4867, lng: -39.0664, population: 30_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Trancoso', stateCode: 'BA', lat: -16.5906, lng: -39.0817, population: 10_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'year-round' },
  { name: 'Morro de São Paulo', stateCode: 'BA', lat: -13.3797, lng: -38.9128, population: 5_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Chapada Diamantina', stateCode: 'BA', lat: -12.5500, lng: -41.4667, population: 20_000, tourismIntensity: 0.7, coastal: false, peakSeason: 'year-round' },

  // RS
  { name: 'Porto Alegre', stateCode: 'RS', lat: -30.0346, lng: -51.2177, population: 1_500_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: 'Gramado', stateCode: 'RS', lat: -29.3781, lng: -50.8702, population: 36_000, tourismIntensity: 1.0, coastal: false, peakSeason: 'winter' },
  { name: 'Canela', stateCode: 'RS', lat: -29.3567, lng: -50.8100, population: 45_000, tourismIntensity: 0.9, coastal: false, peakSeason: 'winter' },
  { name: 'Bento Gonçalves', stateCode: 'RS', lat: -29.1719, lng: -51.5186, population: 110_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'year-round' },
  { name: 'Caxias do Sul', stateCode: 'RS', lat: -29.1681, lng: -51.1794, population: 470_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: ' Torres', stateCode: 'RS', lat: -29.3328, lng: -49.7264, population: 40_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },

  // SC
  { name: 'Florianópolis', stateCode: 'SC', lat: -27.5949, lng: -48.5482, population: 510_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Balneário Camboriú', stateCode: 'SC', lat: -26.9926, lng: -48.6350, population: 140_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'summer' },
  { name: 'Bombinhas', stateCode: 'SC', lat: -27.1319, lng: -48.5275, population: 17_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'summer' },
  { name: 'Joinville', stateCode: 'SC', lat: -26.3045, lng: -48.8487, population: 580_000, tourismIntensity: 0.4, coastal: false, peakSeason: 'year-round' },
  { name: 'Blumenau', stateCode: 'SC', lat: -26.9194, lng: -49.0661, population: 360_000, tourismIntensity: 0.6, coastal: false, peakSeason: 'year-round' },

  // PR
  { name: 'Curitiba', stateCode: 'PR', lat: -25.4284, lng: -49.2733, population: 1_900_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: 'Foz do Iguaçu', stateCode: 'PR', lat: -25.5478, lng: -54.5882, population: 260_000, tourismIntensity: 0.95, coastal: false, peakSeason: 'year-round' },
  { name: 'Ilha do Mel', stateCode: 'PR', lat: -25.5667, lng: -48.3167, population: 1_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'Morretes', stateCode: 'PR', lat: -25.4792, lng: -48.8336, population: 16_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: 'Guaratuba', stateCode: 'PR', lat: -25.8800, lng: -48.5789, population: 35_000, tourismIntensity: 0.8, coastal: true, peakSeason: 'summer' },

  // MG
  { name: 'Belo Horizonte', stateCode: 'MG', lat: -19.9167, lng: -43.9345, population: 2_500_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: 'Ouro Preto', stateCode: 'MG', lat: -20.3878, lng: -43.5033, population: 75_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'year-round' },
  { name: 'Tiradentes', stateCode: 'MG', lat: -21.1139, lng: -44.1769, population: 8_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'year-round' },
  { name: 'Capitólio', stateCode: 'MG', lat: -20.6086, lng: -46.5406, population: 8_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'summer' },

  // ES
  { name: 'Vitória', stateCode: 'ES', lat: -20.3155, lng: -40.3128, population: 360_000, tourismIntensity: 0.6, coastal: true, peakSeason: 'summer' },
  { name: 'Guarapari', stateCode: 'ES', lat: -20.6736, lng: -40.4975, population: 120_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },

  // PE
  { name: 'Recife', stateCode: 'PE', lat: -8.0476, lng: -34.8770, population: 1_600_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'Fernando de Noronha', stateCode: 'PE', lat: -3.8511, lng: -32.4237, population: 3_000, tourismIntensity: 1.0, coastal: true, peakSeason: 'year-round' },
  { name: 'Porto de Galinhas', stateCode: 'PE', lat: -8.5044, lng: -35.0014, population: 5_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'year-round' },

  // CE
  { name: 'Fortaleza', stateCode: 'CE', lat: -3.7319, lng: -38.5267, population: 2_700_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'year-round' },
  { name: 'Jericoacoara', stateCode: 'CE', lat: -2.7939, lng: -40.5047, population: 5_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'year-round' },
  { name: 'Cumbuco', stateCode: 'CE', lat: -3.7333, lng: -38.6500, population: 3_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'year-round' },

  // RN
  { name: 'Natal', stateCode: 'RN', lat: -5.7945, lng: -35.2110, population: 890_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'year-round' },
  { name: 'Pipa', stateCode: 'RN', lat: -6.2236, lng: -35.0419, population: 5_000, tourismIntensity: 0.9, coastal: true, peakSeason: 'year-round' },

  // PB
  { name: 'João Pessoa', stateCode: 'PB', lat: -7.1195, lng: -34.8450, population: 820_000, tourismIntensity: 0.7, coastal: true, peakSeason: 'summer' },

  // AL
  { name: 'Maceió', stateCode: 'AL', lat: -9.6498, lng: -35.7089, population: 1_000_000, tourismIntensity: 0.85, coastal: true, peakSeason: 'summer' },
  { name: 'Maragogi', stateCode: 'AL', lat: -8.7833, lng: -35.2167, population: 30_000, tourismIntensity: 0.95, coastal: true, peakSeason: 'year-round' },

  // SE
  { name: 'Aracaju', stateCode: 'SE', lat: -10.9472, lng: -37.0731, population: 660_000, tourismIntensity: 0.6, coastal: true, peakSeason: 'summer' },

  // PI
  { name: 'Teresina', stateCode: 'PI', lat: -5.0892, lng: -42.8019, population: 870_000, tourismIntensity: 0.3, coastal: false, peakSeason: 'year-round' },
  { name: 'Parnaíba', stateCode: 'PI', lat: -2.9047, lng: -41.7769, population: 150_000, tourismIntensity: 0.6, coastal: true, peakSeason: 'year-round' },

  // MA
  { name: 'São Luís', stateCode: 'MA', lat: -2.5391, lng: -44.2829, population: 1_100_000, tourismIntensity: 0.6, coastal: true, peakSeason: 'year-round' },
  { name: 'Barreirinhas', stateCode: 'MA', lat: -2.7600, lng: -42.8267, population: 60_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'year-round' },

  // MS
  { name: 'Campo Grande', stateCode: 'MS', lat: -20.4697, lng: -54.6201, population: 900_000, tourismIntensity: 0.4, coastal: false, peakSeason: 'year-round' },
  { name: 'Bonito', stateCode: 'MS', lat: -21.1265, lng: -56.4850, population: 20_000, tourismIntensity: 0.95, coastal: false, peakSeason: 'year-round' },
  { name: 'Pantanal', stateCode: 'MS', lat: -19.0000, lng: -56.5000, population: 5_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'winter' },

  // MT
  { name: 'Cuiabá', stateCode: 'MT', lat: -15.6014, lng: -56.0979, population: 650_000, tourismIntensity: 0.4, coastal: false, peakSeason: 'year-round' },
  { name: 'Chapada dos Guimarães', stateCode: 'MT', lat: -15.4606, lng: -55.7506, population: 20_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'year-round' },

  // GO
  { name: 'Goiânia', stateCode: 'GO', lat: -16.6869, lng: -49.2648, population: 1_500_000, tourismIntensity: 0.4, coastal: false, peakSeason: 'year-round' },
  { name: 'Pirenópolis', stateCode: 'GO', lat: -15.8597, lng: -48.9697, population: 25_000, tourismIntensity: 0.8, coastal: false, peakSeason: 'year-round' },
  { name: 'Caldas Novas', stateCode: 'GO', lat: -17.7442, lng: -48.6278, population: 80_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'year-round' },

  // DF
  { name: 'Brasília', stateCode: 'DF', lat: -15.7939, lng: -47.8828, population: 3_000_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },

  // TO
  { name: 'Palmas', stateCode: 'TO', lat: -10.1689, lng: -48.3317, population: 290_000, tourismIntensity: 0.3, coastal: false, peakSeason: 'year-round' },
  { name: 'Jalapão', stateCode: 'TO', lat: -10.0000, lng: -46.5000, population: 1_000, tourismIntensity: 0.7, coastal: false, peakSeason: 'winter' },

  // PA
  { name: 'Belém', stateCode: 'PA', lat: -1.4558, lng: -48.5039, population: 1_500_000, tourismIntensity: 0.5, coastal: false, peakSeason: 'year-round' },
  { name: 'Alter do Chão', stateCode: 'PA', lat: -2.5083, lng: -54.9489, population: 8_000, tourismIntensity: 0.85, coastal: false, peakSeason: 'summer' },

  // AM
  { name: 'Manaus', stateCode: 'AM', lat: -3.1190, lng: -60.0217, population: 2_200_000, tourismIntensity: 0.6, coastal: false, peakSeason: 'year-round' },
  { name: 'Presidente Figueiredo', stateCode: 'AM', lat: -2.0300, lng: -60.0300, population: 30_000, tourismIntensity: 0.75, coastal: false, peakSeason: 'year-round' },

  // AC
  { name: 'Rio Branco', stateCode: 'AC', lat: -9.9747, lng: -67.8100, population: 410_000, tourismIntensity: 0.2, coastal: false, peakSeason: 'year-round' },

  // RO
  { name: 'Porto Velho', stateCode: 'RO', lat: -8.7619, lng: -63.9039, population: 540_000, tourismIntensity: 0.2, coastal: false, peakSeason: 'year-round' },

  // AP
  { name: 'Macapá', stateCode: 'AP', lat: 0.0349, lng: -51.0694, population: 510_000, tourismIntensity: 0.2, coastal: true, peakSeason: 'year-round' },

  // RR
  { name: 'Boa Vista', stateCode: 'RR', lat: 2.8235, lng: -60.6758, population: 420_000, tourismIntensity: 0.15, coastal: false, peakSeason: 'year-round' },
];

/**
 * Get a state by its 2-letter code.
 */
export function getStateByCode(code: string): BrazilianState | undefined {
  return BRAZILIAN_STATES.find((s) => s.code === code);
}
