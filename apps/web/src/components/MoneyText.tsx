import { formatCurrency } from "@finflow/shared";

interface MoneyTextProps {
  cents: number;
  currency?: string;
  privacyMode?: boolean;
  className?: string;
  showSign?: boolean;
}

export function MoneyText({
  cents,
  currency = "BRL",
  privacyMode = false,
  className = "",
  showSign = false,
}: MoneyTextProps) {
  const formatted = formatCurrency(Math.abs(cents), currency, "pt-BR");
  const prefix = cents < 0 ? "-" : showSign && cents > 0 ? "+" : "";
  return (
    <span className={`tabular-nums ${privacyMode ? "privacy-blur" : ""} ${className}`}>
      {prefix}
      {formatted}
    </span>
  );
}
