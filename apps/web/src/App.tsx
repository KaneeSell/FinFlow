import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Command,
  Eye,
  EyeOff,
  LayoutDashboard,
  Plus,
  Repeat,
  Settings,
  Tag,
  Wallet,
} from "lucide-react";
import type {
  AccountDTO,
  CategoryDTO,
  DashboardSummaryDTO,
  RecurringRuleDTO,
  TransactionDTO,
} from "@finflow/shared";
import { CommandPalette, type AppPage } from "./components/CommandPalette";
import { RecurringModal } from "./components/RecurringModal";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { TransactionModal } from "./components/TransactionModal";
import { api, getStoredSession, saveStoredSession, type AuthSession } from "./lib/api";
import { AccountsPage } from "./pages/AccountsPage";
import { AuthPage } from "./pages/AuthPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RecurringPage } from "./pages/RecurringPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TransactionsPage } from "./pages/TransactionsPage";

const NAV_ITEMS: Array<{ id: AppPage; label: string; shortcut: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Dashboard", shortcut: "G D", icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: "transactions", label: "Lançamentos", shortcut: "G T", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { id: "recurring", label: "Recorrentes", shortcut: "G R", icon: <Repeat className="h-4 w-4" /> },
  { id: "accounts", label: "Contas", shortcut: "G A", icon: <Wallet className="h-4 w-4" /> },
  { id: "categories", label: "Categorias", shortcut: "G C", icon: <Tag className="h-4 w-4" /> },
  { id: "settings", label: "Configurações", shortcut: "G S", icon: <Settings className="h-4 w-4" /> },
];

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession());
  const [page, setPage] = useState<AppPage>("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");

  const [summary, setSummary] = useState<DashboardSummaryDTO | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRuleDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionDTO | null>(null);
  const [recModalOpen, setRecModalOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<RecurringRuleDTO | null>(null);

  const pendingGoKey = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const loadAllData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [sum, accs, cats, txs, recs] = await Promise.all([
        api.dashboard.summary(month),
        api.accounts.list(),
        api.categories.list(),
        api.transactions.list({
          month,
          search: txSearch || undefined,
          type: txTypeFilter || undefined,
        }),
        api.recurring.list(),
      ]);
      setSummary(sum);
      setAccounts(accs);
      setCategories(cats);
      setTransactions(txs);
      setRecurringRules(recs);
    } catch {
      // handled by auth/401 or UI
    } finally {
      setLoading(false);
    }
  }, [session, month, txSearch, txTypeFilter]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  // Keyboard First global shortcuts
  useEffect(() => {
    if (!session) return;

    const isInputFocused = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setPaletteOpen(false);
        setShortcutsOpen(false);
        setTxModalOpen(false);
        setRecModalOpen(false);
        return;
      }

      if (isInputFocused(e.target) || paletteOpen || txModalOpen || recModalOpen || shortcutsOpen) {
        return;
      }

      const key = e.key.toLowerCase();

      if (pendingGoKey.current) {
        pendingGoKey.current = false;
        const goMap: Record<string, AppPage> = {
          d: "dashboard",
          t: "transactions",
          r: "recurring",
          a: "accounts",
          c: "categories",
          s: "settings",
        };
        if (goMap[key]) {
          e.preventDefault();
          setPage(goMap[key]);
        }
        return;
      }

      if (key === "g") {
        pendingGoKey.current = true;
        setTimeout(() => {
          pendingGoKey.current = false;
        }, 1200);
        return;
      }

      if (key === "n") {
        e.preventDefault();
        setEditingTx(null);
        setTxModalOpen(true);
      } else if (key === "p") {
        e.preventDefault();
        setPrivacyMode((prev) => !prev);
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [session, paletteOpen, txModalOpen, recModalOpen, shortcutsOpen]);

  const handleLogout = async () => {
    try {
      await api.auth.logout(session?.refreshToken);
    } catch {
      // ignore network error on logout
    }
    saveStoredSession(null);
    setSession(null);
  };

  if (!session) {
    return <AuthPage onAuthenticated={(newSession) => setSession(newSession)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-20 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:flex md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60 md:flex">
        <div>
          <div className="mb-6 flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950">
                <Wallet className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight">FinFlow</span>
            </div>
            <button
              type="button"
              onClick={() => setPrivacyMode((p) => !p)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Modo Privacidade (P)"
            >
              {privacyMode ? <EyeOff className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="mb-4 flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <span className="flex items-center gap-2">
              <Command className="h-3.5 w-3.5" />
              Comandos...
            </span>
            <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">
              Ctrl+K
            </kbd>
          </button>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  page === item.id
                    ? "bg-emerald-500/15 text-emerald-500"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
                }`}
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  {item.label}
                </span>
                <kbd className="text-[10px] text-zinc-400 opacity-70">{item.shortcut}</kbd>
              </button>
            ))}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <span>Atalhos de Teclado</span>
          <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 dark:bg-zinc-800">?</kbd>
        </button>
      </aside>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-bold">FinFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrivacyMode((p) => !p)}
            className="rounded-lg p-2 text-zinc-400"
            aria-label="Alternar privacidade"
          >
            {privacyMode ? <EyeOff className="h-4 w-4 text-amber-400" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setPage("accounts")}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800"
          >
            Contas
          </button>
          <button
            type="button"
            onClick={() => setPage("categories")}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800"
          >
            Categ.
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
        {page === "dashboard" && (
          <DashboardPage
            summary={summary}
            loading={loading}
            month={month}
            onMonthChange={setMonth}
            privacyMode={privacyMode}
            onNewTransaction={() => {
              setEditingTx(null);
              setTxModalOpen(true);
            }}
            onMaterializeRecurring={async (id) => {
              await api.recurring.materialize(id, "PAID");
              void loadAllData();
            }}
            onGoToTransactions={() => setPage("transactions")}
          />
        )}

        {page === "transactions" && (
          <TransactionsPage
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            month={month}
            onMonthChange={setMonth}
            search={txSearch}
            onSearchChange={setTxSearch}
            typeFilter={txTypeFilter}
            onTypeFilterChange={setTxTypeFilter}
            privacyMode={privacyMode}
            onNew={() => {
              setEditingTx(null);
              setTxModalOpen(true);
            }}
            onEdit={(tx) => {
              setEditingTx(tx);
              setTxModalOpen(true);
            }}
            onToggleStatus={async (id) => {
              await api.transactions.toggleStatus(id);
              void loadAllData();
            }}
            onDelete={async (id) => {
              await api.transactions.remove(id);
              void loadAllData();
            }}
          />
        )}

        {page === "recurring" && (
          <RecurringPage
            rules={recurringRules}
            privacyMode={privacyMode}
            onNew={() => {
              setEditingRec(null);
              setRecModalOpen(true);
            }}
            onEdit={(rule) => {
              setEditingRec(rule);
              setRecModalOpen(true);
            }}
            onMaterialize={async (id) => {
              await api.recurring.materialize(id, "PAID");
              void loadAllData();
            }}
            onProcessDue={async () => {
              await api.recurring.processDue();
              void loadAllData();
            }}
            onToggleActive={async (rule) => {
              await api.recurring.update(rule.id, { isActive: !rule.isActive });
              void loadAllData();
            }}
            onDelete={async (id) => {
              await api.recurring.remove(id);
              void loadAllData();
            }}
          />
        )}

        {page === "accounts" && (
          <AccountsPage
            accounts={accounts}
            privacyMode={privacyMode}
            onRefresh={() => void loadAllData()}
          />
        )}

        {page === "categories" && (
          <CategoriesPage categories={categories} onRefresh={() => void loadAllData()} />
        )}

        {page === "settings" && (
          <SettingsPage
            user={session.user}
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode((d) => !d)}
            privacyMode={privacyMode}
            onTogglePrivacy={() => setPrivacyMode((p) => !p)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegação Mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-zinc-200 bg-white/95 px-2 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden"
      >
        <button
          type="button"
          onClick={() => setPage("dashboard")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            page === "dashboard" ? "text-emerald-500" : "text-zinc-500"
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span>Início</span>
        </button>

        <button
          type="button"
          onClick={() => setPage("transactions")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            page === "transactions" ? "text-emerald-500" : "text-zinc-500"
          }`}
        >
          <ArrowLeftRight className="h-5 w-5" />
          <span>Extrato</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEditingTx(null);
            setTxModalOpen(true);
          }}
          className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/30"
          aria-label="Novo Lançamento"
        >
          <Plus className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={() => setPage("recurring")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            page === "recurring" ? "text-emerald-500" : "text-zinc-500"
          }`}
        >
          <Repeat className="h-5 w-5" />
          <span>Fixos</span>
        </button>

        <button
          type="button"
          onClick={() => setPage("settings")}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            page === "settings" ? "text-emerald-500" : "text-zinc-500"
          }`}
        >
          <Settings className="h-5 w-5" />
          <span>Ajustes</span>
        </button>
      </nav>

      {/* Modals */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setPage}
        onNewTransaction={() => {
          setEditingTx(null);
          setTxModalOpen(true);
        }}
        onTogglePrivacy={() => setPrivacyMode((p) => !p)}
        onToggleTheme={() => setDarkMode((d) => !d)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <TransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSaved={() => void loadAllData()}
        accounts={accounts}
        categories={categories}
        editing={editingTx}
      />

      <RecurringModal
        open={recModalOpen}
        onClose={() => setRecModalOpen(false)}
        onSaved={() => void loadAllData()}
        accounts={accounts}
        categories={categories}
        editing={editingRec}
      />
    </div>
  );
}
