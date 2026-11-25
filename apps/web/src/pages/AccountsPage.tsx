import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import {
  ACCOUNT_TYPES,
  parseCurrencyToCents,
  type AccountDTO,
  type AccountType,
} from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Conta Corrente",
  WALLET: "Carteira",
  SAVINGS: "Poupança",
  CREDIT_CARD: "Cartão de Crédito",
  INVESTMENT: "Investimentos",
};

interface AccountsPageProps {
  accounts: AccountDTO[];
  privacyMode: boolean;
  onRefresh: () => void;
}

export function AccountsPage({ accounts, privacyMode, onRefresh }: AccountsPageProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [initialInput, setInitialInput] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.accounts.create({
        name: name.trim(),
        type,
        initialBalanceCents: parseCurrencyToCents(initialInput || "0"),
        color: "#10b981",
        icon: "landmark",
      });
      setName("");
      setInitialInput("");
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.accounts.remove(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
        <p className="text-xs text-zinc-500">Bancos, carteiras e reservas com saldo calculado</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da conta (ex: Nubank)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          inputMode="decimal"
          value={initialInput}
          onChange={(e) => setInitialInput(e.target.value)}
          placeholder="Saldo inicial (R$)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: acc.color }}
                >
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold">{acc.name}</h3>
                  <p className="text-xs text-zinc-500">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(acc.id)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                aria-label="Excluir conta"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-500">Saldo Atual</p>
              <p className="text-xl font-bold">
                <MoneyText cents={acc.currentBalanceCents} privacyMode={privacyMode} />
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
