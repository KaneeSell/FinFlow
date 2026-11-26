import { useState } from "react";
import { CheckCircle2, Globe, Laptop, Loader2, X, XCircle } from "lucide-react";
import {
  getDefaultLocalApiUrl,
  getServerConfig,
  saveServerConfig,
  testServerHealth,
} from "../lib/api";

const PRESET_PORTS = [3333, 3000, 5000, 5050, 8000, 8080];

function parseDefaultPort(): number {
  try {
    const url = new URL(getDefaultLocalApiUrl());
    const p = Number(url.port);
    if (Number.isInteger(p) && p >= 1024 && p <= 65535) return p;
  } catch {
    // fallback
  }
  return 3333;
}

interface ServerConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ServerConfigModal({ open, onClose, onSaved }: ServerConfigModalProps) {
  const initial = getServerConfig();
  const [mode, setMode] = useState<"local" | "remote">(initial.mode);
  const [localPort, setLocalPort] = useState<number>(() => initial.localPort ?? parseDefaultPort());
  const [remoteUrl, setRemoteUrl] = useState(initial.remoteUrl || "http://192.168.1.100:3333");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  if (!open) return null;

  const localUrl = `http://127.0.0.1:${localPort}`;
  const targetUrl = mode === "local" ? localUrl : remoteUrl;

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

  const handleSave = async () => {
    if (mode === "local") {
      if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65535) {
        setTestResult({
          ok: false,
          message: "Porta inválida. Informe um número entre 1024 e 65535.",
        });
        return;
      }

      if (window.finflowDesktop?.server?.setPort) {
        setSaving(true);
        setTestResult(null);
        const res = await window.finflowDesktop.server.setPort(localPort);
        setSaving(false);
        if (!res.ok) {
          setTestResult({
            ok: false,
            message: res.error ?? `Não foi possível iniciar o servidor na porta ${localPort}.`,
          });
          return;
        }
      }
    }

    saveServerConfig({
      mode,
      remoteUrl: mode === "remote" ? remoteUrl.trim() : "",
      localPort,
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
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Porta do Servidor Local
                </label>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  aria-label="Porta do Servidor Local"
                  value={localPort}
                  onChange={(e) => setLocalPort(Number.parseInt(e.target.value, 10) || 3333)}
                  className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {PRESET_PORTS.map((port) => (
                    <button
                      key={port}
                      type="button"
                      onClick={() => setLocalPort(port)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        localPort === port
                          ? "bg-emerald-500 text-zinc-950"
                          : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {port}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                Usando API local embarcada em:{" "}
                <code className="font-mono text-emerald-500">{localUrl}</code>
              </div>
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
            disabled={testing || saving}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {testing && <Loader2 className="h-4 w-4 animate-spin" />}
            Testar Conexão
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
