import { z } from "zod";
import type { TransactionDTO } from "./schemas.js";

// --- Phase 2 Schemas ---

export const createGoalSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  targetAmountCents: z.number().int().positive("Meta deve ser maior que zero"),
  currentAmountCents: z.number().int().nonnegative().default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  color: z.string().trim().min(4).max(20).default("#10b981"),
  icon: z.string().trim().min(1).max(30).default("target"),
  notes: z.string().max(400).nullable().optional(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const contributeGoalSchema = z.object({
  amountCents: z.number().int().positive("Aporte deve ser maior que zero"),
});

export const importTransactionsSchema = z.object({
  accountId: z.string().min(1, "Conta obrigatória"),
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().trim().min(1).max(120),
        amountCents: z.number().int().positive(),
        type: z.enum(["INCOME", "EXPENSE"]),
      })
    )
    .min(1, "Nenhum lançamento para importar")
    .max(1000),
});

export const payInvoiceSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  sourceAccountId: z.string().min(1, "Conta pagadora obrigatória"),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;
export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;

export interface GoalDTO {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  deadline: string | null;
  color: string;
  icon: string;
  notes: string | null;
  percent: number;
  remainingCents: number;
  createdAt: string;
}

export interface BudgetOverviewDTO {
  categoryId: string;
  categoryName: string;
  color: string;
  budgetLimitCents: number;
  spentCents: number;
  percent: number;
  alertLevel: "ok" | "warning" | "exceeded";
}

export interface CreditCardInvoiceDTO {
  accountId: string;
  accountName: string;
  color: string;
  month: string;
  closingDay: number;
  dueDay: number;
  creditLimitCents: number;
  invoiceTotalCents: number;
  paidTotalCents: number;
  pendingTotalCents: number;
  availableLimitCents: number;
  transactions: TransactionDTO[];
}

export interface MarketIndicatorsDTO {
  source: "live" | "fallback";
  updatedAt: string;
  rates: {
    usdBrl: number;
    eurBrl: number;
    btcBrl: number;
  };
  bcb: {
    selicPercent: number;
    ipcaPercent12m: number;
  };
}

// --- Pure Phase 2 Helpers ---

/**
 * Determines the invoice month (YYYY-MM) for a credit card purchase.
 * Purchases on or before `closingDay` belong to the current month;
 * purchases strictly after `closingDay` roll over to the next month.
 */
export function computeInvoiceMonth(purchaseDate: Date, closingDay: number): string {
  const safeDay = Math.max(1, Math.min(31, closingDay));
  const year = purchaseDate.getUTCFullYear();
  const month = purchaseDate.getUTCMonth();
  const day = purchaseDate.getUTCDate();

  const target = day > safeDay ? new Date(Date.UTC(year, month + 1, 1)) : new Date(Date.UTC(year, month, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Splits a total integer cent amount across `count` installments,
 * placing any remainder cents on the first installment so sum === totalCents.
 */
export function splitInstallmentsCents(totalCents: number, count: number): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  const base = Math.floor(totalCents / safeCount);
  const remainder = totalCents - base * safeCount;
  const result = Array.from({ length: safeCount }, () => base);
  if (result.length > 0) {
    result[0] = (result[0] ?? 0) + remainder;
  }
  return result;
}

function normalizeImportDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  return null;
}

function parseSignedCents(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const isNeg = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/-/g, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  let normalized = unsigned;
  if (lastComma > lastDot) {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma && lastComma !== -1) {
    normalized = unsigned.replace(/,/g, "");
  } else {
    normalized = unsigned.replace(/,/g, ".");
  }
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return 0;
  const cents = Math.round(num * 100);
  return isNeg ? -cents : cents;
}

export interface ParsedStatementRow {
  date: string;
  title: string;
  amountCents: number;
  type: "INCOME" | "EXPENSE";
}

/**
 * Parses CSV bank statements (supports `,` and `;`, DD/MM/YYYY and YYYY-MM-DD).
 */
export function parseCsvStatement(csvText: string): ParsedStatementRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = (lines[0]?.includes(";") ? ";" : ",");
  const rows: ParsedStatementRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const cols = line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 3) continue;

    // Skip header row
    if (i === 0 && !normalizeImportDate(cols[0] ?? "")) continue;

    const date = normalizeImportDate(cols[0] ?? "");
    const title = cols[1] ?? "";
    const signedCents = parseSignedCents(cols[2] ?? "");

    if (!date || !title || signedCents === 0) continue;

    rows.push({
      date,
      title: title.slice(0, 120),
      amountCents: Math.abs(signedCents),
      type: signedCents >= 0 ? "INCOME" : "EXPENSE",
    });
  }

  return rows;
}

/**
 * Parses OFX SGML/XML `<STMTTRN>` blocks into normalized statement rows.
 */
export function parseOfxStatement(ofxText: string): ParsedStatementRow[] {
  const blocks = ofxText.split(/<STMTTRN>/i).slice(1);
  const rows: ParsedStatementRow[] = [];

  for (const block of blocks) {
    const dtMatch = block.match(/<DTPOSTED>\s*(\d{8})/i);
    const amtMatch = block.match(/<TRNAMT>\s*([^\r\n<]+)/i);
    const memoMatch = block.match(/<(?:MEMO|NAME)>\s*([^\r\n<]+)/i);

    if (!dtMatch?.[1] || !amtMatch?.[1]) continue;
    const rawDate = dtMatch[1];
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const signedCents = parseSignedCents(amtMatch[1]);
    if (signedCents === 0) continue;

    rows.push({
      date,
      title: (memoMatch?.[1]?.trim() || "Lançamento OFX").slice(0, 120),
      amountCents: Math.abs(signedCents),
      type: signedCents >= 0 ? "INCOME" : "EXPENSE",
    });
  }

  return rows;
}

export function exportTransactionsToCsv(transactions: TransactionDTO[]): string {
  const header = "data;descricao;tipo;valor;status;conta;categoria";
  const lines = transactions.map((tx) => {
    const signed = tx.type === "EXPENSE" ? -(tx.amountCents / 100) : tx.amountCents / 100;
    const safeTitle = `"${tx.title.replace(/"/g, '""')}"`;
    return [
      tx.date.slice(0, 10),
      safeTitle,
      tx.type,
      signed.toFixed(2).replace(".", ","),
      tx.status,
      tx.account?.name ?? "",
      tx.category?.name ?? "",
    ].join(";");
  });
  return [header, ...lines].join("\n");
}

export function calculateGoalProjection(
  targetCents: number,
  currentCents: number,
  monthlyContributionCents: number
): { percent: number; remainingCents: number; monthsToGoal: number | null } {
  const remainingCents = Math.max(0, targetCents - currentCents);
  const percent =
    targetCents > 0 ? Math.min(100, Math.round((currentCents / targetCents) * 1000) / 10) : 100;
  const monthsToGoal =
    remainingCents === 0
      ? 0
      : monthlyContributionCents > 0
        ? Math.ceil(remainingCents / monthlyContributionCents)
        : null;
  return { percent, remainingCents, monthsToGoal };
}
