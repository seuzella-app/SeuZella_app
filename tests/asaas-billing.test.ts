import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AsaasBillingService } from '@/lib/billing/asaas';

describe('Asaas Billing Service — SaaS B2B Gateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ensureCustomer retorna ID mock quando em modo de desenvolvimento/sem credenciais', async () => {
    const customerId = await AsaasBillingService.ensureCustomer({
      tenantId: 'tenant-test-123',
      name: 'Pousada Solar das Palmeiras',
      email: 'contato@solarpalmeiras.com.br',
    });

    expect(customerId).toBe('cus_mock_tenant-test-123');
  });

  it('createMonthlyInvoice formata e limita descrição a menos de 500 caracteres', async () => {
    const longDesc = 'A'.repeat(600);
    const invoice = await AsaasBillingService.createMonthlyInvoice({
      customerId: 'cus_mock_123',
      value: 291.10, // R$ 247 base + R$ 44.10 upsell
      dueDate: '2026-09-05',
      description: longDesc,
      externalReference: 'tenant-test-123',
    });

    expect(invoice).toBeDefined();
    expect(invoice.value).toBe(291.10);
    expect(invoice.description?.length).toBeLessThanOrEqual(480);
    expect(invoice.invoiceUrl).toContain('asaas.com');
  });

  it('getTenantInvoices retorna lista de faturas com invoiceUrl', async () => {
    const invoices = await AsaasBillingService.getTenantInvoices('cus_mock_tenant_abc');
    expect(Array.isArray(invoices)).toBe(true);
    expect(invoices.length).toBeGreaterThan(0);
    expect(invoices[0].invoiceUrl).toBeDefined();
    expect(invoices[0].status).toBe('PENDING');
  });

  it('getFiscalInvoice retorna dados da NFS-e municipal', async () => {
    const fiscal = await AsaasBillingService.getFiscalInvoice('pay_mock_999');
    expect(fiscal).toBeDefined();
    expect(fiscal?.status).toBe('AUTHORIZED');
    expect(fiscal?.pdfUrl).toContain('pdf');
  });
});

describe('Cálculo de Faturamento Híbrido (Plano Base + UPSELL 7%)', () => {
  it('Calcula corretamente o valor consolidado para Pousada Parceira com UPSELLs', () => {
    const basePlanPrice = 247.0; // Plano PARCEIRO
    const upsellExtraSold = 630.0; // Serviços extras vendidos no feriado (Late checkout + Café)
    const upsellSuccessFee = Number((upsellExtraSold * 0.07).toFixed(2)); // 7% = R$ 44.10

    const totalInvoiceValue = basePlanPrice + upsellSuccessFee;
    expect(upsellSuccessFee).toBe(44.10);
    expect(totalInvoiceValue).toBe(291.10);

    const description = `Seu Zélla — Plano PARCEIRO (R$ ${basePlanPrice.toFixed(2)}) + Taxa Sucesso UPSELL Feriados (R$ ${upsellSuccessFee.toFixed(2)}) • Ref: 08/2026`;
    expect(description.length).toBeLessThan(500);
    expect(description).toContain('PARCEIRO');
    expect(description).toContain('44.10');
  });

  it('Calcula fatura com taxa zero de UPSELL quando não há feriados/extras', () => {
    const basePlanPrice = 197.0; // Plano LITE
    const upsellSuccessFee = 0.0;
    const totalInvoiceValue = basePlanPrice + upsellSuccessFee;

    expect(totalInvoiceValue).toBe(197.0);
    const description = `Seu Zélla — Plano LITE (R$ ${basePlanPrice.toFixed(2)}) • Ref: 08/2026`;
    expect(description).not.toContain('UPSELL');
  });
});
