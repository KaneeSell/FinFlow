import { z } from "zod";
import { parseCurrencyToCents } from "./finance.js";

// --- Phase 4 Schemas ---

export const ASSET_CLASSES = [
  "FIXED_INCOME",
  "STOCK",
  "FII",
  "ETF",
  "CRYPTO",
  "CASH",
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const createInvestmentSchema = z.object({
  symbol: z.string().trim().min(1, "Código obrigatório").max(20).toUpperCase(),
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  assetClass: z.enum(ASSET_CLASSES).default("STOCK"),
  quantity: z.number().positive("Quantidade deve ser maior que zero"),
  avgPriceCents: z.number().int().nonnegative(),
  currentPriceCents: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).default("BRL"),
  indexer: z.string().max(20).nullable().optional(),
  indexerRate: z.number().nullable().optional(),
  notes: z.string().max(400).nullable().optional(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial();

export const WORKSPACE_TYPES = ["PERSONAL", "COUPLE", "FAMILY", "BUSINESS"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  type: z.enum(WORKSPACE_TYPES).default("COUPLE"),
});

export const addWorkspaceMemberSchema = z.object({
  memberName: z.string().trim().min(1, "Nome obrigatório").max(60),
  memberEmail: z.string().trim().email().optional().or(z.literal("")),
});

export const createSharedExpenseSchema = z.object({
  title: z.string().trim().min(1, "Descrição obrigatória").max(120),
  paidByName: z.string().trim().min(1, "Pagador obrigatório"),
  totalAmountCents: z.number().int().positive("Valor deve ser maior que zero"),
  participants: z.array(z.string().min(1)).min(1, "Informe ao menos 1 participante"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export const createOpenFinanceSchema = z.object({
  provider: z.enum(["PLUGGY", "BELVO", "SANDBOX"]).default("SANDBOX"),
  institutionName: z.string().trim().min(1, "Instituição obrigatória").max(80),
  externalItemId: z.string().max(120).optional(),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type CreateSharedExpenseInput = z.infer<typeof createSharedExpenseSchema>;
export type CreateOpenFinanceInput = z.infer<typeof createOpenFinanceSchema>;

export interface InvestmentAssetDTO {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPriceCents: number;
  currentPriceCents: number;
  totalInvestedCents: number;
  totalCurrentCents: number;
  gainLossCents: number;
  gainLossPercent: number;
  currency: string;
  indexer: string | null;
  indexerRate: number | null;
  notes: string | null;
}

export interface NetWorthSummaryDTO {
  accountsTotalCents: number;
  investmentsTotalCents: number;
  netWorthCents: number;
  investedCostCents: number;
  totalGainLossCents: number;
  allocationByClass: Array<{
    assetClass: AssetClass;
    totalCents: number;
    percent: number;
  }>;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  type: WorkspaceType;
  members: Array<{ id: string; memberName: string; memberEmail: string | null; role: string }>;
}

export interface SharedExpenseDTO {
  id: string;
  workspaceId: string;
  paidByName: string;
  title: string;
  totalAmountCents: number;
  splits: Array<{ memberName: string; shareCents: number }>;
  settled: boolean;
  date: string;
}

export interface OpenFinanceConnectionDTO {
  id: string;
  provider: "PLUGGY" | "BELVO" | "SANDBOX";
  institutionName: string;
  status: string;
  lastSyncAt: string | null;
}

// --- Pure Phase 4 Functions ---

/**
 * Parses a natural-language Portuguese financial entry such as:
 * "Almoço 45,90 alimentação ontem" or "Recebi freelance 1200 hoje".
 */
export function parseNaturalLanguageTransaction(
  text: string,
  categories: Array<{ id: string; name: string; type: string }>,
  referenceDate = new Date()
): {
  title: string;
  amountCents: number;
  type: "INCOME" | "EXPENSE";
  date: string;
  categoryId: string | null;
} {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const isIncome = /\b(recebi|sal[áa]rio|freelance|freela|rendimento|dividendo|pix recebido|entrada)\b/i.test(
    lower
  );
  const type: "INCOME" | "EXPENSE" = isIncome ? "INCOME" : "EXPENSE";

  // Date detection
  const dateObj = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );
  if (/\bontem\b/i.test(lower)) {
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  } else if (/\bamanh[ãa]\b/i.test(lower)) {
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
  }
  const date = dateObj.toISOString().slice(0, 10);

  // Amount extraction
  const amountMatch = raw.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  const amountCents = amountMatch?.[1] ? parseCurrencyToCents(amountMatch[1]) : 0;

  // Category matching
  let categoryId: string | null = null;
  const matchingCats = categories.filter((c) => c.type === type);
  for (const cat of matchingCats) {
    if (lower.includes(cat.name.toLowerCase())) {
      categoryId = cat.id;
      break;
    }
  }

  // Clean title
  let cleanTitle = raw
    .replace(/(?:r\$\s*)?\d+(?:[.,]\d{1,2})?/gi, "")
    .replace(/\b(hoje|ontem|amanh[ãa]|no|na|pix|de)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanTitle) {
    cleanTitle = isIncome ? "Receita Rápida" : "Despesa Rápida";
  }

  return {
    title: cleanTitle.slice(0, 120),
    amountCents,
    type,
    date,
    categoryId,
  };
}

/**
 * Parses SEFAZ NFC-e QR Code URLs or 44-digit access keys.
 */
export function parseNfceQrCode(input: string): {
  valid: boolean;
  accessKey: string | null;
  cnpj: string | null;
  yearMonth: string | null;
  amountCents: number | null;
} {
  const keyMatch = input.match(/(\d{44})/);
  if (!keyMatch?.[1]) {
    return { valid: false, accessKey: null, cnpj: null, yearMonth: null, amountCents: null };
  }

  const key = keyMatch[1];
  const yy = key.slice(2, 4);
  const mm = key.slice(4, 6);
  const cnpj = key.slice(6, 20);

  const valMatch = input.match(/[?&|]vNF=([\d.,]+)/i);
  const amountCents = valMatch?.[1] ? parseCurrencyToCents(valMatch[1]) : null;

  return {
    valid: true,
    accessKey: key,
    cnpj,
    yearMonth: `20${yy}-${mm}`,
    amountCents: amountCents && amountCents > 0 ? amountCents : null,
  };
}

/**
 * Computes FIRE (Financial Independence, Retire Early) target (25x annual expenses)
 * and estimated years to reach it given monthly contributions and annual real return.
 */
export function calculateFireProjection(
  monthlyExpenseCents: number,
  currentNetWorthCents: number,
  monthlyContributionCents: number,
  annualRealReturnPercent = 6
): {
  fireNumberCents: number;
  progressPercent: number;
  yearsToFire: number | null;
} {
  const fireNumberCents = Math.max(0, monthlyExpenseCents * 12 * 25);
  if (fireNumberCents === 0) {
    return { fireNumberCents: 0, progressPercent: 100, yearsToFire: 0 };
  }

  const progressPercent = Math.min(
    100,
    Math.round((Math.max(0, currentNetWorthCents) / fireNumberCents) * 1000) / 10
  );

  if (currentNetWorthCents >= fireNumberCents) {
    return { fireNumberCents, progressPercent: 100, yearsToFire: 0 };
  }

  if (monthlyContributionCents <= 0 && annualRealReturnPercent <= 0) {
    return { fireNumberCents, progressPercent, yearsToFire: null };
  }

  const monthlyRate = annualRealReturnPercent / 100 / 12;
  let balance = currentNetWorthCents;
  let months = 0;

  while (balance < fireNumberCents && months < 1200) {
    balance = balance * (1 + monthlyRate) + monthlyContributionCents;
    months += 1;
  }

  return {
    fireNumberCents,
    progressPercent,
    yearsToFire: balance >= fireNumberCents ? Math.round((months / 12) * 10) / 10 : null,
  };
}

/**
 * Computes net balances per member from unsettled shared expenses.
 */
export function calculateSplitBalances(
  expenses: Array<{
    paidByName: string;
    totalAmountCents: number;
    splits: Array<{ memberName: string; shareCents: number }>;
    settled: boolean;
  }>
): Array<{ memberName: string; netBalanceCents: number }> {
  const balances = new Map<string, number>();
  const add = (name: string, delta: number) => {
    balances.set(name, (balances.get(name) ?? 0) + delta);
  };

  for (const exp of expenses) {
    if (exp.settled) continue;
    add(exp.paidByName, exp.totalAmountCents);
    for (const s of exp.splits) {
      add(s.memberName, -s.shareCents);
    }
  }

  return Array.from(balances.entries()).map(([memberName, netBalanceCents]) => ({
    memberName,
    netBalanceCents,
  }));
}
