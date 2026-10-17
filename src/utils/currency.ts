/**
 * Indian Currency (INR) formatting utilities
 * Uses the Indian number grouping system (e.g., ₹1,50,000.00)
 */

export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_CODE = 'INR';

export interface FormatCurrencyOptions {
  showSign?: boolean;
  decimals?: number;
}

export function formatCurrency(
  val: number,
  options?: FormatCurrencyOptions
): string {
  const num = Number(val) || 0;
  const decimals = options?.decimals ?? 2;
  const absFormatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (num < 0) {
    return `-₹${absFormatted}`;
  }
  if (options?.showSign && num > 0) {
    return `+₹${absFormatted}`;
  }
  return `₹${absFormatted}`;
}

export function formatINR(val: number, options?: FormatCurrencyOptions): string {
  return formatCurrency(val, options);
}
