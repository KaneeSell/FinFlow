import type {
  AccountDTO,
  BudgetOverviewDTO,
  CategoryDTO,
  ContributeGoalInput,
  CreateAccountInput,
  CreateCategoryInput,
  CreateGoalInput,
  CreateRecurringRuleInput,
  CreateTransactionInput,
  CreditCardInvoiceDTO,
  DashboardSummaryDTO,
  GoalDTO,
  ImportTransactionsInput,
  LoginInput,
  PayInvoiceInput,
  RecurringRuleDTO,
  RegisterInput,
  ServerConnectionConfig,
  TransactionDTO,
  UpdateAccountInput,
  UpdateCategoryInput,
  UpdateGoalInput,
  UpdateRecurringRuleInput,
  UpdateTransactionInput,
  UserDTO,
} from "@finflow/shared";

const STORAGE_SERVER_KEY = "finflow:server_config";
const STORAGE_AUTH_KEY = "finflow:auth_tokens";

declare global {
  interface Window {
    finflowDesktop?: {
      isElectron: boolean;
      defaultApiUrl: string;
    };
  }
}

export function getDefaultLocalApiUrl(): string {
  if (typeof window !== "undefined" && window.finflowDesktop?.defaultApiUrl) {
    return window.finflowDesktop.defaultApiUrl;
  }
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  return envUrl || "http://127.0.0.1:3333";
}

export function getServerConfig(): ServerConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_SERVER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ServerConnectionConfig;
      if (parsed.mode === "remote" && parsed.remoteUrl) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return { mode: "local", remoteUrl: "" };
}

export function saveServerConfig(config: ServerConnectionConfig): void {
  localStorage.setItem(STORAGE_SERVER_KEY, JSON.stringify(config));
}

export function getActiveApiBaseUrl(): string {
  const cfg = getServerConfig();
  if (cfg.mode === "remote" && cfg.remoteUrl) {
    return cfg.remoteUrl.replace(/\/+$/, "");
  }
  return getDefaultLocalApiUrl().replace(/\/+$/, "");
}

export interface AuthSession {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSession | null): void {
  if (!session) {
    localStorage.removeItem(STORAGE_AUTH_KEY);
  } else {
    localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(session));
  }
}

export async function testServerHealth(baseUrl: string): Promise<{
  ok: boolean;
  mode?: string;
  version?: string;
  error?: string;
}> {
  const cleanUrl = baseUrl.replace(/\/+$/, "");
  try {
    const res = await fetch(`${cleanUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { status: string; mode?: string; version?: string };
    return { ok: data.status === "ok", mode: data.mode, version: data.version };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha de conexão",
    };
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const session = getStoredSession();
    if (!session?.refreshToken) return null;

    try {
      const res = await fetch(`${getActiveApiBaseUrl()}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!res.ok) {
        saveStoredSession(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      saveStoredSession({
        ...session,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const baseUrl = getActiveApiBaseUrl();
  const session = getStoredSession();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!options.skipAuth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401 && !options.skipAuth && session?.refreshToken) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      headers.set("Authorization", `Bearer ${newAccessToken}`);
      res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? `Erro na requisição (${res.status})`);
  }
  return data as T;
}

export const api = {
  auth: {
    register: (input: RegisterInput) =>
      request<AuthSession>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
        skipAuth: true,
      }),
    login: (input: LoginInput) =>
      request<AuthSession>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
        skipAuth: true,
      }),
    logout: (refreshToken?: string) =>
      request<{ ok: boolean }>("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
    me: () => request<UserDTO>("/api/v1/auth/me"),
  },
  dashboard: {
    summary: (month: string) =>
      request<DashboardSummaryDTO>(`/api/v1/dashboard/summary?month=${encodeURIComponent(month)}`),
  },
  accounts: {
    list: () => request<AccountDTO[]>("/api/v1/accounts"),
    create: (input: CreateAccountInput) =>
      request<AccountDTO>("/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateAccountInput) =>
      request<AccountDTO>(`/api/v1/accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<void>(`/api/v1/accounts/${id}`, { method: "DELETE" }),
  },
  categories: {
    list: () => request<CategoryDTO[]>("/api/v1/categories"),
    create: (input: CreateCategoryInput) =>
      request<CategoryDTO>("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateCategoryInput) =>
      request<CategoryDTO>(`/api/v1/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    remove: (id: string) =>
      request<void>(`/api/v1/categories/${id}`, { method: "DELETE" }),
  },
  transactions: {
    list: (filters: Record<string, string | undefined> = {}) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      const qs = params.toString();
      return request<TransactionDTO[]>(`/api/v1/transactions${qs ? `?${qs}` : ""}`);
    },
    create: (input: CreateTransactionInput) =>
      request<TransactionDTO>("/api/v1/transactions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateTransactionInput) =>
      request<TransactionDTO>(`/api/v1/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    toggleStatus: (id: string) =>
      request<TransactionDTO>(`/api/v1/transactions/${id}/toggle-status`, {
        method: "PATCH",
      }),
    remove: (id: string) =>
      request<void>(`/api/v1/transactions/${id}`, { method: "DELETE" }),
    importRows: (input: ImportTransactionsInput) =>
      request<{ imported: number; skipped: number }>("/api/v1/transactions/import", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    exportCsvUrl: () => `${getActiveApiBaseUrl()}/api/v1/transactions/export?format=csv`,
    exportCsvText: async () => {
      const session = getStoredSession();
      const res = await fetch(`${getActiveApiBaseUrl()}/api/v1/transactions/export?format=csv`, {
        headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
      });
      if (!res.ok) throw new ApiError(res.status, "Erro ao exportar CSV");
      return res.text();
    },
  },
  creditCards: {
    invoices: (month: string) =>
      request<CreditCardInvoiceDTO[]>(
        `/api/v1/credit-cards/invoices?month=${encodeURIComponent(month)}`
      ),
    payInvoice: (accountId: string, input: PayInvoiceInput) =>
      request<{ ok: boolean; paidCents: number }>(
        `/api/v1/credit-cards/${accountId}/pay-invoice`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
  },
  budgets: {
    list: (month: string) =>
      request<BudgetOverviewDTO[]>(`/api/v1/budgets?month=${encodeURIComponent(month)}`),
  },
  goals: {
    list: () => request<GoalDTO[]>("/api/v1/goals"),
    create: (input: CreateGoalInput) =>
      request<GoalDTO>("/api/v1/goals", { method: "POST", body: JSON.stringify(input) }),
    update: (id: string, input: UpdateGoalInput) =>
      request<GoalDTO>(`/api/v1/goals/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    contribute: (id: string, input: ContributeGoalInput) =>
      request<GoalDTO>(`/api/v1/goals/${id}/contribute`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<void>(`/api/v1/goals/${id}`, { method: "DELETE" }),
  },
  integrations: {
    rates: () =>
      request<{
        source: "live" | "fallback";
        updatedAt: string;
        rates: { usdBrl: number; eurBrl: number; btcBrl: number };
      }>("/api/v1/integrations/rates"),
    bcb: () =>
      request<{
        source: "live" | "fallback";
        updatedAt: string;
        selicPercent: number;
        ipcaPercent12m: number;
      }>("/api/v1/integrations/bcb"),
    holidays: (year: number) =>
      request<{
        source: "live" | "fallback";
        year: string;
        holidays: Array<{ date: string; name: string; type: string }>;
      }>(`/api/v1/integrations/holidays/${year}`),
  },
  recurring: {
    list: () => request<RecurringRuleDTO[]>("/api/v1/recurring"),
    create: (input: CreateRecurringRuleInput) =>
      request<RecurringRuleDTO>("/api/v1/recurring", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateRecurringRuleInput) =>
      request<RecurringRuleDTO>(`/api/v1/recurring/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    materialize: (id: string, status: "PAID" | "PENDING" = "PAID") =>
      request<{ transaction: TransactionDTO; rule: RecurringRuleDTO }>(
        `/api/v1/recurring/${id}/materialize`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
        }
      ),
    processDue: () =>
      request<{ processed: number }>("/api/v1/recurring/process-due", {
        method: "POST",
      }),
    remove: (id: string) =>
      request<void>(`/api/v1/recurring/${id}`, { method: "DELETE" }),
  },
};
