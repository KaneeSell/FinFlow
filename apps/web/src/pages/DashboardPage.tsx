import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  PiggyBank,
  Plus,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { AccountDTO, DashboardSummaryDTO } from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

interface DashboardPageProps {
  summary: DashboardSummaryDTO | null;
  accounts?: AccountDTO[];
  loading: boolean;
  month: string;
  onMonthChange: (nextMonth: string) => void;
  privacyMode: boolean;
  onNewTransaction: () => void;
  onMaterializeRecurring: (id: string) => void;
  onGoToTransactions: () => void;
  onRefresh?: () => void;
}

export function DashboardPage({
  summary,
  accounts = [],
  loading,
  month,
  onMonthChange,
  privacyMode,
  onNewTransaction,
  onMaterializeRecurring,
  onGoToTransactions,
  onRefresh,
}: DashboardPageProps) {
  const [quickInput, setQuickInput] = useState("");
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickInput.trim();
    const defaultAccountId = accounts[0]?.id;
    if (!text || !defaultAccountId) return;

    setQuickFeedback(null);
    try {
      if (text.includes("qrcode") || /^\d{44}$/.test(text)) {
        const nfce = await api.insights.parseNfce(text);
        if (nfce.valid) {
          await api.transactions.create({
            accountId: defaultAccountId,
            title: `NFC-e CNPJ ${nfce.cnpj}`,
            type: "EXPENSE",
            amountCents: nfce.amountCents ?? 1000,
            date: new Date().toISOString().slice(0, 10),
            status: "PAID",
            tags: ["nfce"],
          });
          setQuickInput("");
          setQuickFeedback("Nota NFC-e lançada com sucesso!");
          onRefresh?.();
          return;
        }
      }

      const parsed = await api.insights.parseNl(text);
      if (parsed.amountCents <= 0) {
        setQuickFeedback("Não identifiquei o valor. Ex: 'Almoço 45,90 hoje'");
        return;
      }
      await api.transactions.create({
        accountId: defaultAccountId,
        categoryId: parsed.categoryId,
        title: parsed.title,
        type: parsed.type,
        amountCents: parsed.amountCents,
        date: parsed.date,
        status: "PAID",
      });
      setQuickInput("");
      setQuickFeedback(`Lançado: ${parsed.title} (R$ ${(parsed.amountCents / 100).toFixed(2)})`);
      onRefresh?.();
    } catch {
      setQuickFeedback("Erro ao processar entrada rápida.");
    }
  };
  if (loading && !summary) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-900" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-900" />
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-900" />
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-900" />
        </div>
      </div>
    );
  }

  const maxHistory = Math.max(
    1,
    ...(summary?.cashflowHistory.flatMap((h) => [h.incomeCents, h.expenseCents]) ?? [1])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-xs text-zinc-500">Resumo consolidado das suas finanças</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-900"
            aria-label="Selecionar mês"
          />
          <button
            type="button"
            onClick={onNewTransaction}
            className="hidden items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 sm:flex"
          >
            <Plus className="h-4 w-4" />
            <span>Novo</span>
            <kbd className="ml-1 rounded bg-emerald-600/30 px-1.5 py-0.5 text-[10px]">N</kbd>
          </button>
        </div>
      </div>

      {/* Quick NLP / NFC-e Bar */}
      <form
        onSubmit={handleQuickCapture}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
        <input
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          placeholder='Entrada rápida: "Almoço 45,90 alimentação ontem" ou cole URL de NFC-e...'
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
        >
          Lançar
        </button>
      </form>
      {quickFeedback && <p className="text-xs text-emerald-400">{quickFeedback}</p>}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Saldo Total</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            <MoneyText cents={summary?.totalBalanceCents ?? 0} privacyMode={privacyMode} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">Todas as contas ativas</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Receitas do Mês</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-500">
            <MoneyText cents={summary?.monthlyIncomeCents ?? 0} privacyMode={privacyMode} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pendente:{" "}
            <MoneyText cents={summary?.pendingIncomeCents ?? 0} privacyMode={privacyMode} />
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Despesas do Mês</span>
            <ArrowDownRight className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-500">
            <MoneyText cents={summary?.monthlyExpenseCents ?? 0} privacyMode={privacyMode} />
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Pendente:{" "}
            <MoneyText cents={summary?.pendingExpenseCents ?? 0} privacyMode={privacyMode} />
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Taxa de Poupança</span>
            <PiggyBank className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {summary?.savingsRatePercent ?? 0}%
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Saldo do mês:{" "}
            <MoneyText cents={summary?.monthlyNetCents ?? 0} privacyMode={privacyMode} showSign />
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 6-month Cashflow */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold">Fluxo de Caixa (Últimos 6 meses)</h2>
          <div className="flex h-44 items-end justify-between gap-2">
            {summary?.cashflowHistory.map((item) => {
              const incHeight = Math.max(4, Math.round((item.incomeCents / maxHistory) * 100));
              const expHeight = Math.max(4, Math.round((item.expenseCents / maxHistory) * 100));
              return (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      className="w-3 rounded-t-md bg-emerald-500/80 transition-all sm:w-4"
                      style={{ height: `${item.incomeCents > 0 ? incHeight : 2}%` }}
                      title={`Receita: ${(item.incomeCents / 100).toFixed(2)}`}
                    />
                    <div
                      className="w-3 rounded-t-md bg-rose-500/80 transition-all sm:w-4"
                      style={{ height: `${item.expenseCents > 0 ? expHeight : 2}%` }}
                      title={`Despesa: ${(item.expenseCents / 100).toFixed(2)}`}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500">{item.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold">Despesas por Categoria</h2>
          {!summary?.expensesByCategory.length ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              Nenhuma despesa registrada neste mês.
            </p>
          ) : (
            <div className="space-y-3">
              {summary.expensesByCategory.slice(0, 5).map((cat) => (
                <div key={cat.categoryName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.categoryName}
                    </span>
                    <span className="text-zinc-400">
                      <MoneyText cents={cat.totalCents} privacyMode={privacyMode} /> ({cat.percent}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Upcoming Recurring & Recent Transactions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-amber-400" />
              Próximas Recorrências
            </h2>
          </div>

          {!summary?.upcomingRecurring.length ? (
            <p className="py-6 text-center text-xs text-zinc-500">
              Nenhuma recorrência ativa cadastrada.
            </p>
          ) : (
            <div className="space-y-2.5">
              {summary.upcomingRecurring.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800/80"
                >
                  <div>
                    <p className="text-sm font-medium">{rule.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      Próx: {rule.nextRunDate.slice(0, 10)} • {rule.account?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        rule.type === "INCOME" ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      <MoneyText cents={rule.amountCents} privacyMode={privacyMode} />
                    </span>
                    <button
                      type="button"
                      onClick={() => onMaterializeRecurring(rule.id)}
                      className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400 hover:bg-emerald-500/25"
                      title="Lançar agora"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Últimos Lançamentos</h2>
            <button
              type="button"
              onClick={onGoToTransactions}
              className="text-xs font-medium text-emerald-500 hover:underline"
            >
              Ver todos
            </button>
          </div>

          {!summary?.recentTransactions.length ? (
            <p className="py-6 text-center text-xs text-zinc-500">
              Nenhum lançamento ainda. Pressione <kbd className="rounded bg-zinc-800 px-1">N</kbd>{" "}
              para criar.
            </p>
          ) : (
            <div className="space-y-2">
              {summary.recentTransactions.slice(0, 6).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <div>
                    <p className="text-sm font-medium">{tx.title}</p>
                    <p className="text-[11px] text-zinc-500">
                      {tx.date.slice(0, 10)} • {tx.category?.name ?? tx.type}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      tx.type === "INCOME"
                        ? "text-emerald-500"
                        : tx.type === "EXPENSE"
                          ? "text-rose-500"
                          : "text-sky-400"
                    }`}
                  >
                    <MoneyText
                      cents={tx.type === "EXPENSE" ? -tx.amountCents : tx.amountCents}
                      privacyMode={privacyMode}
                      showSign
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
