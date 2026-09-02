export type ReleaseGateStatus = 'PASS' | 'BLOCKED';

export interface ReleaseGateInput {
  nodeEnv: string;
  databaseUrl?: string;
  nextAuthSecret?: string;
  encryptionSecret?: string;
  cacheSigningSecret?: string;
  whatsappCommercial?: string;
  whatsappSupport?: string;
  demoMode?: string;
  bypassMiddlewareAuth?: string;
  paymentGateway?: string;
  asaasAccessToken?: string;
  asaasWebhookSecret?: string;
  mpAccessToken?: string;
  paymentWebhookSecret?: string;
}

export interface ReleaseGateResult {
  status: ReleaseGateStatus;
  blockers: string[];
}

function requiredSecret(name: string, value: string | undefined, blockers: string[]): void {
  if (!value || value.length < 32) blockers.push(`${name}:missing-or-too-short`);
}

function requiredProviderSecret(name: string, value: string | undefined, blockers: string[]): void {
  if (!value) blockers.push(`${name}:missing`);
}

/**
 * Deterministic production release gate. It never prints secret values and
 * does not contact external providers. Runtime/staging verification remains a
 * separate gate; this function only validates configuration invariants.
 */
export function evaluateProductionReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  const blockers: string[] = [];
  if (input.nodeEnv !== 'production') return { status: 'PASS', blockers };

  if (input.demoMode === 'true') blockers.push('ZELLA_DEMO_MODE:true');
  if (input.bypassMiddlewareAuth === 'true') blockers.push('BYPASS_MIDDLEWARE_AUTH:true');
  if (!/^postgres(?:ql)?:\/\//.test(input.databaseUrl ?? '')) blockers.push('DATABASE_URL:not-postgresql');

  requiredSecret('NEXTAUTH_SECRET', input.nextAuthSecret, blockers);
  requiredSecret('ENCRYPTION_SECRET', input.encryptionSecret, blockers);
  requiredSecret('CACHE_SIGNING_SECRET', input.cacheSigningSecret, blockers);

  if (!input.whatsappCommercial) blockers.push('WHATSAPP_COMMERCIAL:missing');
  if (!input.whatsappSupport) blockers.push('WHATSAPP_SUPPORT:missing');

  if (input.paymentGateway === 'asaas') {
    requiredProviderSecret('ASAAS_ACCESS_TOKEN', input.asaasAccessToken, blockers);
    requiredProviderSecret('ASAAS_WEBHOOK_SECRET', input.asaasWebhookSecret, blockers);
  }
  if (input.paymentGateway === 'mercadopago') {
    requiredProviderSecret('MP_ACCESS_TOKEN', input.mpAccessToken, blockers);
    requiredProviderSecret('PAYMENT_WEBHOOK_SECRET', input.paymentWebhookSecret, blockers);
  }

  return { status: blockers.length === 0 ? 'PASS' : 'BLOCKED', blockers };
}
