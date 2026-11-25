import { Check, Edit2, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { RecurringRuleDTO } from "@finflow/shared";
import { MoneyText } from "../components/MoneyText";

const FREQ_LABEL: Record<string, string> = {
  DAILY: "Diária",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

interface RecurringPageProps {
  rules: RecurringRuleDTO[];
  privacyMode: boolean;
  onNew: () => void;
  onEdit: (rule: RecurringRuleDTO) => void;
  onMaterialize: (id: string) => void;
  onProcessDue: () => void;
  onToggleActive: (rule: RecurringRuleDTO) => void;
  onDelete: (id: string) => void;
}

export function RecurringPage({
  rules,
  privacyMode,
  onNew,
  onEdit,
  onMaterialize,
  onProcessDue,
  onToggleActive,
  onDelete,
}: RecurringPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gastos & Receitas Recorrentes</h1>
          <p className="text-xs text-zinc-500">Assinaturas, contas fixas e salário mensal</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onProcessDue}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Processar Vencidas
          </button>

          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Nova Recorrência
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rules.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            Nenhuma regra recorrente cadastrada ainda.
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-2xl border bg-white p-4 dark:bg-zinc-900 ${
                rule.isActive
                  ? "border-zinc-200 dark:border-zinc-800"
                  : "border-zinc-200/50 opacity-60 dark:border-zinc-800/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{rule.title}</h3>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {FREQ_LABEL[rule.frequency] ?? rule.frequency}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Próximo venc.: {rule.nextRunDate.slice(0, 10)} • {rule.account?.name}
                    {rule.category ? ` • ${rule.category.name}` : ""}
                  </p>
                </div>

                <span
                  className={`text-base font-bold ${
                    rule.type === "INCOME" ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  <MoneyText cents={rule.amountCents} privacyMode={privacyMode} />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => onMaterialize(rule.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
                >
                  <Play className="h-3.5 w-3.5" />
                  Gerar Lançamento
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onToggleActive(rule)}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title={rule.isActive ? "Pausar" : "Ativar"}
                  >
                    <Check className="inline h-3.5 w-3.5 mr-1" />
                    {rule.isActive ? "Ativa" : "Pausada"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(rule)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Editar recorrência"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(rule.id)}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                    aria-label="Excluir recorrência"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
