import { ASAAS_ACCESS_TOKEN, ASAAS_ENVIRONMENT, ASAAS_MUNICIPAL_SERVICE_CODE, ASAAS_MUNICIPAL_SERVICE_NAME } from '@/lib/env';
import type { FiscalDocumentResult, FiscalProvider, ScheduleNfseInput } from '../types';

const BASE_URL = ASAAS_ENVIRONMENT === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/v3';

interface AsaasInvoice {
  id: string;
  status?: 'SCHEDULED' | 'SYNCHRONIZED' | 'AUTHORIZED' | 'PROCESSING_CANCELLATION' | 'CANCELED' | 'CANCELLATION_DENIED' | 'ERROR';
  number?: string;
  validationCode?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  effectiveDate?: string;
  error?: string;
}

function configured(): boolean {
  return Boolean(ASAAS_ACCESS_TOKEN && !ASAAS_ACCESS_TOKEN.startsWith('$'));
}

function headers(): HeadersInit {
  if (!configured()) throw new Error('ASAAS_FISCAL_NOT_CONFIGURED');
  return {
    access_token: ASAAS_ACCESS_TOKEN,
    'Content-Type': 'application/json',
    'User-Agent': 'SeuZella/1.0 (+https://seuzella.com.br)',
  };
}

function normalize(invoice: AsaasInvoice, direction: 'OUTBOUND_TO_GUEST' | 'SUPPLIER_TO_ZELLA' = 'OUTBOUND_TO_GUEST'): FiscalDocumentResult {
  const status = invoice.status === 'AUTHORIZED' ? 'AUTHORIZED'
    : invoice.status === 'SCHEDULED' ? 'SCHEDULED'
    : invoice.status === 'CANCELED' ? 'CANCELED'
    : invoice.status === 'PROCESSING_CANCELLATION' ? 'PROCESSING'
    : invoice.status === 'ERROR' || invoice.status === 'CANCELLATION_DENIED' ? 'ERROR'
    : 'PROCESSING';

  return {
    provider: 'asaas',
    providerInvoiceId: invoice.id,
    direction,
    status,
    number: invoice.number,
    validationCode: invoice.validationCode,
    pdfUrl: invoice.pdfUrl,
    xmlUrl: invoice.xmlUrl,
    issuedAt: invoice.effectiveDate,
    errorMessage: invoice.error,
    raw: invoice,
  };
}

export class AsaasFiscalProvider implements FiscalProvider {
  async scheduleNfse(input: ScheduleNfseInput): Promise<FiscalDocumentResult> {
    if (!configured()) throw new Error('ASAAS_FISCAL_NOT_CONFIGURED');
    if (!input.externalReference) throw new Error('FISCAL_EXTERNAL_REFERENCE_REQUIRED');
    if (!input.customer.name.trim()) throw new Error('FISCAL_CUSTOMER_NAME_REQUIRED');
    if (!input.service.description.trim()) throw new Error('FISCAL_SERVICE_DESCRIPTION_REQUIRED');
    if (!input.service.municipalServiceName.trim()) throw new Error('FISCAL_MUNICIPAL_SERVICE_NAME_REQUIRED');
    if (!input.service.municipalServiceId && !(input.service.municipalServiceCode ?? ASAAS_MUNICIPAL_SERVICE_CODE)) {
      throw new Error('FISCAL_MUNICIPAL_SERVICE_REQUIRED');
    }

    const payload: Record<string, unknown> = {
      payment: input.paymentId || undefined,
      customer: input.customerId || undefined,
      effectiveDate: input.effectiveDate ?? new Date().toISOString().slice(0, 10),
      externalReference: input.externalReference,
      value: input.service.value,
      deductions: input.service.deductions ?? 0,
      serviceDescription: input.service.description,
      municipalServiceId: input.service.municipalServiceId || undefined,
      municipalServiceCode: input.service.municipalServiceId ? undefined : (input.service.municipalServiceCode ?? ASAAS_MUNICIPAL_SERVICE_CODE),
      municipalServiceName: input.service.municipalServiceName || ASAAS_MUNICIPAL_SERVICE_NAME,
      observations: input.service.observations,
      updatePayment: false,
      taxes: {},
    };

    if (!payload.payment && !payload.customer) throw new Error('ASAAS_FISCAL_ORIGIN_REQUIRED');

    const response = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as AsaasInvoice & { errors?: unknown };
    if (!response.ok) throw new Error(`ASAAS_FISCAL_SCHEDULE_FAILED_${response.status}`);
    return normalize(body);
  }

  async authorizeNfse(invoiceId: string): Promise<FiscalDocumentResult> {
    if (!invoiceId) throw new Error('FISCAL_INVOICE_ID_REQUIRED');
    const response = await fetch(`${BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/authorize`, { method: 'POST', headers: headers() });
    const body = (await response.json()) as AsaasInvoice;
    if (!response.ok) throw new Error(`ASAAS_FISCAL_AUTHORIZE_FAILED_${response.status}`);
    return normalize(body);
  }

  async getNfse(invoiceId: string): Promise<FiscalDocumentResult> {
    if (!invoiceId) throw new Error('FISCAL_INVOICE_ID_REQUIRED');
    const response = await fetch(`${BASE_URL}/invoices/${encodeURIComponent(invoiceId)}`, { headers: headers() });
    const body = (await response.json()) as AsaasInvoice;
    if (!response.ok) throw new Error(`ASAAS_FISCAL_GET_FAILED_${response.status}`);
    return normalize(body);
  }

  async cancelNfse(invoiceId: string, reason: string): Promise<FiscalDocumentResult> {
    if (!invoiceId) throw new Error('FISCAL_INVOICE_ID_REQUIRED');
    if (!reason.trim()) throw new Error('FISCAL_CANCEL_REASON_REQUIRED');
    const response = await fetch(`${BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ cancelOnlyOnAsaas: false, reason }),
    });
    const body = (await response.json()) as AsaasInvoice;
    if (!response.ok) throw new Error(`ASAAS_FISCAL_CANCEL_FAILED_${response.status}`);
    return normalize(body);
  }
}
