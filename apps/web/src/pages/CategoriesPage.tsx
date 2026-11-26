import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  parseCurrencyToCents,
  type AutoRuleDTO,
  type CategoryDTO,
  type CategoryType,
} from "@finflow/shared";
import { api } from "../lib/api";

interface CategoriesPageProps {
  categories: CategoryDTO[];
  rules?: AutoRuleDTO[];
  onRefresh: () => void;
}

export function CategoriesPage({ categories, rules = [], onRefresh }: CategoriesPageProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [color, setColor] = useState("#6366f1");
  const [budgetLimitInput, setBudgetLimitInput] = useState("");
  const [creating, setCreating] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState(categories[0]?.id ?? "");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const budgetCents = budgetLimitInput ? parseCurrencyToCents(budgetLimitInput) : null;
      await api.categories.create({
        name: name.trim(),
        type,
        color,
        icon: "tag",
        budgetLimitCents: budgetCents && budgetCents > 0 ? budgetCents : null,
      });
      setName("");
      setBudgetLimitInput("");
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.categories.remove(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <p className="text-xs text-zinc-500">Organize receitas e despesas</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-5"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da categoria"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CategoryType)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="EXPENSE">Despesa</option>
          <option value="INCOME">Receita</option>
        </select>
        <input
          inputMode="decimal"
          value={budgetLimitInput}
          onChange={(e) => setBudgetLimitInput(e.target.value)}
          placeholder="Limite mensal (R$)"
          className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm tabular-nums outline-none focus:border-emerald-500 dark:border-zinc-700"
        />
        <div className="flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-1.5 dark:border-zinc-700">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-6 w-8 cursor-pointer bg-transparent"
          />
          <span className="text-xs font-mono text-zinc-500">{color}</span>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["EXPENSE", "INCOME"] as const).map((catType) => (
          <div
            key={catType}
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="mb-3 text-sm font-semibold">
              {catType === "EXPENSE" ? "Despesas" : "Receitas"}
            </h2>
            <div className="space-y-2">
              {categories
                .filter((c) => c.type === catType)
                .map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="flex items-center gap-2.5 text-sm">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      className="rounded-lg p-1 text-zinc-400 hover:bg-rose-500/15 hover:text-rose-400"
                      aria-label="Excluir categoria"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Auto-Categorization Rules */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold">Regras de Auto-Categorização</h2>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const catId = ruleCategoryId || categories[0]?.id;
            if (!ruleName.trim() || !rulePattern.trim() || !catId) return;
            await api.rules.create({
              name: ruleName.trim(),
              matchType: "CONTAINS",
              pattern: rulePattern.trim(),
              categoryId: catId,
              applyTags: [],
              priority: 10,
            });
            setRuleName("");
            setRulePattern("");
            onRefresh();
          }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        >
          <input
            required
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Nome (ex: Uber)"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs outline-none dark:border-zinc-700"
          />
          <input
            required
            value={rulePattern}
            onChange={(e) => setRulePattern(e.target.value)}
            placeholder="Se descrição contém..."
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs outline-none dark:border-zinc-700"
          />
          <select
            value={ruleCategoryId || categories[0]?.id}
            onChange={(e) => setRuleCategoryId(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950"
          >
            Criar Regra
          </button>
        </form>

        {rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50"
              >
                <span>
                  <strong>{r.name}</strong> — contém &quot;{r.pattern}&quot; →{" "}
                  <span className="text-emerald-400">{r.category?.name}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await api.rules.remove(r.id);
                    onRefresh();
                  }}
                  className="text-zinc-400 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
