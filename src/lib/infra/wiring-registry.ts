/**
 * SEUZELLA — wiring-registry.ts (gerado pelo kit RUN13-A; NÃO editar à mão)
 *
 * Registro real das rotas com a camada W2 aplicada (guardRequest +
 * auditRouteEvent) por onda, e payload de saúde consumido pelo /api/health.
 */
export const WIRING_REGISTRY = {
  version: 'RUN13-A',
  generatedAt: '2026-09-21T23:40:17.283Z',
  waves: [
    { wave: 'RUN11-W3', wired: ["readiness","brain","checkout.webhook"] },
    { wave: 'RUN13-A', wired: ["airb-pro.comparativo","airb-pro.rentabilidade","airb-pro.yield-suggestion","checkout.cancel","checkout.create","checkout.downgrade","checkout.pix-status","checkout.success"] },
  ],
  healthPayload: false,
} as const;

export function w2Status(): {
  wiring: string;
  wiredRoutes: number;
  guards: string;
  audit: string;
  healthPayload: boolean;
} {
  const total = WIRING_REGISTRY.waves.reduce((n, w) => n + w.wired.length, 0);
  return {
    wiring: WIRING_REGISTRY.version,
    wiredRoutes: total,
    guards: 'guardRequest',
    audit: 'auditRouteEvent',
    healthPayload: WIRING_REGISTRY.healthPayload,
  };
}
