import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Loader2,
  Network,
  RefreshCw,
  RotateCw,
  Save,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import type { ServerAdminConfig, ServerLogLevel, ServerStatusDTO } from "@finflow/shared";
import { api, getServerConfig, saveServerConfig, testServerHealth } from "../lib/api";

const PRESET_PORTS = [3333, 3000, 5000, 5050, 8000, 8080];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function ServerAdminPage() {
  const [status, setStatus] = useState<ServerStatusDTO | null>(null);
  const [config, setConfig] = useState<ServerAdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [portCheck, setPortCheck] = useState<{
    checkedPort: number;
    available: boolean;
    inUseByFinFlow: boolean;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, cfg] = await Promise.all([api.server.getStatus(), api.server.getConfig()]);
      setStatus(st);
      setConfig(cfg);
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao carregar painel do servidor.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCheckPort = async () => {
    if (!config) return;
    setBusyAction("check-port");
    try {
      const res = await api.server.checkPort(config.port);
      setPortCheck({
        checkedPort: res.port,
        available: res.available,
        inUseByFinFlow: res.inUseByFinFlow,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Falha ao testar porta.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setFeedback(null);
    try {
      const prevPort = status?.port ?? config.port;
      const prevHost = status?.host ?? config.host;
      const currentClientCfg = getServerConfig();

      if (
        currentClientCfg.mode === "local" &&
        window.finflowDesktop?.server &&
        (config.port !== prevPort || config.host !== prevHost)
      ) {
        const ipcRes = window.finflowDesktop.server.setNetwork
          ? await window.finflowDesktop.server.setNetwork(config.port, config.host)
          : await window.finflowDesktop.server.setPort(config.port);

        if (!ipcRes.ok) {
          setFeedback({
            ok: false,
            text: ipcRes.error ?? "Falha ao aplicar nova porta no Desktop.",
          });
          setSaving(false);
          return;
        }
      }

      const saved = await api.server.updateConfig(config);

      if (saved.restarting && currentClientCfg.mode === "local") {
        const nextUrl = `http://127.0.0.1:${config.port}`;
        const startedAt = Date.now();
        while (Date.now() - startedAt < 6000) {
          const health = await testServerHealth(nextUrl);
          if (health.ok) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (currentClientCfg.mode === "local") {
        saveServerConfig({
          mode: "local",
          remoteUrl: "",
          localPort: config.port,
        });
      }

      setFeedback({
        ok: true,
        text: saved.restarting
          ? `Configurações salvas e servidor reiniciado na porta ${config.port}!`
          : "Configurações do servidor salvas com sucesso!",
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao salvar configurações do servidor.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVacuum = async () => {
    setBusyAction("vacuum");
    setFeedback(null);
    try {
      const res = await api.server.vacuum();
      setFeedback({
        ok: true,
        text: `Banco otimizado (VACUUM): ${formatBytes(res.beforeBytes)} → ${formatBytes(res.afterBytes)}.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao otimizar banco.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleBackup = async () => {
    setBusyAction("backup");
    setFeedback(null);
    try {
      const res = await api.server.createBackup();
      setFeedback({
        ok: true,
        text: `Backup criado: ${res.backup.name} (${formatBytes(res.backup.sizeBytes)}).`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao criar backup.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevokeExpired = async () => {
    setBusyAction("sessions");
    setFeedback(null);
    try {
      const res = await api.server.revokeExpiredSessions();
      setFeedback({
        ok: true,
        text: `Sessões expiradas/revogadas removidas: ${res.deleted}.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao limpar sessões.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestart = async () => {
    setBusyAction("restart");
    setFeedback(null);
    try {
      const res = await api.server.restart();
      if (res.restarting && status) {
        const targetUrl = `http://127.0.0.1:${status.port}`;
        const startedAt = Date.now();
        while (Date.now() - startedAt < 5000) {
          const health = await testServerHealth(targetUrl);
          if (health.ok) break;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      setFeedback({
        ok: true,
        text: res.restarting
          ? "Servidor reiniciado com sucesso!"
          : "Servidor gerenciado externamente (reinício manual necessário).",
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        ok: false,
        text: err instanceof Error ? err.message : "Erro ao reiniciar servidor.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando painel do servidor...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel do Servidor</h1>
          <p className="text-xs text-zinc-500">
            Telemetria, porta de rede, segurança JWT/CORS, manutenção SQLite e backups
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void handleRestart()}
            disabled={busyAction === "restart"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${busyAction === "restart" ? "animate-spin" : ""}`} />
            Reiniciar Servidor
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${
            feedback.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-rose-500/30 bg-rose-500/10 text-rose-400"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Telemetry Cards */}
      {status && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Status & Modo</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-lg font-bold text-emerald-500">Online · :{status.port}</p>
            <p className="text-[11px] text-zinc-500">
              Modo {status.mode} · PID {status.pid}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Uptime & Runtime</span>
              <Network className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-2 text-lg font-bold">{formatUptime(status.uptimeSeconds)}</p>
            <p className="text-[11px] text-zinc-500">
              Node {status.nodeVersion} · {status.platform}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Memória (RSS / Heap)</span>
              <HardDrive className="h-4 w-4 text-purple-400" />
            </div>
            <p className="mt-2 text-lg font-bold">{status.memoryRssMb} MB</p>
            <p className="text-[11px] text-zinc-500">Heap em uso: {status.memoryHeapMb} MB</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Banco SQLite</span>
              <Database className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-lg font-bold">{formatBytes(status.dbSizeBytes)}</p>
            <p className="text-[11px] text-zinc-500">
              {status.counts.users} usuários · {status.counts.transactions} lançamentos
            </p>
          </div>
        </div>
      )}

      {/* LAN Access URLs */}
      {status && status.lanUrls.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Endereços na Rede Local (Android / Outros PCs)</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Use um destes endereços na tela de Servidor Remoto do celular (com Host em{" "}
            <code>0.0.0.0</code>).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {status.lanUrls.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(url);
                  setCopiedUrl(url);
                  setTimeout(() => setCopiedUrl(null), 2000);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-1.5 font-mono text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800"
              >
                <span>{url}</span>
                <Copy className="h-3.5 w-3.5 text-emerald-500" />
                {copiedUrl === url && <span className="text-[10px] text-emerald-400">Copiado!</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Network & Port Settings */}
      {config && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-semibold">Rede & Porta do Servidor</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Porta de Execução (1024 - 65535)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  aria-label="Porta do Servidor"
                  value={config.port}
                  onChange={(e) => {
                    setPortCheck(null);
                    setConfig({
                      ...config,
                      port: Number.parseInt(e.target.value, 10) || 3333,
                    });
                  }}
                  className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => void handleCheckPort()}
                  disabled={busyAction === "check-port"}
                  className="shrink-0 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {busyAction === "check-port" ? "Testando..." : "Testar Porta"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESET_PORTS.map((port) => (
                  <button
                    key={port}
                    type="button"
                    onClick={() => {
                      setPortCheck(null);
                      setConfig({ ...config, port });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      config.port === port
                        ? "bg-emerald-500 text-zinc-950"
                        : "border border-zinc-300 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {port}
                  </button>
                ))}
              </div>
              {portCheck && (
                <p
                  className={`mt-2 text-xs ${
                    portCheck.available ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {portCheck.inUseByFinFlow
                    ? `Porta ${portCheck.checkedPort} já está em uso pelo próprio FinFlow.`
                    : portCheck.available
                      ? `Porta ${portCheck.checkedPort} está livre e disponível.`
                      : `Porta ${portCheck.checkedPort} está ocupada por outro aplicativo.`}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Interface de Rede (Bind Host)
              </label>
              <select
                aria-label="Interface de Rede"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="0.0.0.0">0.0.0.0 (Rede Local / LAN + Localhost)</option>
                <option value="127.0.0.1">127.0.0.1 (Somente este computador)</option>
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Use <code>0.0.0.0</code> para acessar pelo celular Android na mesma rede Wi-Fi.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                URL Pública Externa (Opcional)
              </label>
              <input
                type="url"
                value={config.publicUrl}
                onChange={(e) => setConfig({ ...config, publicUrl: e.target.value })}
                placeholder="https://fin.seudominio.com"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Origens CORS Permitidas (* ou separadas por vírgula)
              </label>
              <input
                type="text"
                value={config.corsOrigin}
                onChange={(e) => setConfig({ ...config, corsOrigin: e.target.value })}
                placeholder="*"
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Security & Auth */}
      {config && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-400" />
              <h2 className="text-sm font-semibold">Segurança, Autenticação & API</h2>
            </div>
            <button
              type="button"
              onClick={() => void handleRevokeExpired()}
              disabled={busyAction === "sessions"}
              className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Limpar Sessões Expiradas ({status?.counts.activeSessions ?? 0} ativas)
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Rate Limit (req / min)
              </label>
              <input
                type="number"
                min={30}
                max={5000}
                value={config.rateLimitMax}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rateLimitMax: Number.parseInt(e.target.value, 10) || 300,
                  })
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Access Token TTL (minutos)
              </label>
              <input
                type="number"
                min={5}
                max={1440}
                value={config.accessTokenTtlMinutes}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    accessTokenTtlMinutes: Number.parseInt(e.target.value, 10) || 15,
                  })
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Refresh Token TTL (dias)
              </label>
              <input
                type="number"
                min={1}
                max={90}
                value={config.refreshTokenTtlDays}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    refreshTokenTtlDays: Number.parseInt(e.target.value, 10) || 7,
                  })
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div>
                <p className="text-xs font-medium">Permitir Novos Cadastros</p>
                <p className="text-[11px] text-zinc-500">
                  Desative após criar sua conta em servidor público
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, allowRegistration: !config.allowRegistration })
                }
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  config.allowRegistration
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {config.allowRegistration ? "Permitido" : "Bloqueado"}
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div>
                <p className="text-xs font-medium">Documentação Swagger (/docs)</p>
                <p className="text-[11px] text-zinc-500">
                  Expor interface interativa OpenAPI no servidor
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, enableSwagger: !config.enableSwagger })}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  config.enableSwagger
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {config.enableSwagger ? "Ativado" : "Desativado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database, Logs & Backups */}
      {config && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-400" />
              <h2 className="text-sm font-semibold">Banco de Dados, Logs & Backups</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleVacuum()}
                disabled={busyAction === "vacuum"}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                {busyAction === "vacuum" ? "Otimizando..." : "Otimizar Banco (VACUUM)"}
              </button>
              <button
                type="button"
                onClick={() => void handleBackup()}
                disabled={busyAction === "backup"}
                className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25"
              >
                {busyAction === "backup" ? "Gerando..." : "Criar Backup Agora"}
              </button>
            </div>
          </div>

          {status && (
            <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
              <p>
                Caminho do SQLite: <code className="font-mono text-zinc-300">{status.dbPath}</code>
              </p>
              <p className="mt-1">
                Registros: {status.counts.accounts} contas · {status.counts.categories} categorias ·{" "}
                {status.counts.transactions} lançamentos · {status.counts.recurringRules}{" "}
                recorrências
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Nível de Logs</label>
              <select
                value={config.logLevel}
                onChange={(e) =>
                  setConfig({ ...config, logLevel: e.target.value as ServerLogLevel })
                }
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                Retenção de Backups (arquivos)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.autoBackupRetention}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    autoBackupRetention: Number.parseInt(e.target.value, 10) || 7,
                  })
                }
                className="w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setConfig({ ...config, autoBackupEnabled: !config.autoBackupEnabled })
                }
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold ${
                  config.autoBackupEnabled
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                Backup Automático: {config.autoBackupEnabled ? "Ativo" : "Inativo"}
              </button>
            </div>
          </div>

          {status && status.backups.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-zinc-400">Backups recentes em disco</p>
              {status.backups.slice(0, 5).map((b) => (
                <div
                  key={b.name}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50"
                >
                  <span className="font-mono">{b.name}</span>
                  <span className="text-zinc-500">{formatBytes(b.sizeBytes)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Footer */}
      {config && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveConfig()}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Aplicando..." : "Salvar e Aplicar Configurações"}
          </button>
        </div>
      )}
    </div>
  );
}
