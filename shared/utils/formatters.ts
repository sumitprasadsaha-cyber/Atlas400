export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatCurrency(amount: number, currencySymbol: string = "₹"): string {
  return `${currencySymbol}${amount.toLocaleString("en-IN")}`;
}

export function formatPercentage(value: number, total: number, decimals: number = 1): string {
  if (total === 0) return "0%";
  const pct = (value / total) * 100;
  return `${pct.toFixed(decimals)}%`;
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
