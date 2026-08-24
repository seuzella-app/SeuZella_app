export interface OperationalFinanceConfig {
  paymentFeeRate: number;
  effectiveTaxRate: number;
  usdBrlRate: number;
  fixedMonthlyOpexBrl: number;
  source: 'env' | 'admin_config' | 'default';
}

function boundedRate(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`INVALID_FINANCE_RATE:${name}`);
  return value;
}

function positiveNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_FINANCE_VALUE:${name}`);
  return value;
}

/**
 * Centralizes finance assumptions so DRE calculations never need business
 * constants scattered across feature code. Tax rate is a configurable
 * business parameter, not a hardcoded legal rule.
 */
export function getOperationalFinanceConfig(env: NodeJS.ProcessEnv = process.env): OperationalFinanceConfig {
  const paymentFeeRate = env.ZELLA_PAYMENT_FEE_RATE ? Number(env.ZELLA_PAYMENT_FEE_RATE) : 0.03;
  const effectiveTaxRate = env.ZELLA_EFFECTIVE_TAX_RATE ? Number(env.ZELLA_EFFECTIVE_TAX_RATE) : 0;
  const usdBrlRate = env.ZELLA_USD_BRL_RATE ? Number(env.ZELLA_USD_BRL_RATE) : 0;
  const fixedMonthlyOpexBrl = env.ZELLA_FIXED_MONTHLY_OPEX_BRL ? Number(env.ZELLA_FIXED_MONTHLY_OPEX_BRL) : 0;

  const configured = Boolean(
    env.ZELLA_PAYMENT_FEE_RATE ||
    env.ZELLA_EFFECTIVE_TAX_RATE ||
    env.ZELLA_USD_BRL_RATE ||
    env.ZELLA_FIXED_MONTHLY_OPEX_BRL,
  );

  return {
    paymentFeeRate: boundedRate(paymentFeeRate, 'paymentFeeRate'),
    effectiveTaxRate: boundedRate(effectiveTaxRate, 'effectiveTaxRate'),
    usdBrlRate: positiveNumber(usdBrlRate, 'usdBrlRate'),
    fixedMonthlyOpexBrl: positiveNumber(fixedMonthlyOpexBrl, 'fixedMonthlyOpexBrl'),
    source: configured ? 'env' : 'default',
  };
}
