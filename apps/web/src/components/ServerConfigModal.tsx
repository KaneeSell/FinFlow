import { useState } from "react";
import { CheckCircle2, Globe, Laptop, Loader2, X, XCircle } from "lucide-react";
import {
  getDefaultLocalApiUrl,
  getServerConfig,
  saveServerConfig,
  testServerHealth,
} from "../lib/api";

interface ServerConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ServerConfigModal({ open, onClose, onSaved }: ServerConfigModalProps) {
  const initial = getServerConfig();
  const [mode, setMode] = useState<"local" | "remote">(initial.mode);
  const [remoteUrl, setRemoteUrl] = useState(initial.remoteUrl || "http://192.168.1.100:3333");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!open) return null;

  const targetUrl = mode === "local" ? getDefaultLocalApiUrl() : remoteUrl;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testServerHealth(targetUrl);
    setTesting(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        message: `Conectado com sucesso (v${res.version ?? "0.1.0"} • modo ${res.mode ?? mode})`,
      });
    } else {
      setTestResult({
        ok: false,
        message: `Não foi possível conectar: ${res.error}`,
      });
    }
  };

  const handleSave = () => {
    saveServerConfig({
      mode,
      remoteUrl: mode === "remote" ? remoteUrl.trim() : "",
    });
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Configurar Servidor"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Conexão com Servidor</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("local")}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition ${
              mode === "local"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <Laptop className="h-5 w-5" />
            <span className="font-medium">Modo Local</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("remote")}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition ${
              mode === "remote"
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <Globe className="h-5 w-5" />
            <span className="font-medium">Servidor Remoto</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === "local" ? (
            <div className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
              Usando API local embarcada em:{" "}
              <code className="font-mono text-emerald-500">{getDefaultLocalApiUrl()}</code>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                URL do Servidor Remoto
              </label>
              <input
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="https://fin.seudominio.com"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
          )}

          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${
                testResult.ok
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Testar Conexão
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
