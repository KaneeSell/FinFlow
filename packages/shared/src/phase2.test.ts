import { describe, expect, it } from "vitest";
import {
  calculateGoalProjection,
  computeInvoiceMonth,
  exportTransactionsToCsv,
  parseCsvStatement,
  parseOfxStatement,
  splitInstallmentsCents,
} from "./phase2.js";

describe("phase 2 utilities", () => {
  it("computes credit card invoice month based on closing day", () => {
    expect(computeInvoiceMonth(new Date("2026-11-05T12:00:00Z"), 10)).toBe("2026-11");
    expect(computeInvoiceMonth(new Date("2026-11-10T12:00:00Z"), 10)).toBe("2026-11");
    expect(computeInvoiceMonth(new Date("2026-11-11T12:00:00Z"), 10)).toBe("2026-12");
    expect(computeInvoiceMonth(new Date("2026-12-20T12:00:00Z"), 10)).toBe("2027-01");
  });

  it("splits installment cents preserving exact total", () => {
    const parts = splitInstallmentsCents(10000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it("parses Brazilian CSV statements", () => {
    const csv = `Data;Descrição;Valor\n25/11/2026;Supermercado;-150,90\n26/11/2026;Pix Recebido;500,00`;
    const rows = parseCsvStatement(csv);
    expect(rows).toEqual([
      { date: "2026-11-25", title: "Supermercado", amountCents: 15090, type: "EXPENSE" },
      { date: "2026-11-26", title: "Pix Recebido", amountCents: 50000, type: "INCOME" },
    ]);
  });

  it("parses OFX STMTTRN blocks", () => {
    const ofx = `
      <OFX>
        <STMTTRN>
          <TRNTYPE>DEBIT
          <DTPOSTED>20261120120000
          <TRNAMT>-89.50
          <MEMO>PADARIA CENTRAL
        </STMTTRN>
        <STMTTRN>
          <TRNTYPE>CREDIT
          <DTPOSTED>20261121120000
          <TRNAMT>1200.00
          <NAME>SALARIO
        </STMTTRN>
      </OFX>
    `;
    const rows = parseOfxStatement(ofx);
    expect(rows).toEqual([
      { date: "2026-11-20", title: "PADARIA CENTRAL", amountCents: 8950, type: "EXPENSE" },
      { date: "2026-11-21", title: "SALARIO", amountCents: 120000, type: "INCOME" },
    ]);
  });

  it("exports transactions to CSV and calculates goal projection", () => {
    const csv = exportTransactionsToCsv([
      {
        id: "1",
        accountId: "a1",
        destinationAccountId: null,
        categoryId: "c1",
        recurringRuleId: null,
        title: "Café",
        type: "EXPENSE",
        amountCents: 1250,
        date: "2026-11-25T12:00:00.000Z",
        status: "PAID",
        notes: null,
        tags: [],
        createdAt: "2026-11-25T12:00:00.000Z",
        account: { id: "a1", name: "Carteira", color: "#000" },
        category: { id: "c1", name: "Alimentação", color: "#f00", icon: "utensils" },
      },
    ]);
    expect(csv).toContain("2026-11-25;\"Café\";EXPENSE;-12,50;PAID;Carteira;Alimentação");

    expect(calculateGoalProjection(100000, 25000, 25000)).toEqual({
      percent: 25,
      remainingCents: 75000,
      monthsToGoal: 3,
    });
  });
});
