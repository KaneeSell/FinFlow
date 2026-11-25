import { X } from "lucide-react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Ctrl + K / Cmd + K", desc: "Abrir Paleta de Comandos global" },
  { keys: "N", desc: "Novo lançamento rápido" },
  { keys: "G depois D", desc: "Ir para Dashboard" },
  { keys: "G depois T", desc: "Ir para Lançamentos" },
  { keys: "G depois R", desc: "Ir para Recorrentes" },
  { keys: "G depois F", desc: "Ir para Cartões & Faturas" },
  { keys: "G depois B", desc: "Ir para Orçamentos & Metas" },
  { keys: "G depois A", desc: "Ir para Contas" },
  { keys: "G depois C", desc: "Ir para Categorias" },
  { keys: "G depois S", desc: "Ir para Configurações" },
  { keys: "P", desc: "Ativar/desativar Modo Privacidade" },
  { keys: "?", desc: "Abrir esta ajuda" },
  { keys: "Esc", desc: "Fechar modal ou paleta" },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Atalhos de Teclado"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Atalhos de Teclado (Keyboard First)</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/60"
            >
              <span className="text-zinc-600 dark:text-zinc-300">{s.desc}</span>
              <kbd className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
