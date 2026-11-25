import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  parseCurrencyToCents,
  type AccountDTO,
  type CategoryDTO,
  type CategoryType,
  type RecurrenceFrequency,
  type RecurringRuleDTO,
} from "@finflow/shared";
import { api } from "../lib/api";

interface RecurringModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  editing?: RecurringRuleDTO | null;
}

export function RecurringModal({
  open,
  onClose,
  onSaved,
  accounts,
  categories,
  editing,
}: RecurringModalProps) {
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("MONTHLY");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setAmountInput((editing.amountCents / 100).toFixed(2).replace(".", ","));
      setAccountId(editing.accountId);
      setCategoryId(editing.categoryId ?? "");
      setFrequency(editing.frequency);
      setStartDate(editing.startDate.slice(0, 10));
    } else {
      setType("EXPENSE");
      setTitle("");
      setAmountInput("");
      setAccountId(accounts[0]?.id ?? "");
      setCategoryId("");
      setFrequency("MONTHLY");
      setStartDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, editing, accounts]);

  if (!open) return null;

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountCents = parseCurrencyToCents(amountInput);
    if (amountCents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        accountId,
        categoryId: categoryId || null,
        title: title.trim(),
        type,
        amountCents,
        frequency,
        startDate,
      };
      if (editing) {
        await api.recurring.update(editing.id, payload);
      } else {
        await api.recurring.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar recorrência");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-label={editing ? "Editar Recorrência" : "Nova Recorrência"}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {editing ? "Editar Recorrência" : "Nova Recorrência"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setType("EXPENSE")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                type === "EXPENSE" ? "bg-rose-500 text-white" : "text-zinc-500"
              }`}
            >
              Despesa Recorrente
            </button>
            <button
              type="button"
              onClick={() => setType("INCOME")}
              className={`rounded-lg py-2 text-xs font-semibold transition ${
                type === "INCOME" ? "bg-emerald-500 text-zinc-950" : "text-zinc-500"
              }`}
            >
              Receita Recorrente
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Descrição</label>
              <input
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Aluguel, Internet, Netflix"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Valor (R$)</label>
              <input
                required
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Conta</label>
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Sem categoria</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Frequência</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quinzenal</option>
                <option value="DAILY">Diária</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Início / Venc.</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs text-rose-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Recorrência"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
