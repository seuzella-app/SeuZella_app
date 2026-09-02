/**
 * Canonical monetary arithmetic for Seu Zélla.
 *
 * All business amounts are represented as BRL decimal numbers at the API
 * boundary and rounded using HALF-UP to two decimal places. Keep this module
 * dependency-free so financial rules cannot diverge between services.
 */
export const MONEY_SCALE = 100;

export function roundHalfUp(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) {
    throw new Error('INVALID_MONEY_VALUE');
  }

  // Use string-based scaling to avoid IEEE-754 floating point representation
  // errors (e.g. 1.005 stored as 1.00499999... internally, so direct
  // multiplication produces 100.49999999999999 instead of 100.5).
  //
  // Approach: convert to a fixed-precision string with extra precision to
  // capture the true value, then perform half-up rounding on the string
  // representation itself.
  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);
  // 10 decimal places captures the true value without float artifacts
  const highPrecisionStr = absValue.toFixed(10);
  // Now perform half-up rounding at the target precision using string ops
  const dotIndex = highPrecisionStr.indexOf('.');
  const intPart = dotIndex === -1 ? highPrecisionStr : highPrecisionStr.slice(0, dotIndex);
  const fracPart = dotIndex === -1 ? '' : highPrecisionStr.slice(dotIndex + 1);

  // Pad fractional part to ensure we have enough digits
  const paddedFrac = (fracPart + '0000000000').slice(0, Math.max(decimals + 1, 10));
  const keepDigits = paddedFrac.slice(0, decimals);
  const nextDigit = paddedFrac.slice(decimals, decimals + 1);
  const remainder = paddedFrac.slice(decimals + 1);

  // Determine if we should round up: half-up means >= 5 in next digit rounds up
  // (any non-zero remainder also rounds up when next digit is exactly 5)
  let roundedFrac = keepDigits;
  if (Number(nextDigit) >= 5) {
    // Round up — handle carry
    const combined = intPart + keepDigits;
    const combinedNum = Number(combined) + 1;
    const combinedStr = String(combinedNum).padStart(combined.length, '0');
    const newIntPart = combinedStr.slice(0, combinedStr.length - decimals) || '0';
    roundedFrac = combinedStr.slice(combinedStr.length - decimals);
    return sign * Number(newIntPart + '.' + roundedFrac);
  }

  // No rounding needed
  const result = Number(intPart + (roundedFrac ? '.' + roundedFrac : ''));
  return sign * result;
}

export function multiplyMoney(rate: number, quantity: number): number {
  return roundHalfUp(rate * quantity);
}

export function percentageOfMoney(amount: number, percentage: number): number {
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new Error('INVALID_PERCENTAGE');
  }
  return roundHalfUp(amount * percentage);
}
