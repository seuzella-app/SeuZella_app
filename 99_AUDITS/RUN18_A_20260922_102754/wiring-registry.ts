/**
 * SEUZELLA — wiring-registry.ts (gerado pelo kit RUN18-A MOP-UP; NÃO editar à mão)
 *
 * Registro real das rotas com a camada W2 aplicada (guardRequest +
 * auditRouteEvent) por onda, e payload de saúde consumido pelo /api/health.
 */
export const WIRING_REGISTRY = {
  version: 'RUN18-A',
  generatedAt: '2026-09-22T13:28:27.892Z',
  waves: [
    { wave: 'RUN11-W3', wired: ["readiness","brain","checkout.webhook"] },
    { wave: 'RUN13-A', wired: ["airb-pro.comparativo","airb-pro.rentabilidade","airb-pro.yield-suggestion","checkout.cancel","checkout.create","checkout.downgrade","checkout.pix-status","checkout.success"] },
    { wave: 'RUN14-A', wired: ["ddc.airb.properties","ddc.airb.scrape","ddc.billing.invoices","v1.reservations.[id].payment","webhook-whatsapp","webhooks.asaas","webhooks.booking-com.reviews","webhooks.mercadopago","webhooks.payment","webhooks.whatsapp","zcc.airbnb.oauth","zcc.airbnb.webhook","zcc.cerebro.llmops","zcc.github.webhook","zcc.leads.brain-analyze","zcc.synthetic-brazil.generate","zelador-suporte.chat","admin.faturamento-zehla","admin.upsell-analytics","dashboard.bookings","dashboard.overview","ddc.booking-sync","ddc.bookings","ddc.linkinbio.stats","ddc.metrics","ddc.realtime.tenant-state","ddc.upsell.metrics","feedback.stats","meta-costs","tenants","v1.metrics","v1.reservations","zcc.code-reviewer.stats","zcc.dashboard-stats","zcc.metrics.financial","zcc.metrics.geographic","zcc.stats","zcc.tenants","zcc.whatsapp.simulate","zcc.ze-code.stats"] },
    { wave: 'RUN18-A', wired: ["channel-manager","ddc.cerebro.feedback","ddc.credits.track-click","ddc.linkinbio.activate-standalone","ddc.linkinbio.purchase-addon","ddc.linkinbio","ddc.notifications.v2","ddc.partner-program.waitlist","debug-agent.github","debug-agent.knowledge","debug-agent","diagnose","leads.seed","pulse.io","scraping","telemetry.ingest","v1.loops","zcc.digital-twin","zcc.dspy-compiler","zcc.national-simulator.compare","zcc.national-simulator","zcc.simulation-lab","zelador-suporte.consultoria","zelador-suporte.ticket","zella.simulate","ddc.cerebro.learning","zcc.cerebro.stream","zcc.cognitive-bus","zcc.cognitive-memory","zcc.infra.scaling-ruler"] },
  ],
  healthPayload: true,
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
