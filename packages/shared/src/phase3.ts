import { z } from "zod";
import { computeNextOccurrenceDate } from "./finance.js";
import type { RecurrenceFrequency } from "./schemas.js";

// --- Phase 3 Schemas ---

export const RULE_MATCH_TYPES = ["CONTAINS", "STARTS_WITH", "REGEX"] as const;
export type RuleMatchType = (typeof RULE_MATCH_TYPES)[number];

export const createAutoRuleSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  matchType: z.enum(RULE_MATCH_TYPES).default("CONTAINS"),
  pattern: z.string().trim().min(1, "Padrão obrigatório").max(120),
  categoryId: z.string().min(1, "Categoria obrigatória"),
  applyTags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  priority: z.number().int().min(0).max(1000).default(0),
});

export const updateAutoRuleSchema = createAutoRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const WEBHOOK_PROVIDERS = ["GENERIC", "TELEGRAM", "DISCORD", "NTFY"] as const;
export type WebhookProvider = (typeof WEBHOOK_PROVIDERS)[number];

export const createWebhookSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  provider: z.enum(WEBHOOK_PROVIDERS).default("GENERIC"),
  url: z.string().url("URL inválida"),
  events: z.array(z.string()).default(["RECURRING_DUE", "BUDGET_ALERT"]),
});

export const syncMutationSchema = z.object({
  clientMutationId: z.string().min(4).max(100),
  type: z.enum(["CREATE_TRANSACTION"]),
  payload: z.object({
    accountId: z.string().min(1),
    categoryId: z.string().nullable().optional(),
    title: z.string().trim().min(1).max(120),
    type: z.enum(["INCOME", "EXPENSE"]),
    amountCents: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    status: z.enum(["PAID", "PENDING"]).default("PAID"),
  }),
});

export const syncBatchSchema = z.object({
  mutations: z.array(syncMutationSchema).max(200),
});

export type CreateAutoRuleInput = z.infer<typeof createAutoRuleSchema>;
export type UpdateAutoRuleInput = z.infer<typeof updateAutoRuleSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type SyncMutationInput = z.infer<typeof syncMutationSchema>;

export interface AutoRuleDTO {
  id: string;
  name: string;
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  applyTags: string[];
  isActive: boolean;
  priority: number;
  category?: { id: string; name: string; color: string } | null;
}

export interface WebhookConfigDTO {
  id: string;
  name: string;
  provider: WebhookProvider;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface CashflowForecastMonth {
  month: string;
  projectedIncomeCents: number;
  projectedExpenseCents: number;
  endingBalanceCents: number;
}

export interface CashflowForecastDTO {
  months: number;
  startingBalanceCents: number;
  endingBalanceCents: number;
  firstNegativeMonth: string | null;
  timeline: CashflowForecastMonth[];
}

// --- Pure Phase 3 Functions ---

export interface AutoRuleMatchInput {
  matchType: RuleMatchType;
  pattern: string;
  categoryId: string;
  applyTags: string[];
  isActive: boolean;
  priority: number;
}

/**
 * Matches a transaction title against active auto-categorization rules ordered by priority DESC.
 */
export function applyAutoRules(
  title: string,
  rules: AutoRuleMatchInput[]
): { categoryId: string | null; tags: string[] } {
  const ordered = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  const lowerTitle = title.trim().toLowerCase();

  for (const rule of ordered) {
    const lowerPattern = rule.pattern.trim().toLowerCase();
    let matched = false;

    if (rule.matchType === "CONTAINS") {
      matched = lowerTitle.includes(lowerPattern);
    } else if (rule.matchType === "STARTS_WITH") {
      matched = lowerTitle.startsWith(lowerPattern);
    } else if (rule.matchType === "REGEX") {
      try {
        matched = new RegExp(rule.pattern, "i").test(title);
      } catch {
        matched = false;
      }
    }

    if (matched) {
      return {
        categoryId: rule.categoryId,
        tags: [...rule.applyTags],
      };
    }
  }

  return { categoryId: null, tags: [] };
}

export interface ForecastRuleInput {
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  nextRunDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

export interface ForecastPendingTxInput {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amountCents: number;
  date: Date;
}

/**
 * Projects future monthly cashflow for 3, 6, or 12 months combining
 * current balance + active recurring rules + future pending transactions.
 */
export function projectCashflow(
  startingBalanceCents: number,
  recurringRules: ForecastRuleInput[],
  pendingTransactions: ForecastPendingTxInput[],
  monthsCount: 3 | 6 | 12,
  anchorDate = new Date()
): CashflowForecastDTO {
  const startMonth = new Date(
    Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1)
  );
  const buckets = new Map<string, { incomeCents: number; expenseCents: number }>();
  const monthKeys: string[] = [];

  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
    buckets.set(key, { incomeCents: 0, expenseCents: 0 });
  }

  const horizonEnd = new Date(
    Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + monthsCount, 1)
  );

  // Add pending transactions
  for (const tx of pendingTransactions) {
    if (tx.type === "TRANSFER") continue;
    const key = `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.type === "INCOME") bucket.incomeCents += tx.amountCents;
    else bucket.expenseCents += tx.amountCents;
  }

  // Simulate recurring rules across the horizon
  for (const rule of recurringRules) {
    if (!rule.isActive) continue;
    let cursor = new Date(rule.nextRunDate.getTime());
    let guard = 0;
    while (cursor < horizonEnd && guard < 400) {
      guard += 1;
      if (rule.endDate && cursor > rule.endDate) break;
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      const bucket = buckets.get(key);
      if (bucket) {
        if (rule.type === "INCOME") bucket.incomeCents += rule.amountCents;
        else bucket.expenseCents += rule.amountCents;
      }
      cursor = computeNextOccurrenceDate(rule.frequency, cursor, rule.dayOfMonth);
    }
  }

  let runningBalance = startingBalanceCents;
  let firstNegativeMonth: string | null = null;
  const timeline: CashflowForecastMonth[] = [];

  for (const key of monthKeys) {
    const b = buckets.get(key)!;
    runningBalance += b.incomeCents - b.expenseCents;
    if (runningBalance < 0 && !firstNegativeMonth) {
      firstNegativeMonth = key;
    }
    timeline.push({
      month: key,
      projectedIncomeCents: b.incomeCents,
      projectedExpenseCents: b.expenseCents,
      endingBalanceCents: runningBalance,
    });
  }

  return {
    months: monthsCount,
    startingBalanceCents,
    endingBalanceCents: runningBalance,
    firstNegativeMonth,
    timeline,
  };
}
