import { describe, expect, it } from "vitest";
import {
  calculateDashboardTotals,
  calculateSavingsRate,
  computeNextOccurrenceDate,
  formatCurrency,
  parseCurrencyToCents,
} from "./finance.js";

describe("finance utilities", () => {
  it("formats BRL currency from cents", () => {
    const formatted = formatCurrency(123456, "BRL", "pt-BR");
    expect(formatted).toContain("1.234,56");
    expect(formatted).toContain("R$");
  });

  it("parses Brazilian and US currency strings into integer cents", () => {
    expect(parseCurrencyToCents("1.250,90")).toBe(125090);
    expect(parseCurrencyToCents("R$ 49,90")).toBe(4990);
    expect(parseCurrencyToCents("123.45")).toBe(12345);
    expect(parseCurrencyToCents("-10,50")).toBe(-1050);
    expect(parseCurrencyToCents(19.99)).toBe(1999);
    expect(parseCurrencyToCents("invalid")).toBe(0);
  });

  it("calculates savings rate safely", () => {
    expect(calculateSavingsRate(100000, 60000)).toBe(40);
    expect(calculateSavingsRate(100000, 120000)).toBe(-20);
    expect(calculateSavingsRate(0, 5000)).toBe(0);
  });

  it("calculates dashboard totals ignoring transfers", () => {
    const totals = calculateDashboardTotals([
      { type: "INCOME", amountCents: 500000, status: "PAID" },
      { type: "EXPENSE", amountCents: 150000, status: "PAID" },
      { type: "EXPENSE", amountCents: 50000, status: "PENDING" },
      { type: "INCOME", amountCents: 100000, status: "PENDING" },
      { type: "TRANSFER", amountCents: 200000, status: "PAID" },
    ]);

    expect(totals).toEqual({
      paidIncomeCents: 500000,
      paidExpenseCents: 150000,
      pendingIncomeCents: 100000,
      pendingExpenseCents: 50000,
      netPaidCents: 350000,
    });
  });

  it("computes next occurrence dates including month-end clamping", () => {
    const jan31 = new Date("2026-01-31T12:00:00.000Z");
    const feb = computeNextOccurrenceDate("MONTHLY", jan31, 31);
    expect(feb.toISOString().slice(0, 10)).toBe("2026-02-28");

    const mar = computeNextOccurrenceDate("MONTHLY", feb, 31);
    expect(mar.toISOString().slice(0, 10)).toBe("2026-03-31");

    const weekly = computeNextOccurrenceDate("WEEKLY", new Date("2026-03-01T00:00:00.000Z"));
    expect(weekly.toISOString().slice(0, 10)).toBe("2026-03-08");
  });
});
