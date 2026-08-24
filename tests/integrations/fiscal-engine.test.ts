import { describe, expect, it } from 'vitest';
import { FiscalEngine } from '@/lib/fiscal/fiscal-engine';
import type { FiscalProvider } from '@/lib/fiscal/types';

function providerStub(): FiscalProvider {
  return {
    scheduleNfse: async input => ({ provider: 'asaas', providerInvoiceId: input.externalReference, direction: 'OUTBOUND_TO_GUEST', status: 'SCHEDULED' }),
    authorizeNfse: async id => ({ provider: 'asaas', providerInvoiceId: id, direction: 'OUTBOUND_TO_GUEST', status: 'AUTHORIZED' }),
    getNfse: async id => ({ provider: 'asaas', providerInvoiceId: id, direction: 'OUTBOUND_TO_GUEST', status: 'AUTHORIZED' }),
    cancelNfse: async id => ({ provider: 'asaas', providerInvoiceId: id, direction: 'OUTBOUND_TO_GUEST', status: 'CANCELED' }),
  };
}

describe('FiscalEngine', () => {
  it('keeps guest NFS-e issuance and supplier invoice workflow distinct', async () => {
    const engine = new FiscalEngine({ asaas: providerStub() });
    const result = await engine.scheduleGuestNfse({
      tenantId: 'tenant-1', externalReference: 'reservation:123',
      customer: { name: 'Maria' },
      service: { description: 'Hospedagem', value: 450, municipalServiceName: 'Hospedagem' },
    });
    expect(result.status).toBe('SCHEDULED');

    const supplier = engine.prepareSupplierInvoiceRequest({
      tenantId: 'tenant-1', supplierName: 'Pousada Exemplo', supplierDocument: '12345678000100',
      recipientLegalName: 'Seu Zélla Tecnologia Ltda', recipientDocument: '00000000000100',
      serviceDescription: 'Serviços de hospedagem', amount: 1000, referenceId: 'invoice:1', status: 'REQUESTED',
    });
    expect(supplier.status).toBe('REQUESTED');
  });

  it('fails closed when provider is unavailable', async () => {
    const engine = new FiscalEngine();
    await expect(engine.get('asaas', 'inv-1')).rejects.toThrow('FISCAL_PROVIDER_NOT_CONFIGURED:asaas');
  });
});
