// ============================================================================
// JEV — Corpus rotulado do SHADOW HARNESS (RUN23-A) — jev-harness-samples.ts
// ============================================================================
// Corpus v1: 28 amostras rotuladas (4 por modo x 7 modos) que REPRESENTAM os
// sinais reais do Cerebro (mesmos campos que os handlers USE_TF_* e os cron do
// Cerebro ja usam hoje), com rotulo de referencia (ground truth) atribuido
// INDEPENDENTE da heuristica. As divergencias sao o PRODUTO desta onda: elas
// dizem ONDE o baseline local ($0) e fraco e, portanto, ONDE um decision
// provider remoto (Jev/TypeSafe, onda de integracao) vale o custo.
//
// Regras do corpus (invariantes da onda):
//  - NENHUM dado real de cliente: textos sinteticos, sem e-mail, sem
//    telefone, sem nome de pessoa (nada para o firewall ofuscar);
//  - tenantId sintetico com prefixo 'tenant-harness-' (JAMAIS 'demo');
//  - ROTULOS sao independentes do codigo: se o corpus concordasse 100% com a
//    heuristica por construcao, a metrica nao mediria nada;
//  - Extensao APPEND-only: novas amostras entram com bump de versao do corpus
//    (JEV_HARNESS_CORPUS_VERSION) — rotulo antigo nunca e reescrito;
//  - Nenhum campo fora das allowlists do firewall (campos inuteis nao
//    cruzariam a fronteira — manter o corpus honesto com a producao).
// ============================================================================

import type { JevDecisionMode } from '../../../domain/decision/contracts/JevTypes';

/** Uma amostra rotulada do corpus do harness. */
export interface JevHarnessSample {
  /** Id curto e estavel (ex.: 'INT-001'). Nunca reutilizado. */
  id: string;
  mode: JevDecisionMode;
  /** Tenant sintetico — nunca tenant real, nunca 'demo'. */
  tenantId: string;
  /** Payload bruto (passa pelo firewall antes da decisao, como na producao). */
  payload: Record<string, unknown>;
  /** Ground truth atribuido de forma independente da heuristica. */
  expectedLabel: string;
  /** Por que esta amostra existe (documentacao curta, sem conteudo sensivel). */
  note: string;
}

export const JEV_HARNESS_CORPUS_VERSION = 'jev-harness-corpus-v1';

export const JEV_HARNESS_SAMPLES: readonly JevHarnessSample[] = [
  // ------------------------------------------------------------------ INTENT
  {
    id: 'INT-001',
    mode: 'INTENT',
    tenantId: 'tenant-harness-01',
    payload: { text: 'quero fazer uma reserva para o fim de semana', channel: 'whatsapp' },
    expectedLabel: 'RESERVA',
    note: 'ancora positiva: palavra-chave de reserva direta',
  },
  {
    id: 'INT-002',
    mode: 'INTENT',
    tenantId: 'tenant-harness-02',
    payload: { text: 'preciso cancelar minha hospedagem', channel: 'whatsapp' },
    expectedLabel: 'CANCELAMENTO',
    note: 'armadilha de ordem de keywords: hospedagem dispara RESERVA antes de cancel',
  },
  {
    id: 'INT-003',
    mode: 'INTENT',
    tenantId: 'tenant-harness-03',
    payload: { text: 'qual o preco da tarifa para casal?', channel: 'site' },
    expectedLabel: 'PRECO_INFO',
    note: 'pergunta de tarifa sem palavra de reserva',
  },
  {
    id: 'INT-004',
    mode: 'INTENT',
    tenantId: 'tenant-harness-04',
    payload: { text: 'bom dia, tudo bem?', channel: 'whatsapp' },
    expectedLabel: 'OUTRO',
    note: 'sem sinal: deve cair no label de fallback com baixa confianca',
  },
  // --------------------------------------------------------------- SENTIMENT
  {
    id: 'SEN-001',
    mode: 'SENTIMENT',
    tenantId: 'tenant-harness-05',
    payload: { text: 'o atendimento foi otimo, adorei a estadia', channel: 'whatsapp' },
    expectedLabel: 'POSITIVO',
    note: 'polaridade positiva clara (2 marcadores)',
  },
  {
    id: 'SEN-002',
    mode: 'SENTIMENT',
    tenantId: 'tenant-harness-06',
    payload: { text: 'o quarto estava sujo e o chuveiro pessimo', channel: 'whatsapp' },
    expectedLabel: 'NEGATIVO',
    note: 'polaridade negativa clara (2 marcadores)',
  },
  {
    id: 'SEN-003',
    mode: 'SENTIMENT',
    tenantId: 'tenant-harness-07',
    payload: { text: 'a vista era otima mas o quarto estava sujo e o atendimento atrasado', channel: 'site' },
    expectedLabel: 'NEGATIVO',
    note: 'misto com predominancia negativa (2 negativos vs 1 positivo)',
  },
  {
    id: 'SEN-004',
    mode: 'SENTIMENT',
    tenantId: 'tenant-harness-08',
    payload: { text: 'o hotel e ok, nada demais', channel: 'site' },
    expectedLabel: 'NEUTRO',
    note: 'sem marcadores de polaridade',
  },
  // ------------------------------------------------------------------- CHURN
  {
    id: 'CHU-001',
    mode: 'CHURN',
    tenantId: 'tenant-harness-09',
    payload: { recencyDays: 75, bookingCount: 3, npsScore: 3, cancellationCount: 1 },
    expectedLabel: 'ALTO',
    note: 'recencia alta + detrator: churn alto inequivoco',
  },
  {
    id: 'CHU-002',
    mode: 'CHURN',
    tenantId: 'tenant-harness-10',
    payload: { recencyDays: 45, bookingCount: 5, npsScore: 8, cancellationCount: 0 },
    expectedLabel: 'MEDIO',
    note: 'recencia media + promotor: risco intermediario',
  },
  {
    id: 'CHU-003',
    mode: 'CHURN',
    tenantId: 'tenant-harness-11',
    payload: { recencyDays: 10, bookingCount: 8, npsScore: 9, cancellationCount: 0 },
    expectedLabel: 'BAIXO',
    note: 'cliente ativo e promotor: risco baixo',
  },
  {
    id: 'CHU-004',
    mode: 'CHURN',
    tenantId: 'tenant-harness-12',
    payload: { recencyDays: 30, bookingCount: 4, npsScore: 6, cancellationCount: 0 },
    expectedLabel: 'MEDIO',
    note: 'fronteira: 30 dias + NPS 6 borderline — o Cerebro rotularia MEDIO',
  },
  // -------------------------------------------------------------------- LEAD
  {
    id: 'LEA-001',
    mode: 'LEAD',
    tenantId: 'tenant-harness-13',
    payload: { text: 'grupo de quatro pessoas querendo fim de semana', hasContact: true, partySize: 4 },
    expectedLabel: 'LEAD_QUALIFICADO',
    note: 'contato presente + grupo: lead qualificado direto',
  },
  {
    id: 'LEA-002',
    mode: 'LEAD',
    tenantId: 'tenant-harness-14',
    payload: { text: 'estou so pesquisando opcoes', hasContact: false, partySize: 2 },
    expectedLabel: 'NAO_QUALIFICADO',
    note: 'sem contato: nao qualifica (mesmo com grupo)',
  },
  {
    id: 'LEA-003',
    mode: 'LEAD',
    tenantId: 'tenant-harness-15',
    payload: { text: 'viajante solo, deixei meu contato no perfil', hasContact: true, partySize: 1 },
    expectedLabel: 'LEAD_QUALIFICADO',
    note: 'lead solo com contato e valido para o Cerebro — heuristica exige tamanho >= 2',
  },
  {
    id: 'LEA-004',
    mode: 'LEAD',
    tenantId: 'tenant-harness-16',
    payload: { text: 'reserva corporativa para o time, contato no perfil', hasContact: true, partySize: 6 },
    expectedLabel: 'LEAD_QUALIFICADO',
    note: 'corporativo com contato: qualificado',
  },
  // ----------------------------------------------------------------- ANOMALY
  {
    id: 'ANO-001',
    mode: 'ANOMALY',
    tenantId: 'tenant-harness-17',
    payload: { metric: 'taxa_erro', deviation: 3.4, baseline: 0.02, window: '1h' },
    expectedLabel: 'CRITICA',
    note: 'desvio grave (z >= 3)',
  },
  {
    id: 'ANO-002',
    mode: 'ANOMALY',
    tenantId: 'tenant-harness-18',
    payload: { metric: 'latencia_p95', deviation: 2.2, baseline: 820, window: '1h' },
    expectedLabel: 'ALTA',
    note: 'desvio alto (2 <= z < 3)',
  },
  {
    id: 'ANO-003',
    mode: 'ANOMALY',
    tenantId: 'tenant-harness-19',
    payload: { metric: 'taxa_reserva', deviation: 1.1, baseline: 0.14, window: '24h' },
    expectedLabel: 'MEDIA',
    note: 'desvio moderado (1 <= z < 2)',
  },
  {
    id: 'ANO-004',
    mode: 'ANOMALY',
    tenantId: 'tenant-harness-20',
    payload: { metric: 'taxa_reserva', deviation: 0.4, baseline: 0.14, window: '24h' },
    expectedLabel: 'NORMAL',
    note: 'dentro da faixa (z < 1)',
  },
  // --------------------------------------------------------------- OCCUPANCY
  {
    id: 'OCC-001',
    mode: 'OCCUPANCY',
    tenantId: 'tenant-harness-21',
    payload: { rate: 0.94, leadTimeDays: 2, channel: 'direto' },
    expectedLabel: 'ALTA_OCUPACAO',
    note: 'ocupacao alta com janela curta',
  },
  {
    id: 'OCC-002',
    mode: 'OCCUPANCY',
    tenantId: 'tenant-harness-22',
    payload: { rate: 0.72, leadTimeDays: 14, channel: 'parceiro' },
    expectedLabel: 'MEDIA_OCUPACAO',
    note: 'faixa intermediaria',
  },
  {
    id: 'OCC-003',
    mode: 'OCCUPANCY',
    tenantId: 'tenant-harness-23',
    payload: { rate: 0.35, leadTimeDays: 45, channel: 'site' },
    expectedLabel: 'BAIXA_OCUPACAO',
    note: 'ocupacao baixa com janela longa',
  },
  {
    id: 'OCC-004',
    mode: 'OCCUPANCY',
    tenantId: 'tenant-harness-24',
    payload: { rate: 0.6, leadTimeDays: 7, channel: 'direto' },
    expectedLabel: 'MEDIA_OCUPACAO',
    note: 'fronteira inclusiva (rate 0.6 pertence a faixa media)',
  },
  // ------------------------------------------------------------------ UPSELL
  {
    id: 'UPS-001',
    mode: 'UPSELL',
    tenantId: 'tenant-harness-25',
    payload: { partySize: 5, nights: 2, totalValue: 1800, tier: 'standard' },
    expectedLabel: 'OFERECER_UPGRADE',
    note: 'grupo grande: upgrade faz sentido',
  },
  {
    id: 'UPS-002',
    mode: 'UPSELL',
    tenantId: 'tenant-harness-26',
    payload: { partySize: 2, nights: 3, totalValue: 900, tier: 'standard' },
    expectedLabel: 'NAO_OFERECER',
    note: 'casal, estadia curta: sem sinal de upgrade',
  },
  {
    id: 'UPS-003',
    mode: 'UPSELL',
    tenantId: 'tenant-harness-27',
    payload: { partySize: 2, nights: 7, totalValue: 4900, tier: 'standard' },
    expectedLabel: 'OFERECER_UPGRADE',
    note: 'estadia longa: upgrade faz sentido',
  },
  {
    id: 'UPS-004',
    mode: 'UPSELL',
    tenantId: 'tenant-harness-28',
    payload: { partySize: 3, nights: 4, totalValue: 1500, tier: 'standard' },
    expectedLabel: 'NAO_OFERECER',
    note: 'grupo medio, estadia media: abaixo dos limiares',
  },
];
