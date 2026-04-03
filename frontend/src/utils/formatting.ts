/**
 * Formatting Utilities
 * Used across all pages for consistent number/date/currency formatting.
 */

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date | undefined): string {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function relativeTime(date: string | Date): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  if (Math.abs(diff) < 60) return rtf.format(Math.round(diff), "second");
  if (Math.abs(diff) < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (Math.abs(diff) < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}
