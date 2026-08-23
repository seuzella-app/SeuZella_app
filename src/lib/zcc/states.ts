import type { UF, Region } from "./types";

export const STATE_NAMES: Record<UF, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

export const STATE_REGION: Record<UF, Region> = {
  AC: "Norte", AL: "Nordeste", AP: "Norte", AM: "Norte", BA: "Nordeste",
  CE: "Nordeste", DF: "Centro-Oeste", ES: "Sudeste", GO: "Centro-Oeste",
  MA: "Nordeste", MT: "Centro-Oeste", MS: "Centro-Oeste", MG: "Sudeste",
  PA: "Norte", PB: "Nordeste", PR: "Sul", PE: "Nordeste", PI: "Nordeste",
  RJ: "Sudeste", RN: "Nordeste", RS: "Sul", RO: "Norte", RR: "Norte",
  SC: "Sul", SP: "Sudeste", SE: "Nordeste", TO: "Norte",
};

export const STATE_CENTROID: Record<UF, { x: number; y: number }> = {
  AC: { x: 25, y: 55 }, AL: { x: 65, y: 55 }, AP: { x: 48, y: 18 },
  AM: { x: 32, y: 30 }, BA: { x: 55, y: 50 }, CE: { x: 72, y: 25 },
  DF: { x: 50, y: 55 }, ES: { x: 62, y: 65 }, GO: { x: 48, y: 52 },
  MA: { x: 58, y: 28 }, MT: { x: 40, y: 48 }, MS: { x: 38, y: 62 },
  MG: { x: 55, y: 58 }, PA: { x: 45, y: 30 }, PB: { x: 72, y: 40 },
  PR: { x: 45, y: 72 }, PE: { x: 70, y: 38 }, PI: { x: 62, y: 32 },
  RJ: { x: 58, y: 68 }, RN: { x: 72, y: 30 }, RS: { x: 42, y: 85 },
  RO: { x: 28, y: 48 }, RR: { x: 40, y: 12 }, SC: { x: 44, y: 78 },
  SP: { x: 50, y: 68 }, SE: { x: 68, y: 48 }, TO: { x: 55, y: 38 },
};
