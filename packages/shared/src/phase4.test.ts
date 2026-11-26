import { describe, expect, it } from "vitest";
import {
  calculateFireProjection,
  calculateSplitBalances,
  parseNaturalLanguageTransaction,
  parseNfceQrCode,
} from "./phase4.js";

describe("phase 4 utilities", () => {
  it("parses natural language transactions in Portuguese", () => {
    const res = parseNaturalLanguageTransaction(
      "Almoço 45,90 alimentação ontem",
      [
        { id: "c1", name: "Alimentação", type: "EXPENSE" },
        { id: "c2", name: "Salário", type: "INCOME" },
      ],
      new Date("2026-11-25T12:00:00Z")
    );
    expect(res.type).toBe("EXPENSE");
    expect(res.amountCents).toBe(4590);
    expect(res.date).toBe("2026-11-24");
    expect(res.categoryId).toBe("c1");

    const inc = parseNaturalLanguageTransaction("Recebi freelance 1200 hoje", [
      { id: "c2", name: "Salário", type: "INCOME" },
    ]);
    expect(inc.type).toBe("INCOME");
    expect(inc.amountCents).toBe(120000);
  });

  it("parses SEFAZ NFC-e QR Code URL", () => {
    const parsed = parseNfceQrCode(
      "https://www.nfce.fazenda.sp.gov.br/qrcode?p=35261112345678000190650010000012341000012345|2|1|1|HASH&vNF=158.90"
    );
    expect(parsed.valid).toBe(true);
    expect(parsed.cnpj).toBe("12345678000190");
    expect(parsed.yearMonth).toBe("2026-11");
    expect(parsed.amountCents).toBe(15890);
  });

  it("calculates FIRE projection and shared expense split balances", () => {
    const fire = calculateFireProjection(500000, 10000000, 500000, 6);
    expect(fire.fireNumberCents).toBe(150000000);
    expect(fire.yearsToFire).toBeGreaterThan(0);

    const balances = calculateSplitBalances([
      {
        paidByName: "Daniel",
        totalAmountCents: 10000,
        splits: [
          { memberName: "Daniel", shareCents: 5000 },
          { memberName: "Ana", shareCents: 5000 },
        ],
        settled: false,
      },
    ]);
    expect(balances.find((b) => b.memberName === "Daniel")?.netBalanceCents).toBe(5000);
    expect(balances.find((b) => b.memberName === "Ana")?.netBalanceCents).toBe(-5000);
  });
});
