export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export const POPULAR_CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'BTC', symbol: '₿', name: 'Bitcoin' },
  { code: 'ETH', symbol: 'Ξ', name: 'Ethereum' },
  { code: 'USDT', symbol: '₮', name: 'Tether' },
];

export const DEFAULT_CURRENCY: CurrencyConfig = POPULAR_CURRENCIES[0];

export const CHIP_DENOMINATIONS: number[] = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 500];

/**
 * Resolves the CSS class for a given chip value or cumulative bet amount.
 * Maps across 10 distinct, vibrant realistic casino clay chip styles:
 * - 0.1 -> Silver / Slate
 * - 0.5 -> Rose Pink / Fuchsia
 * - 1   -> Royal Blue
 * - 2   -> Canary Gold / Bright Yellow
 * - 5   -> Casino Crimson Red
 * - 10  -> Casino Forest Green
 * - 25  -> Ocean Teal / Turquoise
 * - 50  -> Vibrant Tangerine Orange
 * - 100 -> Midnight Charcoal & Gold
 * - 500 -> Royal Amethyst Purple
 */
export const getChipClass = (val: number): string => {
  if (val >= 500) return 'chip chip-500';
  if (val >= 100) return 'chip chip-100';
  if (val >= 50) return 'chip chip-50';
  if (val >= 25) return 'chip chip-25';
  if (val >= 10) return 'chip chip-10';
  if (val >= 5) return 'chip chip-5';
  if (val >= 2) return 'chip chip-2';
  if (val >= 1) return 'chip chip-1';
  if (val >= 0.5) return 'chip chip-0_5';
  return 'chip chip-0_1';
};

/**
 * Formats a chip value with currency symbol in front to look like a real casino table.
 * e.g., $0.1, $0.5, $1, $5, €10, £25, etc.
 */
export const formatChipLabel = (val: number, symbol = '$'): string => {
  if (val >= 1000) {
    const kVal = val / 1000;
    return `${symbol}${Number.isInteger(kVal) ? kVal : kVal.toFixed(1)}k`;
  }
  if (Number.isInteger(val)) {
    return `${symbol}${val}`;
  }
  // Decimal denominations like 0.1, 0.5, 1.5
  return `${symbol}${parseFloat(val.toFixed(2))}`;
};

/**
 * Formats a monetary amount with comma separators and up to 2 decimal places if needed.
 */
export const formatMoney = (val: number, symbol = ''): string => {
  const formatted = val.toLocaleString(undefined, {
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : formatted;
};
