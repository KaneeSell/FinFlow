import { z } from "zod";

export const ACCOUNT_TYPES = [
  "CHECKING",
  "WALLET",
  "SAVINGS",
  "CREDIT_CARD",
  "INVESTMENT",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["PAID", "PENDING"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const RECURRENCE_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "YEARLY",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter ao menos 2 caracteres").max(80),
  email: z.string().trim().email("E-mail inválido").toLowerCase(),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(128),
  currency: z.string().trim().length(3).default("BRL"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").toLowerCase(),
  password: z.string().min(1, "Senha obrigatória"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token inválido"),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(60),
  type: z.enum(ACCOUNT_TYPES).default("CHECKING"),
  initialBalanceCents: z.number().int().default(0),
  color: z.string().trim().min(4).max(20).default("#10b981"),
  icon: z.string().trim().min(1).max(30).default("landmark"),
  creditLimitCents: z.number().int().nonnegative().nullable().optional(),
  closingDay: z.number().int().min(1).max(31).nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  currency: z.string().trim().length(3).default("BRL").optional(),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(60),
  type: z.enum(CATEGORY_TYPES),
  color: z.string().trim().min(4).max(20).default("#6366f1"),
  icon: z.string().trim().min(1).max(30).default("tag"),
  budgetLimitCents: z.number().int().nonnegative().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createTransactionSchema = z
  .object({
    accountId: z.string().min(1, "Conta obrigatória"),
    destinationAccountId: z.string().min(1).nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
    title: z.string().trim().min(1, "Descrição obrigatória").max(120),
    type: z.enum(TRANSACTION_TYPES),
    amountCents: z.number().int().positive("Valor deve ser maior que zero"),
    date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    status: z.enum(TRANSACTION_STATUSES).default("PAID"),
    notes: z.string().max(500).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    installments: z.number().int().min(1).max(60).optional(),
    attachmentName: z.string().max(180).nullable().optional(),
    attachmentDataUrl: z.string().max(2_500_000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "TRANSFER") {
        return Boolean(data.destinationAccountId && data.destinationAccountId !== data.accountId);
      }
      return true;
    },
    {
      message: "Transferência exige uma conta de destino diferente da origem",
      path: ["destinationAccountId"],
    }
  );

export const updateTransactionSchema = z.object({
  accountId: z.string().min(1).optional(),
  destinationAccountId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  amountCents: z.number().int().positive().optional(),
  date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  notes: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
});

export const createRecurringRuleSchema = z.object({
  accountId: z.string().min(1, "Conta obrigatória"),
  categoryId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1, "Descrição obrigatória").max(120),
  type: z.enum(CATEGORY_TYPES),
  amountCents: z.number().int().positive("Valor deve ser maior que zero"),
  frequency: z.enum(RECURRENCE_FREQUENCIES).default("MONTHLY"),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const updateRecurringRuleSchema = createRecurringRuleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const serverConnectionSchema = z.object({
  mode: z.enum(["local", "remote"]),
  remoteUrl: z.string().url("URL do servidor inválida").or(z.literal("")),
  localPort: z.number().int().min(1024).max(65535).optional(),
});

export const SERVER_LOG_LEVELS = ["error", "warn", "info", "debug"] as const;
export type ServerLogLevel = (typeof SERVER_LOG_LEVELS)[number];

export const serverAdminConfigSchema = z.object({
  port: z.number().int().min(1024, "Porta mínima é 1024").max(65535, "Porta máxima é 65535"),
  host: z.string().trim().min(1, "Host obrigatório").max(100),
  publicUrl: z.string().trim().max(255).default(""),
  corsOrigin: z.string().trim().min(1).max(500).default("*"),
  rateLimitMax: z.number().int().min(30).max(5000).default(300),
  allowRegistration: z.boolean().default(true),
  enableSwagger: z.boolean().default(true),
  accessTokenTtlMinutes: z.number().int().min(5).max(1440).default(15),
  refreshTokenTtlDays: z.number().int().min(1).max(90).default(7),
  logLevel: z.enum(SERVER_LOG_LEVELS).default("info"),
  autoBackupEnabled: z.boolean().default(true),
  autoBackupRetention: z.number().int().min(1).max(30).default(7),
});

export const updateServerAdminConfigSchema = serverAdminConfigSchema.partial();

export type ServerAdminConfig = z.infer<typeof serverAdminConfigSchema>;
export type UpdateServerAdminConfigInput = z.infer<typeof updateServerAdminConfigSchema>;

export interface ServerBackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ServerStatusDTO {
  status: "ok";
  mode: string;
  version: string;
  nodeVersion: string;
  platform: string;
  pid: number;
  uptimeSeconds: number;
  memoryRssMb: number;
  memoryHeapMb: number;
  port: number;
  host: string;
  lanUrls: string[];
  dbPath: string;
  dbSizeBytes: number;
  counts: {
    users: number;
    accounts: number;
    categories: number;
    transactions: number;
    recurringRules: number;
    activeSessions: number;
  };
  backups: ServerBackupInfo[];
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
export type ServerConnectionConfig = z.infer<typeof serverConnectionSchema>;

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  currency: string;
  createdAt: string;
}

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  currentBalanceCents: number;
  color: string;
  icon: string;
  isArchived: boolean;
  creditLimitCents: number | null;
  closingDay: number | null;
  dueDay: number | null;
  currency: string;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  budgetLimitCents: number | null;
}

export interface TransactionDTO {
  id: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  recurringRuleId: string | null;
  title: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  status: TransactionStatus;
  notes: string | null;
  tags: string[];
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  invoiceMonth?: string | null;
  attachmentName?: string | null;
  attachmentDataUrl?: string | null;
  createdAt: string;
  account?: { id: string; name: string; color: string } | null;
  destinationAccount?: { id: string; name: string; color: string } | null;
  category?: { id: string; name: string; color: string; icon: string } | null;
}

export interface RecurringRuleDTO {
  id: string;
  accountId: string;
  categoryId: string | null;
  title: string;
  type: CategoryType;
  amountCents: number;
  frequency: RecurrenceFrequency;
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  isActive: boolean;
  notes: string | null;
  account?: { id: string; name: string; color: string } | null;
  category?: { id: string; name: string; color: string; icon: string } | null;
}

export interface DashboardSummaryDTO {
  month: string;
  totalBalanceCents: number;
  monthlyIncomeCents: number;
  monthlyExpenseCents: number;
  monthlyNetCents: number;
  pendingExpenseCents: number;
  pendingIncomeCents: number;
  savingsRatePercent: number;
  expensesByCategory: Array<{
    categoryId: string | null;
    categoryName: string;
    color: string;
    totalCents: number;
    percent: number;
  }>;
  cashflowHistory: Array<{
    month: string;
    incomeCents: number;
    expenseCents: number;
  }>;
  upcomingRecurring: RecurringRuleDTO[];
  recentTransactions: TransactionDTO[];
}
