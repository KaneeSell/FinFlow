import { useState } from "react";
import {
  Bell,
  CloudUpload,
  EyeOff,
  Keyboard,
  Lock,
  LogOut,
  Moon,
  Server,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import type { UserDTO, WebhookConfigDTO, WebhookProvider } from "@finflow/shared";
import { api, getActiveApiBaseUrl, getServerConfig } from "../lib/api";
import { flushOfflineOutbox, getOfflineOutbox } from "../lib/offline-sync";
import { ServerConfigModal } from "../components/ServerConfigModal";

interface SettingsPageProps {
  user: UserDTO;
  webhooks?: WebhookConfigDTO[];
  darkMode: boolean;
  onToggleTheme: () => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
  onRefresh?: () => void;
}

export function SettingsPage({
  user,
  webhooks = [],
  darkMode,
  onToggleTheme,
  privacyMode,
  onTogglePrivacy,
  onOpenShortcuts,
  onLogout,
  onRefresh,
}: SettingsPageProps) {
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState(getServerConfig);
  const [outboxCount, setOutboxCount] = useState(() => getOfflineOutbox().length);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [secMsg, setSecMsg] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [backupPass, setBackupPass] = useState("");
  const [hookName, setHookName] = useState("");
  const [hookProvider, setHookProvider] = useState<WebhookProvider>("DISCORD");
  const [hookUrl, setHookUrl] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-xs text-zinc-500">Servidor, aparência, privacidade e conta</p>
      </div>

      {/* Server Config */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold">Conexão com API / Banco de Dados</h2>
              <p className="text-xs text-zinc-500">
                Modo atual: <strong>{serverConfig.mode === "remote" ? "Servidor Remoto" : "Local"}</strong>{" "}
                ({getActiveApiBaseUrl()})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setServerModalOpen(true)}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Configurar Servidor
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="h-5 w-5 text-sky-400" /> : <Sun className="h-5 w-5 text-amber-400" />}
            <div>
              <p className="text-sm font-medium">Tema da Interface</p>
              <p className="text-xs text-zinc-500">{darkMode ? "Modo Escuro" : "Modo Claro"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
          >
            Alternar
          </button>
        </div>

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <EyeOff className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium">Modo Privacidade (Atalho: P)</p>
              <p className="text-xs text-zinc-500">Oculta valores monetários na tela</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTogglePrivacy}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              privacyMode
                ? "bg-emerald-500 text-zinc-950"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {privacyMode ? "Ativado" : "Desativado"}
          </button>
        </div>

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-sm font-medium">Atalhos de Teclado</p>
              <p className="text-xs text-zinc-500">Pressione ? ou Ctrl+K em qualquer tela</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
          >
            Ver Atalhos
          </button>
        </div>
      </div>

      {/* Offline-First Sync */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CloudUpload className="h-5 w-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold">Sincronização Offline-First</h2>
              <p className="text-xs text-zinc-500">
                Mutações pendentes na fila local: <strong>{outboxCount}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await flushOfflineOutbox();
              setOutboxCount(getOfflineOutbox().length);
              setSyncMsg(`Sincronizados: ${res.applied} • Duplicados: ${res.duplicates}`);
              onRefresh?.();
            }}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold dark:border-zinc-700"
          >
            Sincronizar Agora
          </button>
        </div>
        {syncMsg && <p className="mt-2 text-xs text-emerald-400">{syncMsg}</p>}
      </div>

      {/* Security: 2FA, PIN & Encrypted Backup */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-sm font-semibold">Segurança Avançada & Backup AES-256</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const res = await api.security.setup2fa();
              setTotpSecret(res.secret);
              setSecMsg("Escaneie ou insira a chave secreta no seu autenticador.");
            }}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700"
          >
            Configurar 2FA (TOTP)
          </button>

          {totpSecret && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-emerald-400">
                {totpSecret}
              </code>
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="Código 6 dígitos"
                className="w-32 rounded-xl border border-zinc-700 bg-transparent px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.security.enable2fa(totpCode);
                    setSecMsg("2FA ativado com sucesso!");
                    setTotpSecret(null);
                  } catch (err) {
                    setSecMsg(err instanceof Error ? err.message : "Código inválido");
                  }
                }}
                className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
              >
                Ativar 2FA
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Lock className="h-4 w-4 text-zinc-400" />
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Novo PIN (4-8 dígitos)"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-1.5 text-xs dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={async () => {
              if (!pinInput) return;
              await api.security.setPin(pinInput);
              setPinInput("");
              setSecMsg("PIN configurado com sucesso!");
            }}
            className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
          >
            Salvar PIN
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={backupPass}
            onChange={(e) => setBackupPass(e.target.value)}
            placeholder="Senha do backup criptografado"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-1.5 text-xs dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={async () => {
              if (backupPass.length < 6) {
                setSecMsg("Use uma senha de ao menos 6 caracteres para o backup.");
                return;
              }
              const payload = await api.security.exportEncryptedBackup(backupPass);
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "finflow-backup-encrypted.json";
              a.click();
              URL.revokeObjectURL(url);
              setSecMsg("Backup criptografado AES-256 exportado!");
            }}
            className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400"
          >
            Exportar Backup AES-256
          </button>
        </div>

        {secMsg && <p className="text-xs text-emerald-400">{secMsg}</p>}
      </div>

      {/* Webhooks */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold">Webhooks & Alertas (Discord / Telegram / ntfy)</h2>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!hookName.trim() || !hookUrl.trim()) return;
            await api.webhooks.create({
              name: hookName.trim(),
              provider: hookProvider,
              url: hookUrl.trim(),
              events: ["RECURRING_DUE", "BUDGET_ALERT"],
            });
            setHookName("");
            setHookUrl("");
            onRefresh?.();
          }}
          className="grid grid-cols-1 gap-2 sm:grid-cols-4"
        >
          <input
            required
            value={hookName}
            onChange={(e) => setHookName(e.target.value)}
            placeholder="Nome (ex: Meu Discord)"
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
          <select
            value={hookProvider}
            onChange={(e) => setHookProvider(e.target.value as WebhookProvider)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="DISCORD">Discord</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="NTFY">ntfy</option>
            <option value="GENERIC">Genérico</option>
          </select>
          <input
            required
            type="url"
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://..."
            className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-xs dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950"
          >
            Adicionar Webhook
          </button>
        </form>

        {webhooks.map((w) => (
          <div
            key={w.id}
            className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/50"
          >
            <span>
              <strong>{w.name}</strong> ({w.provider})
            </span>
            <button
              type="button"
              onClick={async () => {
                await api.webhooks.remove(w.id);
                onRefresh?.();
              }}
              className="text-zinc-400 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* User & Logout */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-zinc-500">{user.email}</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-xl bg-rose-500/15 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/25"
        >
          <LogOut className="h-4 w-4" />
          Sair da Conta
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
