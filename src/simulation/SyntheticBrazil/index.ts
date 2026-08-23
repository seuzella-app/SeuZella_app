// ============================================================================
// Synthetic Brazil — public surface
// ============================================================================

export {
  generateSyntheticBrazil,
  seedForCity,
} from './SyntheticBrazil';
export type {
  SyntheticBrazilSnapshot,
  SyntheticPousada,
  SyntheticAirbnbProperty,
  SyntheticGuest,
  SyntheticCompetitor,
  GenerateSyntheticBrazilOptions,
} from './SyntheticBrazil';
export {
  BRAZILIAN_STATES,
  ANCHOR_CITIES,
  getStateByCode,
} from './BrazilianGeography';
export type { BrazilianState, BrazilianCity } from './BrazilianGeography';
