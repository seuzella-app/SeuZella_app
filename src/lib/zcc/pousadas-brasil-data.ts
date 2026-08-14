/**
 * POUSADAS BRASIL — Tipos e helpers (dados carregados via fetch lazy)
 * =================================================================
 *
 * Os 9.627 registros das pousadas prospectadas NÃO estão bundled no JS.
 * São servidos como JSON estático em /public/data/pousadas-brasil.json
 * e carregados sob demanda pelo LiveLeadsMap via fetch().
 *
 * Vantagens:
 *   - Bundle JS inicial: ~50KB (vs ~2MB bundled)
 *   - Cache HTTP agressivo (1 ano) — browser só baixa 1x
 *   - Lazy loading: mapa carrega instantaneamente, dados async
 *
 * SISTEMA DE 3 CORES no LiveLeadsMap:
 *   - VERDE   = Pousada convertida (cliente Zélla pagante) — mock: top 8 score=100
 *   - AMARELO = Pousada prospectada (9.627 da planilha)
 *   - AZUL    = Clique no anúncio Google Ads (mock: 12 cliques)
 *
 * Plano de migração para dados reais:
 *   1. VERDE: query Prisma `tenant.findMany({ where: { status: 'active' } })`
 *   2. AMARELO: dataset estático (já feito — só atualizar planilha)
 *   3. AZUL: Google Ads API + UTM tracking (quando campanhas subirem)
 */

export interface PousadaBrasil {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
  tier: 'MAX' | 'PRO' | 'LITE' | string;
  funnel: 'HOT' | 'WARM' | 'WARM_LOW' | 'COLD' | string;
  score: number;
  qtdQuartos: number;
  valores: string;
  sinaisIntencao: string;
  localPraia: string;
  whatsapp: string;
  email: string;
}

/** URL do JSON estático (servido da pasta /public/data/). */
export const POUSADAS_BRASIL_URL = '/data/pousadas-brasil.json';

/** Total (atualizado quando planilha é regerada). */
export const TOTAL_POUSADAS_PROSPECTADAS = 9627;

/** Distribuição por UF (top 10 + outros). */
export const POUSADAS_POR_UF: Record<string, number> = {
  'SC': 2681, 'ES': 1654, 'SP': 1343, 'RS': 1169, 'BA': 871,
  'PR': 580, 'CE': 262, 'RJ': 253, 'PI': 222, 'MA': 140,
  'OUTROS': 273,
};

export const POUSADAS_POR_TIER: Record<string, number> = {
  'MAX': 8177, 'PRO': 1393, 'LITE': 57,
};

export const POUSADAS_POR_FUNNEL: Record<string, number> = {
  'HOT': 8177, 'WARM': 1393, 'WARM_LOW': 57,
};

let _cache: PousadaBrasil[] | null = null;
let _promise: Promise<PousadaBrasil[]> | null = null;

/**
 * Carrega as 9.627 pousadas prospectadas via fetch (1x, com cache).
 * Em caso de erro, retorna array vazio (mapa mostra só o background).
 */
export async function fetchPousadasBrasil(): Promise<PousadaBrasil[]> {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = fetch(POUSADAS_BRASIL_URL, { cache: 'force-cache' })
    .then(r => r.json())
    .then((arr: any[]) => {
      _cache = arr.map(p => ({
        id: p[0], nome: p[1], cidade: p[2], uf: p[3],
        lat: p[4], lng: p[5], tier: p[6], funnel: p[7],
        score: p[8], qtdQuartos: p[9],
        valores: p[10], sinaisIntencao: p[11], localPraia: p[12],
        whatsapp: p[13], email: p[14],
      }));
      return _cache;
    })
    .catch(err => {
      console.warn('[POUSADAS_BRASIL] Falha ao carregar dataset:', err);
      _cache = [];
      _promise = null;
      return _cache;
    });

  return _promise;
}

/**
 * Mock: pousadas convertidas (VERDE no mapa).
 * Seleciona as 8 pousadas HOT com score 100 como simulação.
 * Em produção: query Prisma `tenant.findMany({ where: { status: 'active' } })`.
 */
export async function fetchPousadasConvertidasMock(): Promise<PousadaBrasil[]> {
  const all = await fetchPousadasBrasil();
  return all
    .filter(p => p.funnel === 'HOT' && p.score >= 95)
    .slice(0, 8);
}

/**
 * Mock: cliques no anúncio (AZUL no mapa).
 * Simula 12 cliques em pousadas HOT (quando Google Ads estiver pronto,
 * substituir por tracking real com UTM + GA4).
 */
export async function fetchCliquesAnuncioMock(): Promise<PousadaBrasil[]> {
  const all = await fetchPousadasBrasil();
  return all
    .filter(p => p.funnel === 'HOT')
    .slice(0, 12)
    .map((p, i) => ({ ...p, id: `CLICK-${String(i).padStart(3, '0')}-${p.id}` }));
}
