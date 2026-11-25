import type { RecurrenceFrequency, TransactionStatus, TransactionType } from "./schemas.js";

/**
 * Formats integer cents into a localized currency string (default pt-BR / BRL).
 */
export function formatCurrency(
  cents: number,
  currency = "BRL",
  locale = "pt-BR"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parses a human-entered currency string (e.g. "1.250,90" or "45.50" or "R$ 100,00")
 * into integer cents. Returns 0 when invalid.
 */
export function parseCurrencyToCents(raw: string | number): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) : 0;
  }

  const trimmed = raw.trim().replace(/[^\d,.-]/g, "");
  if (!trimmed) return 0;

  const isNegative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/-/g, "");

  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastDot) {
    // Brazilian style: 1.234,56
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    // US style with comma thousands: 1,234.56
    normalized = unsigned.replace(/,/g, "");
  } else {
    normalized = unsigned.replace(/,/g, ".");
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;

  const cents = Math.round(parsed * 100);
  return isNegative ? -cents : cents;
}

/**
 * Calculates savings rate percentage rounded to 1 decimal place.
 * Returns 0 when income is <= 0.
 */
export function calculateSavingsRate(incomeCents: number, expenseCents: number): number {
  if (incomeCents <= 0) return 0;
  const rate = ((incomeCents - expenseCents) / incomeCents) * 100;
  return Math.round(rate * 10) / 10;
}

export interface SimpleTransactionForTotals {
  type: TransactionType;
  amountCents: number;
  status: TransactionStatus;
}

export interface TotalsBreakdown {
  paidIncomeCents: number;
  paidExpenseCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  netPaidCents: number;
}

/**
 * Aggregates income and expense totals by status, ignoring internal transfers.
 */
export function calculateDashboardTotals(
  transactions: SimpleTransactionForTotals[]
): TotalsBreakdown {
  let paidIncomeCents = 0;
  let paidExpenseCents = 0;
  let pendingIncomeCents = 0;
  let pendingExpenseCents = 0;

  for (const tx of transactions) {
    if (tx.type === "INCOME") {
      if (tx.status === "PAID") paidIncomeCents += tx.amountCents;
      else pendingIncomeCents += tx.amountCents;
    } else if (tx.type === "EXPENSE") {
      if (tx.status === "PAID") paidExpenseCents += tx.amountCents;
      else pendingExpenseCents += tx.amountCents;
    }
  }

  return {
    paidIncomeCents,
    paidExpenseCents,
    pendingIncomeCents,
    pendingExpenseCents,
    netPaidCents: paidIncomeCents - paidExpenseCents,
  };
}

/**
 * Computes the next occurrence Date (UTC) for a recurring rule, clamping dayOfMonth
 * to the target month's last day (e.g., Jan 31 -> Feb 28/29).
 */
export function computeNextOccurrenceDate(
  frequency: RecurrenceFrequency,
  currentDate: Date,
  dayOfMonth?: number | null
): Date {
  const next = new Date(currentDate.getTime());

  switch (frequency) {
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "BIWEEKLY":
      next.setUTCDate(next.getUTCDate() + 14);
      return next;
    case "MONTHLY": {
      const targetDay = dayOfMonth ?? next.getUTCDate();
      const targetMonth = next.getUTCMonth() + 1;
      const year = next.getUTCFullYear() + Math.floor(targetMonth / 12);
      const month = targetMonth % 12;
      const daysInTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      return new Date(
        Date.UTC(
          year,
          month,
          Math.min(targetDay, daysInTargetMonth),
          next.getUTCHours(),
          next.getUTCMinutes(),
          next.getUTCSeconds()
        )
      );
    }
    case "YEARLY": {
      const targetYear = next.getUTCFullYear() + 1;
      const month = next.getUTCMonth();
      const targetDay = dayOfMonth ?? next.getUTCDate();
      const daysInTargetMonth = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
      return new Date(
        Date.UTC(
          targetYear,
          month,
          Math.min(targetDay, daysInTargetMonth),
          next.getUTCHours(),
          next.getUTCMinutes(),
          next.getUTCSeconds()
        )
      );
    }
  }
}
