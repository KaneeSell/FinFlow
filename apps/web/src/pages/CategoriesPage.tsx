import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CategoryDTO, CategoryType } from "@finflow/shared";
import { api } from "../lib/api";

interface CategoriesPageProps {
  categories: CategoryDTO[];
  onRefresh: () => void;
}

export function CategoriesPage({ categories, onRefresh }: CategoriesPageProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [color, setColor] = useState("#6366f1");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.categories.create({
        name: name.trim(),
        type,
        color,
        icon: "tag",
      });
      setName("");
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
        className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4"
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
    </div>
  );
}
