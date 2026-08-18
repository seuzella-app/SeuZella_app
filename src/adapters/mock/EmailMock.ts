// ============================================================================
// EmailMock — Digital Twin email (Resend / SES equivalent)
// ----------------------------------------------------------------------------
// Never sends. Records to a local outbox with status 'sent' so downstream
// flows (onboarding, dunning, marketing) work end-to-end.
// ============================================================================

import type { IEmailAdapter, EmailInput, EmailRecord } from '../interfaces';

class EmailMock implements IEmailAdapter {
  private outbox: EmailRecord[] = [];
  private suppressed = new Set<string>();

  async send(input: EmailInput): Promise<EmailRecord> {
    if (await this.isSuppressed(input.to)) {
      // No-op send for suppressed addresses (LGPD / CAN-SPAM compliance).
      return {
        emailId: `email_suppressed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        to: input.to,
        from: input.from ?? 'noreply@zella.com.br',
        subject: input.subject,
        status: 'bounced',
        timestamp: new Date().toISOString(),
        correlationId: input.correlationId,
        tags: input.tags,
      };
    }
    const record: EmailRecord = {
      emailId: `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      to: input.to,
      from: input.from ?? 'noreply@zella.com.br',
      subject: input.subject,
      status: 'sent',
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId,
      tags: input.tags,
    };
    this.outbox.push(record);

    // Simulate delivered → opened → clicked progression.
    setTimeout(() => {
      this.outbox = this.outbox.map((r) =>
        r.emailId === record.emailId ? { ...r, status: 'delivered' } : r
      );
    }, 300);
    // 40% open rate, 8% click rate (industry benchmarks).
    setTimeout(() => {
      if (Math.random() < 0.4) {
        this.outbox = this.outbox.map((r) =>
          r.emailId === record.emailId ? { ...r, status: 'opened' } : r
        );
        if (Math.random() < 0.2) {
          this.outbox = this.outbox.map((r) =>
            r.emailId === record.emailId ? { ...r, status: 'clicked' } : r
          );
        }
      }
    }, 2000);

    return record;
  }

  async history(to: string, limit = 100): Promise<EmailRecord[]> {
    return this.outbox
      .filter((r) => r.to === to)
      .slice(-limit);
  }

  async suppress(to: string, _reason: string): Promise<void> {
    this.suppressed.add(to.toLowerCase());
  }

  async isSuppressed(to: string): Promise<boolean> {
    return this.suppressed.has(to.toLowerCase());
  }

  isDigitalTwin(): boolean {
    return true;
  }

  /** Test/observability helper. */
  allEmails(): EmailRecord[] {
    return [...this.outbox];
  }
}

export const emailMock = new EmailMock();
