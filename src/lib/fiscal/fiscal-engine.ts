import type { FiscalDocumentResult, FiscalProvider, ScheduleNfseInput, SupplierFiscalRequest } from './types';

export type FiscalProviderId = 'asaas';

export interface FiscalEngineOptions {
  asaas?: FiscalProvider;
}

export class FiscalEngine {
  private readonly providers: Record<FiscalProviderId, FiscalProvider | undefined>;

  constructor(options: FiscalEngineOptions = {}) {
    this.providers = { asaas: options.asaas };
  }

  async scheduleGuestNfse(input: ScheduleNfseInput): Promise<FiscalDocumentResult> {
    return this.requireProvider('asaas').scheduleNfse({ ...input, externalReference: this.requireReference(input.externalReference) });
  }

  async authorize(provider: FiscalProviderId, invoiceId: string): Promise<FiscalDocumentResult> {
    return this.requireProvider(provider).authorizeNfse(invoiceId);
  }

  async get(provider: FiscalProviderId, invoiceId: string): Promise<FiscalDocumentResult> {
    return this.requireProvider(provider).getNfse(invoiceId);
  }

  async cancel(provider: FiscalProviderId, invoiceId: string, reason: string): Promise<FiscalDocumentResult> {
    return this.requireProvider(provider).cancelNfse(invoiceId, reason);
  }

  /**
   * The supplier -> Zélla direction is deliberately a workflow request.
   * The supplier remains the fiscal issuer; the platform stores the request
   * and validation state instead of pretending to issue the supplier invoice.
   */
  prepareSupplierInvoiceRequest(input: SupplierFiscalRequest): SupplierFiscalRequest {
    if (!input.tenantId.trim()) throw new Error('FISCAL_TENANT_ID_REQUIRED');
    if (!input.supplierDocument?.trim()) throw new Error('FISCAL_SUPPLIER_DOCUMENT_REQUIRED');
    if (!input.recipientLegalName.trim()) throw new Error('FISCAL_RECIPIENT_REQUIRED');
    if (input.amount <= 0) throw new Error('FISCAL_AMOUNT_MUST_BE_POSITIVE');
    if (!input.referenceId.trim()) throw new Error('FISCAL_REFERENCE_REQUIRED');

    return {
      ...input,
      supplierName: input.supplierName.trim(),
      supplierDocument: input.supplierDocument.trim(),
      recipientLegalName: input.recipientLegalName.trim(),
      recipientDocument: input.recipientDocument?.trim() || undefined,
      serviceDescription: input.serviceDescription.trim(),
      referenceId: input.referenceId.trim(),
    };
  }

  private requireProvider(provider: FiscalProviderId): FiscalProvider {
    const instance = this.providers[provider];
    if (!instance) throw new Error(`FISCAL_PROVIDER_NOT_CONFIGURED:${provider}`);
    return instance;
  }

  private requireReference(value: string): string {
    const reference = value.trim();
    if (!reference) throw new Error('FISCAL_EXTERNAL_REFERENCE_REQUIRED');
    return reference;
  }
}
