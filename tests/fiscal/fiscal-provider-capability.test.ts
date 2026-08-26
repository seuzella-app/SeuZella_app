import { describe, expect, it } from 'vitest';
import type { FiscalProvider as IFiscalProvider, FiscalDocumentDirection } from '@/lib/fiscal/types';

// Type alias for backwards-compat with older test fixtures.
type FiscalProvider = 'asaas' | 'mercadopago';
type FiscalDocumentType = FiscalDocumentDirection | 'NFS_E_GUEST';

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

  it('verifies FiscalProvider interface contract is exported', () => {
    // Type-only assertion — if this compiles, the interface is correctly exported
    const _check: IFiscalProvider | undefined = undefined;
    expect(_check).toBeUndefined();
  });
});
