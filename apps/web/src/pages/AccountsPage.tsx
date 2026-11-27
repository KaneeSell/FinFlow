import { useEffect, useState } from "react";
import { Archive, Edit2, Plus, Trash2, Wallet, X } from "lucide-react";
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

const PRESET_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

interface AccountsPageProps {
  accounts: AccountDTO[];
  privacyMode: boolean;
  onRefresh: () => void;
}

export function AccountsPage({ accounts, privacyMode, onRefresh }: AccountsPageProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CHECKING");
  const [initialInput, setInitialInput] = useState("");
  const [creditLimitInput, setCreditLimitInput] = useState("");
  const [closingDay, setClosingDay] = useState("10");
  const [dueDay, setDueDay] = useState("17");
  const [creating, setCreating] = useState(false);

  const [editingAccount, setEditingAccount] = useState<AccountDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("CHECKING");
  const [editInitialInput, setEditInitialInput] = useState("");
  const [editColor, setEditColor] = useState("#10b981");
  const [editCreditLimitInput, setEditCreditLimitInput] = useState("");
  const [editClosingDay, setEditClosingDay] = useState("10");
  const [editDueDay, setEditDueDay] = useState("17");
  const [editArchived, setEditArchived] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingAccount) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editSaving) {
        setEditingAccount(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingAccount, editSaving]);

  const openEditModal = (acc: AccountDTO) => {
    setEditingAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditInitialInput((acc.initialBalanceCents / 100).toFixed(2).replace(".", ","));
    setEditColor(acc.color);
    setEditCreditLimitInput(
      acc.creditLimitCents != null ? (acc.creditLimitCents / 100).toFixed(2).replace(".", ",") : ""
    );
    setEditClosingDay(String(acc.closingDay ?? 10));
    setEditDueDay(String(acc.dueDay ?? 17));
    setEditArchived(acc.isArchived);
    setEditError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.accounts.create({
        name: name.trim(),
        type,
        initialBalanceCents: parseCurrencyToCents(initialInput || "0"),
        color: type === "CREDIT_CARD" ? "#8b5cf6" : "#10b981",
        icon: type === "CREDIT_CARD" ? "credit-card" : "landmark",
        ...(type === "CREDIT_CARD"
          ? {
              creditLimitCents: parseCurrencyToCents(creditLimitInput || "5000"),
              closingDay: Number(closingDay) || 10,
              dueDay: Number(dueDay) || 17,
            }
          : {}),
      });
      setName("");
      setInitialInput("");
      setCreditLimitInput("");
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Informe o nome da conta.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await api.accounts.update(editingAccount.id, {
        name: trimmedName,
        type: editType,
        initialBalanceCents: parseCurrencyToCents(editInitialInput || "0"),
        color: editColor,
        icon: editType === "CREDIT_CARD" ? "credit-card" : "landmark",
        isArchived: editArchived,
        creditLimitCents:
          editType === "CREDIT_CARD" ? parseCurrencyToCents(editCreditLimitInput || "0") : null,
        closingDay: editType === "CREDIT_CARD" ? Number(editClosingDay) || 10 : null,
        dueDay: editType === "CREDIT_CARD" ? Number(editDueDay) || 17 : null,
      });
      setEditingAccount(null);
      onRefresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro ao atualizar conta.");
    } finally {
      setEditSaving(false);
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
          value={type === "CREDIT_CARD" ? creditLimitInput : initialInput}
          onChange={(e) =>
            type === "CREDIT_CARD"
              ? setCreditLimitInput(e.target.value)
              : setInitialInput(e.target.value)
          }
          placeholder={type === "CREDIT_CARD" ? "Limite do cartão (R$)" : "Saldo inicial (R$)"}
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        {type === "CREDIT_CARD" && (
          <>
            <input
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              placeholder="Dia fechamento"
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-700"
            />
            <input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="Dia vencimento"
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none dark:border-zinc-700"
            />
          </>
        )}
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
            className={`flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${
              acc.isArchived ? "opacity-60" : ""
            }`}
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
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold">{acc.name}</h3>
                    {acc.isArchived && (
                      <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Arquivada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditModal(acc)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-500 dark:hover:bg-zinc-800"
                  aria-label="Editar conta"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(acc.id)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                  aria-label="Excluir conta"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {acc.type === "CREDIT_CARD" && (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                {acc.creditLimitCents != null && (
                  <span>
                    Limite:{" "}
                    <MoneyText cents={acc.creditLimitCents} privacyMode={privacyMode} />
                  </span>
                )}
                <span>
                  · Fecha dia {acc.closingDay ?? 10} / Vence dia {acc.dueDay ?? 17}
                </span>
              </div>
            )}

            <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              <p className="text-[11px] text-zinc-500">Saldo Atual</p>
              <p className="text-xl font-bold">
                <MoneyText cents={acc.currentBalanceCents} privacyMode={privacyMode} />
              </p>
            </div>
          </div>
        ))}
      </div>

      {editingAccount && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => !editSaving && setEditingAccount(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Editar Conta"
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editar Conta</h2>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditingAccount(null)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-account-name"
                  className="mb-1 block text-xs font-medium text-zinc-400"
                >
                  Nome da Conta
                </label>
                <input
                  id="edit-account-name"
                  required
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-account-type"
                    className="mb-1 block text-xs font-medium text-zinc-400"
                  >
                    Tipo
                  </label>
                  <select
                    id="edit-account-type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AccountType)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ACCOUNT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-account-initial"
                    className="mb-1 block text-xs font-medium text-zinc-400"
                  >
                    Saldo Inicial (R$)
                  </label>
                  <input
                    id="edit-account-initial"
                    inputMode="decimal"
                    value={editInitialInput}
                    onChange={(e) => setEditInitialInput(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
                  />
                </div>
              </div>

              {editType === "CREDIT_CARD" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label
                      htmlFor="edit-card-limit"
                      className="mb-1 block text-xs font-medium text-zinc-400"
                    >
                      Limite (R$)
                    </label>
                    <input
                      id="edit-card-limit"
                      inputMode="decimal"
                      value={editCreditLimitInput}
                      onChange={(e) => setEditCreditLimitInput(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-card-closing"
                      className="mb-1 block text-xs font-medium text-zinc-400"
                    >
                      Fechamento
                    </label>
                    <input
                      id="edit-card-closing"
                      type="number"
                      min={1}
                      max={31}
                      value={editClosingDay}
                      onChange={(e) => setEditClosingDay(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-card-due"
                      className="mb-1 block text-xs font-medium text-zinc-400"
                    >
                      Vencimento
                    </label>
                    <input
                      id="edit-card-due"
                      type="number"
                      min={1}
                      max={31}
                      value={editDueDay}
                      onChange={(e) => setEditDueDay(e.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
                    />
                  </div>
                </div>
              )}

              <div>
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">Cor</span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      onClick={() => setEditColor(c)}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        editColor === c
                          ? "scale-110 border-zinc-900 dark:border-white"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
                <span className="flex items-center gap-2 text-xs font-medium">
                  <Archive className="h-4 w-4 text-zinc-400" />
                  Conta arquivada
                </span>
                <input
                  type="checkbox"
                  checked={editArchived}
                  onChange={(e) => setEditArchived(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>

              {editError && (
                <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs text-rose-400">
                  {editError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditingAccount(null)}
                  className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {editSaving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
