/**
 * LGPD RETENTION POLICY — Wave 16 / F14
 * ============================================================================
 * Defines retention periods per data category (LGPD art. 16).
 * Configurable via env vars, with conservative defaults.
 *
 * STATUS: CODE_READY
 * RUNTIME_VALIDATED: FALSE (requires production data to validate)
 */

export interface RetentionPolicy {
  category: string;
  description: string;
  retentionDays: number;
  action: 'delete' | 'anonymize';
  legalBasis: string;
}

export const RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  conversation_logs: {
    category: 'conversation_logs',
    description: 'WhatsApp conversation logs between guest and Zélla AI',
    retentionDays: parseInt(process.env.LGPD_RETENTION_CONVERSATION_DAYS || '180', 10),
    action: 'delete',
    legalBasis: 'Legitimate interest (art. 7º, IX) — AI training and quality improvement',
  },
  guest_registrations: {
    category: 'guest_registrations',
    description: 'FNRH (guest registration) data',
    retentionDays: parseInt(process.env.LGPD_RETENTION_FNRH_DAYS || '1825', 10), // 5 years per Brazilian hotel law
    action: 'anonymize',
    legalBasis: 'Legal obligation (art. 7º, II) — Brazilian hotel registration law',
  },
  payment_transactions: {
    category: 'payment_transactions',
    description: 'Payment transaction records',
    retentionDays: parseInt(process.env.LGPD_RETENTION_PAYMENT_DAYS || '2555', 10), // 7 years per tax law
    action: 'anonymize',
    legalBasis: 'Legal obligation (art. 7º, II) — Brazilian tax and fiscal law',
  },
  consent_records: {
    category: 'consent_records',
    description: 'LGPD consent records (proof of consent)',
    retentionDays: parseInt(process.env.LGPD_RETENTION_CONSENT_DAYS || '1825', 10), // 5 years
    action: 'delete',
    legalBasis: 'Legitimate interest (art. 7º, IX) — proof of consent',
  },
  audit_logs: {
    category: 'audit_logs',
    description: 'Security audit logs',
    retentionDays: parseInt(process.env.LGPD_RETENTION_AUDIT_DAYS || '365', 10),
    action: 'delete',
    legalBasis: 'Legitimate interest (art. 7º, IX) — security monitoring',
  },
  deleted_account_data: {
    category: 'deleted_account_data',
    description: 'Data from deleted tenant accounts (grace period)',
    retentionDays: parseInt(process.env.LGPD_RETENTION_DELETED_DAYS || '90', 10),
    action: 'delete',
    legalBasis: 'Data subject rights (art. 18, VI) — right to deletion',
  },
};

/**
 * Returns the retention policy for a given data category.
 * Throws if category is unknown.
 */
export function getRetentionPolicy(category: string): RetentionPolicy {
  const policy = RETENTION_POLICIES[category];
  if (!policy) {
    throw new Error(`UNKNOWN_RETENTION_CATEGORY: ${category}`);
  }
  return policy;
}

/**
 * Checks if a record has exceeded its retention period.
 */
export function isRetentionExpired(createdAt: Date, category: string): boolean {
  const policy = getRetentionPolicy(category);
  const expiryDate = new Date(createdAt.getTime() + policy.retentionDays * 86400000);
  return new Date() > expiryDate;
}

/**
 * Returns all retention policies for documentation/audit.
 */
export function getAllRetentionPolicies(): RetentionPolicy[] {
  return Object.values(RETENTION_POLICIES);
}
