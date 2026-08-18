// ==============================================================================
// SEUZÉLLA — Asaas Billing Client & Service (SaaS B2B Gateway v3)
// ==============================================================================
// Suporte a:
// 1. Busca hierárquica idempotente (externalReference -> cpfCnpj -> email)
// 2. Emissão de cobrança híbrida (Plano Base Fixo + Taxa de Sucesso UPSELL)
// 3. Assinatura recorrente nativa
// 4. Consulta de faturas (invoiceUrl, bankSlipUrl, pixQrCode)
// 5. Emissão e consulta de NFS-e Municipal automática
// ==============================================================================

import { ASAAS_ACCESS_TOKEN, ASAAS_ENVIRONMENT } from '@/lib/env';

export const ASAAS_BASE_URL =
  ASAAS_ENVIRONMENT === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/v3';

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  dueDate: string;
  status:
    | 'PENDING'
    | 'RECEIVED'
    | 'CONFIRMED'
    | 'OVERDUE'
    | 'REFUNDED'
    | 'RECEIVED_IN_CASH'
    | 'REFUND_REQUESTED'
    | 'CHARGEBACK_REQUESTED'
    | 'CHARGEBACK_DISPUTE'
    | 'AWAITING_RISK_ANALYSIS';
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  invoiceUrl: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  description?: string;
  externalReference?: string;
  pixQrCode?: string;
  pixCopyAndPaste?: string;
}

export interface AsaasFiscalInvoice {
  id: string;
  payment: string;
  status: 'PENDING' | 'SYNCHRONIZED' | 'AUTHORIZED' | 'PROCESSING_CANCELLATION' | 'CANCELED' | 'ERROR';
  pdfUrl?: string;
  xmlUrl?: string;
  rpsNumber?: string;
  number?: string;
  validationCode?: string;
}

export class AsaasBillingService {
  private static getHeaders(): HeadersInit {
    const token = ASAAS_ACCESS_TOKEN || process.env.ASAAS_ACCESS_TOKEN || '';
    return {
      access_token: token,
      'Content-Type': 'application/json',
      'User-Agent': 'SeuZella-SaaS/1.0 (+https://seuzella.com.br)',
    };
  }

  /**
   * Verifica se as credenciais do Asaas estão configuradas no ambiente
   */
  static isConfigured(): boolean {
    const token = ASAAS_ACCESS_TOKEN || process.env.ASAAS_ACCESS_TOKEN || '';
    return Boolean(token) && !token.startsWith('$');
  }

  /**
   * Busca ou cria cliente no Asaas com idempotência e prioridade hierárquica:
   * 1. externalReference (tenantId do Seu Zélla)
   * 2. cpfCnpj (documento único da pousada)
   * 3. email
   * 4. Criação de novo registro se não existir
   */
  static async ensureCustomer(params: {
    tenantId: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
  }): Promise<string> {
    if (!this.isConfigured()) {
      return `cus_mock_${params.tenantId}`;
    }

    const headers = this.getHeaders();

    // 1. Busca por externalReference (tenantId)
    try {
      const byRefRes = await fetch(
        `${ASAAS_BASE_URL}/customers?externalReference=${encodeURIComponent(params.tenantId)}`,
        { headers }
      );
      if (byRefRes.ok) {
        const data = (await byRefRes.json()) as { data?: AsaasCustomer[] };
        if (data.data && data.data.length > 0) {
          return data.data[0].id;
        }
      }
    } catch (e) {
      console.warn('[AsaasBilling] Falha na busca por externalReference:', e);
    }

    // 2. Busca por CPF/CNPJ limpo (apenas números)
    const cleanDoc = params.cpfCnpj ? params.cpfCnpj.replace(/\D/g, '') : '';
    if (cleanDoc) {
      try {
        const byDocRes = await fetch(
          `${ASAAS_BASE_URL}/customers?cpfCnpj=${encodeURIComponent(cleanDoc)}`,
          { headers }
        );
        if (byDocRes.ok) {
          const data = (await byDocRes.json()) as { data?: AsaasCustomer[] };
          if (data.data && data.data.length > 0) {
            return data.data[0].id;
          }
        }
      } catch (e) {
        console.warn('[AsaasBilling] Falha na busca por cpfCnpj:', e);
      }
    }

    // 3. Busca por E-mail
    if (params.email) {
      try {
        const byEmailRes = await fetch(
          `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(params.email.trim())}`,
          { headers }
        );
        if (byEmailRes.ok) {
          const data = (await byEmailRes.json()) as { data?: AsaasCustomer[] };
          if (data.data && data.data.length > 0) {
            return data.data[0].id;
          }
        }
      } catch (e) {
        console.warn('[AsaasBilling] Falha na busca por email:', e);
      }
    }

    // 4. Criação de novo cliente
    const cleanPhone = params.phone ? params.phone.replace(/\D/g, '') : '';
    const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: params.name.trim(),
        email: params.email.trim(),
        cpfCnpj: cleanDoc || undefined,
        mobilePhone: cleanPhone || undefined,
        externalReference: params.tenantId,
        notificationDisabled: false,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`[AsaasBilling] Erro ao criar cliente: ${createRes.status} — ${errText}`);
    }

    const newCustomer = (await createRes.json()) as AsaasCustomer;
    return newCustomer.id;
  }

  /**
   * Obtém todas as cobranças da pousada pelo asaasCustomerId
   */
  static async getTenantInvoices(asaasCustomerId: string): Promise<AsaasPayment[]> {
    if (!this.isConfigured() || asaasCustomerId.startsWith('cus_mock')) {
      return [
        {
          id: 'pay_mock_1',
          customer: asaasCustomerId,
          value: 247.0,
          dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          status: 'PENDING',
          billingType: 'UNDEFINED',
          invoiceUrl: 'https://sandbox.asaas.com/i/mock1',
          description: 'Seu Zélla — Plano PARCEIRO (R$ 247,00) • Ref: Atual',
        },
      ];
    }

    const headers = this.getHeaders();
    const res = await fetch(
      `${ASAAS_BASE_URL}/payments?customer=${encodeURIComponent(asaasCustomerId)}&limit=20`,
      { headers }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[AsaasBilling] Falha ao buscar faturas: ${res.status} — ${err}`);
    }

    const json = (await res.json()) as { data?: AsaasPayment[] };
    return json.data || [];
  }

  /**
   * Cria fatura mensal consolidada (Plano Base Fixo + Taxa de UPSELL)
   * Descrição limitada e formatada conforme padrão de até 500 caracteres.
   */
  static async createMonthlyInvoice(params: {
    customerId: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference?: string;
  }): Promise<AsaasPayment> {
    const sanitizedDescription = params.description.trim().slice(0, 480);

    if (!this.isConfigured()) {
      return {
        id: `pay_mock_${Date.now()}`,
        customer: params.customerId,
        value: params.value,
        dueDate: params.dueDate,
        status: 'PENDING',
        billingType: 'UNDEFINED',
        invoiceUrl: `https://sandbox.asaas.com/i/mock_${Date.now()}`,
        description: sanitizedDescription,
        externalReference: params.externalReference,
      };
    }

    const headers = this.getHeaders();
    const res = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: params.customerId,
        billingType: 'UNDEFINED', // Permite que a pousada escolha PIX, Boleto ou Cartão
        value: Number(params.value.toFixed(2)),
        dueDate: params.dueDate,
        description: sanitizedDescription,
        externalReference: params.externalReference,
        postalService: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[AsaasBilling] Erro ao emitir cobrança mensal: ${res.status} — ${err}`);
    }

    return (await res.json()) as AsaasPayment;
  }

  /**
   * Busca dados da Nota Fiscal Municipal (NFS-e) emitida para o pagamento
   */
  static async getFiscalInvoice(paymentId: string): Promise<AsaasFiscalInvoice | null> {
    if (!this.isConfigured() || paymentId.startsWith('pay_mock')) {
      return {
        id: `inv_mock_${paymentId}`,
        payment: paymentId,
        status: 'AUTHORIZED',
        pdfUrl: 'https://sandbox.asaas.com/nfse/pdf/mock',
        number: '2026001',
      };
    }

    const headers = this.getHeaders();
    const res = await fetch(`${ASAAS_BASE_URL}/payments/${encodeURIComponent(paymentId)}/invoices`, {
      headers,
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { data?: AsaasFiscalInvoice[] };
    return json.data && json.data.length > 0 ? json.data[0] : null;
  }
}
