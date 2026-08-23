/**
 * ZCC Type Extensions — corrige propriedades usadas nos painéis do ZCC
 * que não existem no modelo Prisma Lead nativo.
 *
 * Estes tipos são usados APENAS nos componentes do ZCC para visualização.
 * As propriedades são populadas via mock-data ou via mapeamento em runtime.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Lead extended — propriedades usadas nos painéis do ZCC
// ─────────────────────────────────────────────────────────────────────────────
export type LeadStatus = 'novo' | 'contatado' | 'qualificado' | 'reservou' | 'perdido';

export interface Validacao {
  whatsapp?: boolean;
  email?: boolean;
  cnpj?: boolean;
}

export interface ComportamentoCompra {
  urgencia?: 'baixa' | 'media' | 'alta';
  orcamento?: number;
  flexivel?: boolean;
}

export interface LeadExtended {
  // Propriedades do ZCC que não estão no Prisma Lead
  scoreQual?: number;
  pousada?: string;
  cidade?: string;
  regiao?: string;
  sinaisIntencao?: string[];
  qtdQuartos?: number;
  valoresEstimados?: number[];
  comportamentoCompra?: ComportamentoCompra;
  validacao?: Validacao;
  qualificacao?: string;
  redesSociais?: string[];
  channel?: string;
  value?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DDCPanelId — usado no ddc-panel.tsx
// ─────────────────────────────────────────────────────────────────────────────
export type DDCPanelId =
  | 'overview'
  | 'messages'
  | 'guests'
  | 'bookings'
  | 'analytics'
  | 'notifications'
  | 'settings'
  | 'upsell'
  | 'airb'
  | 'locks'
  | 'training'
  | 'linkinbio';

// ─────────────────────────────────────────────────────────────────────────────
// LeadsStats extended
// ─────────────────────────────────────────────────────────────────────────────
export interface LeadsStatsExtended {
  avgScoreQual?: number;
  avgScore?: number;
}
