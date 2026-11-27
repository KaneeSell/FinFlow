import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDTO, CategoryDTO, DashboardSummaryDTO, TransactionDTO } from "@finflow/shared";
import { api } from "../lib/api";
import { AccountsPage } from "./AccountsPage";
import { AuthPage } from "./AuthPage";
import { BudgetsGoalsPage } from "./BudgetsGoalsPage";
import { CategoriesPage } from "./CategoriesPage";
import { CreditCardsPage } from "./CreditCardsPage";
import { DashboardPage } from "./DashboardPage";
import { InvestmentsPage } from "./InvestmentsPage";
import { RecurringPage } from "./RecurringPage";
import { SettingsPage } from "./SettingsPage";
import { TransactionsPage } from "./TransactionsPage";
import { WorkspacesPage } from "./WorkspacesPage";

const ACCOUNTS: AccountDTO[] = [
  {
    id: "acc-1",
    name: "Conta Corrente",
    type: "CHECKING",
    initialBalanceCents: 100000,
    currentBalanceCents: 150000,
    color: "#10b981",
    icon: "landmark",
    isArchived: false,
    creditLimitCents: null,
    closingDay: null,
    dueDay: null,
    currency: "BRL",
    createdAt: "2026-11-01T00:00:00.000Z",
  },
];

const CATEGORIES: CategoryDTO[] = [
  {
    id: "cat-1",
    name: "Alimentação",
    type: "EXPENSE",
    color: "#ef4444",
    icon: "utensils",
    budgetLimitCents: 100000,
  },
];

const TRANSACTIONS: TransactionDTO[] = [
  {
    id: "tx-1",
    accountId: "acc-1",
    destinationAccountId: null,
    categoryId: "cat-1",
    recurringRuleId: null,
    title: "Supermercado",
    type: "EXPENSE",
    amountCents: 25000,
    date: "2026-11-27T12:00:00.000Z",
    status: "PAID",
    notes: null,
    tags: [],
    createdAt: "2026-11-27T12:00:00.000Z",
    account: { id: "acc-1", name: "Conta Corrente", color: "#10b981" },
    category: { id: "cat-1", name: "Alimentação", color: "#ef4444", icon: "utensils" },
  },
];

const SUMMARY: DashboardSummaryDTO = {
  month: "2026-11",
  totalBalanceCents: 150000,
  monthlyIncomeCents: 500000,
  monthlyExpenseCents: 25000,
  monthlyNetCents: 475000,
  pendingExpenseCents: 0,
  pendingIncomeCents: 0,
  savingsRatePercent: 95,
  expensesByCategory: [
    { categoryId: "cat-1", categoryName: "Alimentação", color: "#ef4444", totalCents: 25000, percent: 100 },
  ],
  cashflowHistory: [{ month: "2026-11", incomeCents: 500000, expenseCents: 25000 }],
  upcomingRecurring: [],
  recentTransactions: TRANSACTIONS,
};

describe("All FinFlow Pages Smoke & Interaction Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders AuthPage and switches between login and register", () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);
    expect(screen.getByText("Entrar no FinFlow")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    expect(screen.getByRole("button", { name: "Criar Conta e Começar" })).toBeInTheDocument();
  });

  it("renders DashboardPage and handles quick capture", async () => {
    vi.spyOn(api.insights, "parseNl").mockResolvedValue({
      title: "Café",
      amountCents: 1500,
      type: "EXPENSE",
      date: "2026-11-27",
      categoryId: "cat-1",
    });
    const createSpy = vi.spyOn(api.transactions, "create").mockResolvedValue(TRANSACTIONS[0]!);

    render(
      <DashboardPage
        summary={SUMMARY}
        accounts={ACCOUNTS}
        loading={false}
        month="2026-11"
        onMonthChange={vi.fn()}
        privacyMode={false}
        onNewTransaction={vi.fn()}
        onMaterializeRecurring={vi.fn()}
        onGoToTransactions={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Visão Geral" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Entrada rápida/), {
      target: { value: "Café 15,00 hoje" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Lançar$/ }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });
  });

  it("renders TransactionsPage and triggers new/toggle/delete actions", () => {
    const onNew = vi.fn();
    const onToggleStatus = vi.fn();
    const onDelete = vi.fn();

    render(
      <TransactionsPage
        transactions={TRANSACTIONS}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        month="2026-11"
        onMonthChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        typeFilter=""
        onTypeFilterChange={vi.fn()}
        privacyMode={false}
        onNew={onNew}
        onEdit={vi.fn()}
        onToggleStatus={onToggleStatus}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Novo Lançamento" }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("renders Accounts, Categories, Recurring, CreditCards, BudgetsGoals, Investments, Workspaces, and Settings pages", () => {
    render(<AccountsPage accounts={ACCOUNTS} privacyMode={false} onRefresh={vi.fn()} />);
    expect(screen.getAllByText("Conta Corrente").length).toBeGreaterThanOrEqual(1);

    cleanup();
    render(<CategoriesPage categories={CATEGORIES} onRefresh={vi.fn()} />);
    expect(screen.getAllByText("Alimentação").length).toBeGreaterThanOrEqual(1);

    cleanup();
    cleanup();
    render(
      <RecurringPage
        rules={[]}
        privacyMode={false}
        onNew={vi.fn()}
        onEdit={vi.fn()}
        onMaterialize={vi.fn()}
        onProcessDue={vi.fn()}
        onToggleActive={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Gastos & Receitas Recorrentes" })).toBeInTheDocument();

    cleanup();
    render(
      <CreditCardsPage
        invoices={[]}
        accounts={ACCOUNTS}
        month="2026-11"
        onMonthChange={vi.fn()}
        privacyMode={false}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Cartões & Faturas" })).toBeInTheDocument();

    cleanup();
    render(
      <BudgetsGoalsPage
        budgets={[]}
        goals={[]}
        rates={null}
        bcb={null}
        holidays={[]}
        month="2026-11"
        onMonthChange={vi.fn()}
        privacyMode={false}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Orçamentos por Categoria" })).toBeInTheDocument();

    cleanup();
    render(
      <InvestmentsPage
        assets={[]}
        netWorth={null}
        privacyMode={false}
        onRefresh={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Patrimônio & Investimentos" })).toBeInTheDocument();

    cleanup();
    render(
      <WorkspacesPage
        workspaces={[]}
        openFinanceConnections={[]}
        privacyMode={false}
        onRefresh={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Espaços Compartilhados & Open Finance" })
    ).toBeInTheDocument();

    cleanup();
    render(
      <SettingsPage
        user={{
          id: "u1",
          name: "Daniel",
          email: "daniel@finflow.app",
          currency: "BRL",
          createdAt: "2026-11-01T00:00:00.000Z",
        }}
        darkMode={true}
        onToggleTheme={vi.fn()}
        privacyMode={false}
        onTogglePrivacy={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
  });
});
