import { useState } from "react";
import { AlertTriangle, Calendar, Globe, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import {
  parseCurrencyToCents,
  type BudgetOverviewDTO,
  type GoalDTO,
} from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

interface BudgetsGoalsPageProps {
  budgets: BudgetOverviewDTO[];
  goals: GoalDTO[];
  rates: { usdBrl: number; eurBrl: number; btcBrl: number } | null;
  bcb: { selicPercent: number; ipcaPercent12m: number } | null;
  holidays: Array<{ date: string; name: string }>;
  month: string;
  onMonthChange: (m: string) => void;
  privacyMode: boolean;
  onRefresh: () => void;
}

export function BudgetsGoalsPage({
  budgets,
  goals,
  rates,
  bcb,
  holidays,
  month,
  onMonthChange,
  privacyMode,
  onRefresh,
}: BudgetsGoalsPageProps) {
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmountCents = parseCurrencyToCents(goalTarget);
    if (!goalName.trim() || targetAmountCents <= 0) return;
    setCreating(true);
    try {
      await api.goals.create({
        name: goalName.trim(),
        targetAmountCents,
        currentAmountCents: 0,
        deadline: goalDeadline || null,
        color: "#10b981",
        icon: "target",
      });
      setGoalName("");
      setGoalTarget("");
      setGoalDeadline("");
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleContribute = async (goalId: string) => {
    await api.goals.contribute(goalId, { amountCents: 10000 });
    onRefresh();
  };

  const handleDeleteGoal = async (goalId: string) => {
    await api.goals.remove(goalId);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orçamentos, Metas & Mercado</h1>
          <p className="text-xs text-zinc-500">
            Envelopes por categoria, objetivos financeiros e indicadores do Brasil
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      {/* Market Indicators */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Globe className="h-4 w-4 text-sky-400" />
            Câmbio & Cripto (AwesomeAPI)
          </div>
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            <p>USD: R$ {rates?.usdBrl.toFixed(2) ?? "--"}</p>
            <p>EUR: R$ {rates?.eurBrl.toFixed(2) ?? "--"}</p>
            <p>BTC: R$ {rates ? Math.round(rates.btcBrl).toLocaleString("pt-BR") : "--"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            Banco Central (SGS)
          </div>
          <div className="mt-2 space-y-1 text-sm tabular-nums">
            <p>Taxa Selic: {bcb?.selicPercent ?? "--"}% a.a.</p>
            <p>IPCA (12m): {bcb?.ipcaPercent12m ?? "--"}%</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Calendar className="h-4 w-4 text-amber-400" />
            Feriados Nacionais (BrasilAPI)
          </div>
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            {holidays.slice(0, 3).map((h) => (
              <p key={h.date}>
                {h.date} — {h.name}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Budgets */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Orçamentos por Categoria</h2>
        {budgets.length === 0 ? (
          <p className="py-4 text-xs text-zinc-500">
            Defina um limite mensal nas categorias de despesa (aba Categorias) para acompanhar aqui.
          </p>
        ) : (
          <div className="space-y-4">
            {budgets.map((b) => (
              <div key={b.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    {b.categoryName}
                    {b.alertLevel !== "ok" && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          b.alertLevel === "exceeded"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {b.alertLevel === "exceeded" ? "Estourado" : "Atenção (80%+)"}
                      </span>
                    )}
                  </span>
                  <span className="text-zinc-400">
                    <MoneyText cents={b.spentCents} privacyMode={privacyMode} /> /{" "}
                    <MoneyText cents={b.budgetLimitCents} privacyMode={privacyMode} /> ({b.percent}%)
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      b.alertLevel === "exceeded"
                        ? "bg-rose-500"
                        : b.alertLevel === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, b.percent)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Goals */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Metas Financeiras</h2>

        <form
          onSubmit={handleCreateGoal}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4"
        >
          <input
            required
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            placeholder="Nome da meta (ex: Reserva)"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
          <input
            required
            inputMode="decimal"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            placeholder="Objetivo (R$)"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
          />
          <input
            type="date"
            value={goalDeadline}
            onChange={(e) => setGoalDeadline(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Criar Meta
          </button>
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {goals.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    {g.deadline && <p className="text-[11px] text-zinc-500">Prazo: {g.deadline}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(g.id)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                  aria-label="Excluir meta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>
                    <MoneyText cents={g.currentAmountCents} privacyMode={privacyMode} /> de{" "}
                    <MoneyText cents={g.targetAmountCents} privacyMode={privacyMode} />
                  </span>
                  <span className="font-semibold text-emerald-400">{g.percent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${g.percent}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleContribute(g.id)}
                  className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
                >
                  + Aportar R$ 100,00
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
