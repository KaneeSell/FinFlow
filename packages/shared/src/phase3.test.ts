import { describe, expect, it } from "vitest";
import { applyAutoRules, projectCashflow } from "./phase3.js";

describe("phase 3 utilities", () => {
  it("matches auto-categorization rules by priority", () => {
    const res = applyAutoRules("UBER *TRIP 123", [
      {
        matchType: "CONTAINS",
        pattern: "uber",
        categoryId: "cat_transport",
        applyTags: ["mobilidade"],
        isActive: true,
        priority: 10,
      },
      {
        matchType: "STARTS_WITH",
        pattern: "uber *trip",
        categoryId: "cat_priority",
        applyTags: ["viagem"],
        isActive: true,
        priority: 50,
      },
    ]);

    expect(res).toEqual({
      categoryId: "cat_priority",
      tags: ["viagem"],
    });
  });

  it("projects cashflow and detects first negative month", () => {
    const forecast = projectCashflow(
      100000,
      [
        {
          type: "EXPENSE",
          amountCents: 60000,
          frequency: "MONTHLY",
          dayOfMonth: 10,
          nextRunDate: new Date("2026-11-10T12:00:00Z"),
          endDate: null,
          isActive: true,
        },
      ],
      [],
      3,
      new Date("2026-11-01T12:00:00Z")
    );

    expect(forecast.timeline).toHaveLength(3);
    expect(forecast.timeline[0]!.endingBalanceCents).toBe(40000);
    expect(forecast.timeline[1]!.endingBalanceCents).toBe(-20000);
    expect(forecast.firstNegativeMonth).toBe("2026-12");
  });
});
