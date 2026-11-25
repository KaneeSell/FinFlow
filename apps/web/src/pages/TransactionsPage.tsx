import { useState } from "react";
import { CheckCircle2, Clock, Download, Edit2, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  parseCsvStatement,
  parseOfxStatement,
  type AccountDTO,
  type CategoryDTO,
  type TransactionDTO,
} from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

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
  onRefresh?: () => void;
}

export function TransactionsPage({
  transactions,
  accounts,
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
  onRefresh,
}: TransactionsPageProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState(accounts[0]?.id ?? "");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExportCsv = async () => {
    const csv = await api.transactions.exportCsvText();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finflow-lancamentos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAcc = importAccountId || accounts[0]?.id;
    if (!targetAcc || !importText.trim()) return;
    const rows = importText.includes("<STMTTRN>")
      ? parseOfxStatement(importText)
      : parseCsvStatement(importText);
    if (rows.length === 0) {
      setImportStatus("Nenhum lançamento válido encontrado no arquivo/texto.");
      return;
    }
    const res = await api.transactions.importRows({ accountId: targetAcc, rows });
    setImportStatus(`Importados: ${res.imported} • Ignorados (duplicados): ${res.skipped}`);
    onRefresh?.();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-xs text-zinc-500">Receitas, despesas e transferências</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setImportStatus(null);
              setImportOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar OFX/CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </button>
        </div>
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

      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setImportOpen(false)}
        >
          <form
            onSubmit={handleImportSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">Importar Extrato OFX ou CSV</h2>
            <select
              value={importAccountId || accounts[0]?.id}
              onChange={(e) => setImportAccountId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Cole o conteúdo OFX ou CSV (Data;Descrição;Valor)\n25/11/2026;Mercado;-120,50"}
              className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-xs font-mono outline-none dark:border-zinc-700"
            />
            {importStatus && (
              <p className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs text-emerald-400">
                {importStatus}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-xs dark:border-zinc-700"
              >
                Fechar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950"
              >
                Importar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
