import { describe, expect, it } from 'vitest';
import { isWhatsAppCloudApiConfigured } from '@/lib/whatsapp/cloud-api';
import { AsaasFiscalProvider } from '@/lib/fiscal/providers/asaas';

describe('integration contracts — fiscal and WhatsApp', () => {
  it('fails closed for WhatsApp when server credentials are absent', () => {
    const token = process.env.META_ACCESS_TOKEN;
    const phoneId = process.env.META_PHONE_NUMBER_ID;
    delete process.env.META_ACCESS_TOKEN;
    delete process.env.META_PHONE_NUMBER_ID;
    expect(isWhatsAppCloudApiConfigured()).toBe(false);
    if (token !== undefined) process.env.META_ACCESS_TOKEN = token;
    if (phoneId !== undefined) process.env.META_PHONE_NUMBER_ID = phoneId;
  });

  it('requires Asaas fiscal configuration before issuing NFS-e', async () => {
    const token = process.env.ASAAS_ACCESS_TOKEN;
    delete process.env.ASAAS_ACCESS_TOKEN;
    await expect(new AsaasFiscalProvider().scheduleNfse({
      tenantId: 'tenant-test',
      paymentId: 'pay_test',
      externalReference: 'reservation-test',
      customer: { name: 'Hóspede Teste' },
      service: {
        description: 'Hospedagem',
        value: 100,
        municipalServiceName: 'Serviço de hospedagem',
      },
    })).rejects.toThrow('ASAAS_FISCAL_NOT_CONFIGURED');
    if (token !== undefined) process.env.ASAAS_ACCESS_TOKEN = token;
  });
});
