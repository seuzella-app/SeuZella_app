import { describe, expect, it } from 'vitest';
import { getOperationalFinanceConfig } from '@/lib/finance/operational-cost-config';

describe('operational finance configuration', () => {
  it('uses configurable parameters and does not encode a legal tax rate', () => {
    const config = getOperationalFinanceConfig({
      NODE_ENV: 'test',
      ZELLA_PAYMENT_FEE_RATE: '0.029',
      ZELLA_EFFECTIVE_TAX_RATE: '0.08',
      ZELLA_USD_BRL_RATE: '5.25',
      ZELLA_FIXED_MONTHLY_OPEX_BRL: '9000',
    } as NodeJS.ProcessEnv);

    expect(config.paymentFeeRate).toBe(0.029);
    expect(config.effectiveTaxRate).toBe(0.08);
    expect(config.usdBrlRate).toBe(5.25);
    expect(config.fixedMonthlyOpexBrl).toBe(9000);
    expect(config.source).toBe('env');
  });

  it('fails closed on invalid rates', () => {
    expect(() => getOperationalFinanceConfig({ NODE_ENV: 'test', ZELLA_EFFECTIVE_TAX_RATE: '1.5' } as NodeJS.ProcessEnv)).toThrow('INVALID_FINANCE_RATE:effectiveTaxRate');
    expect(() => getOperationalFinanceConfig({ NODE_ENV: 'test', ZELLA_PAYMENT_FEE_RATE: '-0.1' } as NodeJS.ProcessEnv)).toThrow('INVALID_FINANCE_RATE:paymentFeeRate');
  });
});
