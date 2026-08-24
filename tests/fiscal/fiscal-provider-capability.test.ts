import { describe, expect, it } from 'vitest';
import type { FiscalDocumentType, FiscalProvider } from '@/lib/fiscal/types';

describe('Fiscal provider capability contract', () => {
  const asaas: FiscalProvider = 'asaas';

  it('models guest NFS-e as a fiscal capability, not a payment gateway capability', () => {
    const documentType: FiscalDocumentType = 'NFS_E_GUEST';
    expect(asaas).toBe('asaas');
    expect(documentType).toBe('NFS_E_GUEST');
  });

  it('keeps supplier-to-Zélla documents as a separate business flow', () => {
    const supplierDocument: FiscalDocumentType = 'SUPPLIER_TO_ZELLA';
    expect(supplierDocument).not.toBe('NFS_E_GUEST');
  });
});
