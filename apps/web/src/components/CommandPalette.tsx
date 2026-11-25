import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  EyeOff,
  HelpCircle,
  LayoutDashboard,
  Moon,
  Plus,
  Repeat,
  Search,
  Settings,
  Tag,
  Wallet,
} from "lucide-react";

export type AppPage =
  | "dashboard"
  | "transactions"
  | "recurring"
  | "accounts"
  | "categories"
  | "settings";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: AppPage) => void;
  onNewTransaction: () => void;
  onTogglePrivacy: () => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onNewTransaction,
  onTogglePrivacy,
  onToggleTheme,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = [
    {
      id: "new-tx",
      label: "Novo Lançamento",
      hint: "N",
      icon: <Plus className="h-4 w-4 text-emerald-400" />,
      action: onNewTransaction,
    },
    {
      id: "nav-dashboard",
      label: "Ir para Dashboard",
      hint: "G D",
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => onNavigate("dashboard"),
    },
    {
      id: "nav-transactions",
      label: "Ir para Lançamentos",
      hint: "G T",
      icon: <ArrowLeftRight className="h-4 w-4" />,
      action: () => onNavigate("transactions"),
    },
    {
      id: "nav-recurring",
      label: "Ir para Recorrentes",
      hint: "G R",
      icon: <Repeat className="h-4 w-4" />,
      action: () => onNavigate("recurring"),
    },
    {
      id: "nav-accounts",
      label: "Ir para Contas",
      hint: "G A",
      icon: <Wallet className="h-4 w-4" />,
      action: () => onNavigate("accounts"),
    },
    {
      id: "nav-categories",
      label: "Ir para Categorias",
      hint: "G C",
      icon: <Tag className="h-4 w-4" />,
      action: () => onNavigate("categories"),
    },
    {
      id: "nav-settings",
      label: "Ir para Configurações",
      hint: "G S",
      icon: <Settings className="h-4 w-4" />,
      action: () => onNavigate("settings"),
    },
    {
      id: "toggle-privacy",
      label: "Alternar Modo Privacidade",
      hint: "P",
      icon: <EyeOff className="h-4 w-4" />,
      action: onTogglePrivacy,
    },
    {
      id: "toggle-theme",
      label: "Alternar Tema Claro / Escuro",
      icon: <Moon className="h-4 w-4" />,
      action: onToggleTheme,
    },
    {
      id: "shortcuts",
      label: "Ver Atalhos de Teclado",
      hint: "?",
      icon: <HelpCircle className="h-4 w-4" />,
      action: onOpenShortcuts,
    },
  ];

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Paleta de Comandos"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Digite um comando ou página..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Nenhum comando encontrado.</p>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  idx === selectedIndex
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.hint && (
                  <kbd className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500 dark:bg-zinc-800">
                    {item.hint}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
