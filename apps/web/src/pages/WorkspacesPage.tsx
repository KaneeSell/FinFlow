import { useEffect, useState } from "react";
import { Building2, Check, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import {
  parseCurrencyToCents,
  type OpenFinanceConnectionDTO,
  type SharedExpenseDTO,
  type WorkspaceDTO,
} from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";
import { api } from "../lib/api";

interface WorkspacesPageProps {
  workspaces: WorkspaceDTO[];
  openFinanceConnections: OpenFinanceConnectionDTO[];
  privacyMode: boolean;
  onRefresh: () => void;
}

export function WorkspacesPage({
  workspaces,
  openFinanceConnections,
  privacyMode,
  onRefresh,
}: WorkspacesPageProps) {
  const [wsName, setWsName] = useState("");
  const [selectedWsId, setSelectedWsId] = useState(workspaces[0]?.id ?? "");
  const [expenses, setExpenses] = useState<SharedExpenseDTO[]>([]);
  const [balances, setBalances] = useState<Array<{ memberName: string; netBalanceCents: number }>>([]);
  const [memberName, setMemberName] = useState("");
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [instName, setInstName] = useState("Banco Inter");

  const activeWs = workspaces.find((w) => w.id === selectedWsId) ?? workspaces[0];

  const loadExpenses = async (wsId: string) => {
    const res = await api.workspaces.expenses(wsId);
    setExpenses(res.expenses);
    setBalances(res.balances);
  };

  useEffect(() => {
    if (activeWs) {
      void loadExpenses(activeWs.id);
    }
  }, [activeWs?.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Espaços Compartilhados & Open Finance</h1>
        <p className="text-xs text-zinc-500">Divisão de contas (Casal/Família/PJ) e conexão bancária</p>
      </div>

      {/* Create Workspace */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!wsName.trim()) return;
          const created = await api.workspaces.create({ name: wsName.trim(), type: "COUPLE" });
          setWsName("");
          setSelectedWsId(created.id);
          onRefresh();
        }}
        className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          required
          value={wsName}
          onChange={(e) => setWsName(e.target.value)}
          placeholder="Novo espaço (ex: Casa / Viagem)"
          className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          <Plus className="h-4 w-4" />
          Criar Espaço
        </button>
      </form>

      {activeWs && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-400" />
              <select
                value={activeWs.id}
                onChange={(e) => setSelectedWsId(e.target.value)}
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!memberName.trim()) return;
                await api.workspaces.addMember(activeWs.id, memberName.trim());
                setMemberName("");
                onRefresh();
              }}
              className="flex gap-2"
            >
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Adicionar participante"
                className="rounded-xl border border-zinc-300 bg-transparent px-3 py-1.5 text-xs dark:border-zinc-700"
              />
              <button
                type="submit"
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
              >
                + Membro
              </button>
            </form>
          </div>

          {/* Balances */}
          {balances.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {balances.map((b) => (
                <div
                  key={b.memberName}
                  className="rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50"
                >
                  <span className="font-medium">{b.memberName}: </span>
                  <span
                    className={
                      b.netBalanceCents >= 0 ? "font-bold text-emerald-400" : "font-bold text-rose-400"
                    }
                  >
                    <MoneyText cents={b.netBalanceCents} privacyMode={privacyMode} showSign />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Add shared expense */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const amountCents = parseCurrencyToCents(expAmount);
              if (!expTitle.trim() || amountCents <= 0) return;
              const participants = activeWs.members.map((m) => m.memberName);
              await api.workspaces.createExpense(activeWs.id, {
                title: expTitle.trim(),
                paidByName: participants[0] ?? "Você",
                totalAmountCents: amountCents,
                participants,
                date: new Date().toISOString().slice(0, 10),
              });
              setExpTitle("");
              setExpAmount("");
              void loadExpenses(activeWs.id);
            }}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            <input
              required
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="Despesa dividida (ex: Mercado)"
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
            />
            <input
              required
              inputMode="decimal"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="Valor total (R$)"
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs tabular-nums dark:border-zinc-700"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950"
            >
              Dividir Igualmente ({activeWs.members.length}x)
            </button>
          </form>

          {/* Expenses list */}
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 px-3 py-2 text-xs dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">
                    {exp.title} {exp.settled && <span className="text-emerald-400">(Quitada)</span>}
                  </p>
                  <p className="text-zinc-500">Pago por {exp.paidByName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MoneyText cents={exp.totalAmountCents} privacyMode={privacyMode} />
                  {!exp.settled && (
                    <button
                      type="button"
                      onClick={async () => {
                        await api.workspaces.settleExpense(activeWs.id, exp.id);
                        void loadExpenses(activeWs.id);
                      }}
                      className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-400"
                      title="Quitar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Finance Brasil */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-sky-400" />
          <h2 className="text-sm font-semibold">Open Finance Brasil (Pluggy / Belvo / Sandbox)</h2>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!instName.trim()) return;
            await api.openFinance.connect({
              provider: "SANDBOX",
              institutionName: instName.trim(),
            });
            onRefresh();
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={instName}
            onChange={(e) => setInstName(e.target.value)}
            placeholder="Instituição (ex: Banco Inter, Nubank)"
            className="flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-zinc-950"
          >
            Conectar Banco
          </button>
        </form>

        {openFinanceConnections.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50"
          >
            <span>
              <strong>{c.institutionName}</strong> ({c.provider}) • {c.status}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await api.openFinance.sync(c.id);
                  onRefresh();
                }}
                className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-emerald-400"
              >
                <RefreshCw className="h-3 w-3" />
                Sincronizar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.openFinance.remove(c.id);
                  onRefresh();
                }}
                className="text-zinc-400 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
