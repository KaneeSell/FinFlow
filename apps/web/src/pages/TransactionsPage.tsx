import { CheckCircle2, Clock, Edit2, Plus, Search, Trash2 } from "lucide-react";
import type { AccountDTO, CategoryDTO, TransactionDTO } from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";

interface TransactionsPageProps {
  transactions: TransactionDTO[];
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  month: string;
  onMonthChange: (month: string) => void;
  search: string;
  onSearchChange: (q: string) => void;
  typeFilter: string;
  onTypeFilterChange: (t: string) => void;
  privacyMode: boolean;
  onNew: () => void;
  onEdit: (tx: TransactionDTO) => void;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TransactionsPage({
  transactions,
  month,
  onMonthChange,
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  privacyMode,
  onNew,
  onEdit,
  onToggleStatus,
  onDelete,
}: TransactionsPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-xs text-zinc-500">Receitas, despesas e transferências</p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar descrição..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
        />

        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="">Todos os tipos</option>
          <option value="EXPENSE">Despesas</option>
          <option value="INCOME">Receitas</option>
          <option value="TRANSFER">Transferências</option>
        </select>
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {transactions.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            Nenhum lançamento encontrado para os filtros selecionados.
          </p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleStatus(tx.id)}
                  title={tx.status === "PAID" ? "Marcar como Pendente" : "Marcar como Pago"}
                  className={`rounded-full p-1 transition ${
                    tx.status === "PAID"
                      ? "text-emerald-500 hover:bg-emerald-500/10"
                      : "text-amber-400 hover:bg-amber-500/10"
                  }`}
                >
                  {tx.status === "PAID" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium">{tx.title}</p>
                  <p className="text-xs text-zinc-500">
                    {tx.date.slice(0, 10)} • {tx.account?.name}
                    {tx.destinationAccount ? ` → ${tx.destinationAccount.name}` : ""}
                    {tx.category ? ` • ${tx.category.name}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
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

                <button
                  type="button"
                  onClick={() => onEdit(tx)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-200 dark:hover:bg-zinc-800"
                  aria-label="Editar lançamento"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(tx.id)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                  aria-label="Excluir lançamento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
