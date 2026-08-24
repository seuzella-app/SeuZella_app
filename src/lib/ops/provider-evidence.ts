export type ProviderName = 'asaas' | 'mercadopago' | 'whatsapp';
export type EvidenceStatus = 'pass' | 'fail' | 'blocked';

export interface ProviderEvidence {
  provider: ProviderName;
  capability: 'payment' | 'fiscal' | 'messaging';
  status: EvidenceStatus;
  environment: 'sandbox' | 'production';
  referenceId: string;
  observedAt: string;
  checks: Record<string, boolean>;
  notes?: string;
}

export function isOperationalEvidence(evidence: ProviderEvidence): boolean {
  return (
    evidence.status === 'pass' &&
    Object.values(evidence.checks).every(Boolean) &&
    evidence.referenceId.trim().length > 0
  );
}
