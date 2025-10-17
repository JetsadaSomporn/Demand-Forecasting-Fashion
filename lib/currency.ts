const USD_EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  THB: 0.0275,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0069,
};

export const SUPPORTED_CURRENCIES = Object.keys(USD_EXCHANGE_RATES);

export function normalizeCurrencyCode(value?: string | null): string {
  if (!value) return "USD";
  const trimmed = value.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(trimmed) ? trimmed : "USD";
}

export function convertCurrencyToUsd(amount: number, currency?: string | null): number {
  if (!Number.isFinite(amount)) return 0;
  const code = normalizeCurrencyCode(currency);
  const rate = USD_EXCHANGE_RATES[code] ?? 1;
  const converted = amount * rate;
  return Math.round(converted * 100) / 100;
}

export function getUsdExchangeRate(currency?: string | null): number {
  const code = normalizeCurrencyCode(currency);
  return USD_EXCHANGE_RATES[code] ?? 1;
}
