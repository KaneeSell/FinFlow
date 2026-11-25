import { useState } from "react";
import { Globe, Laptop, Server, Wallet } from "lucide-react";
import { api, getServerConfig, saveStoredSession, type AuthSession } from "../lib/api";
import { ServerConfigModal } from "../components/ServerConfigModal";

interface AuthPageProps {
  onAuthenticated: (session: AuthSession) => void;
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState(getServerConfig);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === "register"
          ? await api.auth.register({ name, email, password, currency: "BRL" })
          : await api.auth.login({ email, password });

      saveStoredSession(session);
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-8 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">FinFlow</h1>
              <p className="text-xs text-zinc-500">Finanças Pessoais Multiplataforma</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setServerModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Configurar Servidor Local ou Remoto"
          >
            {serverConfig.mode === "remote" ? (
              <Globe className="h-3.5 w-3.5 text-sky-400" />
            ) : (
              <Laptop className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>{serverConfig.mode === "remote" ? "Remoto" : "Local"}</span>
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              mode === "register"
                ? "bg-white text-zinc-900 shadow dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500"
            }`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Seu Nome</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Daniel Silva"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-xl border border-zinc-300 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs text-rose-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading
              ? "Carregando..."
              : mode === "register"
                ? "Criar Conta e Começar"
                : "Entrar no FinFlow"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setServerModalOpen(true)}
          className="mt-5 flex w-full items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <Server className="h-3.5 w-3.5" />
          <span>Apontar para servidor local ou remoto</span>
        </button>
      </div>

      <ServerConfigModal
        open={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        onSaved={() => setServerConfig(getServerConfig())}
      />
    </div>
  );
}
