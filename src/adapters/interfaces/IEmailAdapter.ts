// ============================================================================
// IEmailAdapter — contract for transactional + marketing email
// ----------------------------------------------------------------------------
// In Digital Twin mode: never sends. Records to a local outbox with
// `status = 'sent'` so downstream flows (onboarding, dunning, etc.) work.
// In Real mode: connects to the configured ESP (Resend, SES, etc.).
// ============================================================================

export interface EmailInput {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  /** Template id + params, when using a pre-approved template. */
  templateId?: string;
  templateParams?: Record<string, unknown>;
  /** Optional tags for segmentation / suppression. */
  tags?: string[];
  /** Correlation id linking back to a workflow. */
  correlationId?: string;
}

export interface EmailRecord {
  emailId: string;
  to: string;
  from: string;
  subject: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked';
  timestamp: string;
  correlationId?: string;
  tags?: string[];
}

export interface IEmailAdapter {
  send(input: EmailInput): Promise<EmailRecord>;
  /** Fetch the delivery history for an email address. */
  history(to: string, limit?: number): Promise<EmailRecord[]>;
  /** Suppress an address (unsubscribe). Future sends are no-ops. */
  suppress(to: string, reason: string): Promise<void>;
  isSuppressed(to: string): Promise<boolean>;
  isDigitalTwin(): boolean;
}
