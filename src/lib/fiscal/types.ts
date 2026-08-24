export type FiscalDocumentDirection = 'OUTBOUND_TO_GUEST' | 'SUPPLIER_TO_ZELLA';
export type FiscalDocumentStatus = 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'AUTHORIZED' | 'CANCELED' | 'ERROR' | 'MANUAL_REQUIRED';

export interface FiscalCustomer {
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
  };
}

export interface FiscalServiceItem {
  description: string;
  value: number;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName: string;
  deductions?: number;
  observations?: string;
}

export interface ScheduleNfseInput {
  tenantId: string;
  paymentId?: string;
  customerId?: string;
  effectiveDate?: string;
  customer: FiscalCustomer;
  service: FiscalServiceItem;
  receivedOnly?: boolean;
  externalReference: string;
}

export interface FiscalDocumentResult {
  provider: 'asaas';
  providerInvoiceId: string;
  direction: FiscalDocumentDirection;
  status: FiscalDocumentStatus;
  number?: string;
  validationCode?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  issuedAt?: string;
  errorMessage?: string;
  raw?: unknown;
}

export interface FiscalProvider {
  scheduleNfse(input: ScheduleNfseInput): Promise<FiscalDocumentResult>;
  authorizeNfse(invoiceId: string): Promise<FiscalDocumentResult>;
  getNfse(invoiceId: string): Promise<FiscalDocumentResult>;
  cancelNfse(invoiceId: string, reason: string): Promise<FiscalDocumentResult>;
}

export interface SupplierFiscalRequest {
  tenantId: string;
  supplierName: string;
  supplierDocument?: string;
  recipientLegalName: string;
  recipientDocument?: string;
  serviceDescription: string;
  amount: number;
  referenceId: string;
  status: 'REQUESTED' | 'ISSUED_BY_SUPPLIER' | 'RECEIVED' | 'VALIDATED' | 'REJECTED';
}
