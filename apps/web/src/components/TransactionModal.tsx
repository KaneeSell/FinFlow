import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  parseCurrencyToCents,
  type AccountDTO,
  type CategoryDTO,
  type TransactionDTO,
  type TransactionStatus,
  type TransactionType,
} from "@finflow/shared";
import { api } from "../lib/api";

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accounts: AccountDTO[];
  categories: CategoryDTO[];
  editing?: TransactionDTO | null;
}

export function TransactionModal({
  open,
  onClose,
  onSaved,
  accounts,
  categories,
  editing,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [title, setTitle] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<TransactionStatus>("PAID");
  const [notes, setNotes] = useState("");
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
      setDestinationAccountId(editing.destinationAccountId ?? "");
      setCategoryId(editing.categoryId ?? "");
      setDate(editing.date.slice(0, 10));
      setStatus(editing.status);
      setNotes(editing.notes ?? "");
    } else {
      setType("EXPENSE");
      setTitle("");
      setAmountInput("");
      setAccountId(accounts[0]?.id ?? "");
      setDestinationAccountId(accounts[1]?.id ?? "");
      setCategoryId("");
      setDate(new Date().toISOString().slice(0, 10));
      setStatus("PAID");
      setNotes("");
    }
  }, [open, editing, accounts]);

  if (!open) return null;

  const filteredCategories = categories.filter(
    (c) => (type === "INCOME" ? c.type === "INCOME" : c.type === "EXPENSE")
  );

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
        destinationAccountId: type === "TRANSFER" ? destinationAccountId || null : null,
        categoryId: type === "TRANSFER" ? null : categoryId || null,
        title: title.trim(),
        type,
        amountCents,
        date,
        status,
        notes: notes.trim() || null,
      };

      if (editing) {
        await api.transactions.update(editing.id, payload);
      } else {
        await api.transactions.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar lançamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-label={editing ? "Editar Lançamento" : "Novo Lançamento"}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {editing ? "Editar Lançamento" : "Novo Lançamento"}
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
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            {(
              [
                { value: "EXPENSE", label: "Despesa" },
                { value: "INCOME", label: "Receita" },
                { value: "TRANSFER", label: "Transferência" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`rounded-lg py-2 text-xs font-semibold transition ${
                  type === opt.value
                    ? opt.value === "INCOME"
                      ? "bg-emerald-500 text-zinc-950"
                      : opt.value === "EXPENSE"
                        ? "bg-rose-500 text-white"
                        : "bg-sky-500 text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Descrição</label>
              <input
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Supermercado, Salário..."
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
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                {type === "TRANSFER" ? "Conta de Origem" : "Conta"}
              </label>
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

            {type === "TRANSFER" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Conta de Destino
                </label>
                <select
                  required
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Selecione...</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
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
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="PAID">Pago / Recebido</option>
                <option value="PENDING">Pendente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Observações</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
            />
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
              {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
