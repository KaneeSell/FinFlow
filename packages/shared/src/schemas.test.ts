import { describe, expect, it } from "vitest";
import { createRecurringRuleSchema, createTransactionSchema } from "./schemas.js";

describe("shared Zod schemas", () => {
  it("rejects transfer to the same account", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      destinationAccountId: "acc_1",
      title: "Transferência inválida",
      type: "TRANSFER",
      amountCents: 1000,
      date: "2026-11-25",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid expense transaction", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      categoryId: "cat_1",
      title: "Supermercado",
      type: "EXPENSE",
      amountCents: 25990,
      date: "2026-11-25",
      status: "PAID",
    });
    expect(result.success).toBe(true);
  });

  it("validates recurring rule dayOfMonth bounds", () => {
    expect(
      createRecurringRuleSchema.safeParse({
        accountId: "acc_1",
        title: "Aluguel",
        type: "EXPENSE",
        amountCents: 180000,
        frequency: "MONTHLY",
        dayOfMonth: 32,
        startDate: "2026-11-05",
      }).success
    ).toBe(false);
  });
});
