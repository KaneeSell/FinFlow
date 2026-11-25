import { useState } from "react";
import { EyeOff, Keyboard, LogOut, Moon, Server, Sun } from "lucide-react";
import type { UserDTO } from "@finflow/shared";
import { getActiveApiBaseUrl, getServerConfig } from "../lib/api";
import { ServerConfigModal } from "../components/ServerConfigModal";

interface SettingsPageProps {
  user: UserDTO;
  darkMode: boolean;
  onToggleTheme: () => void;
  privacyMode: boolean;
  onTogglePrivacy: () => void;
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

export function SettingsPage({
  user,
  darkMode,
  onToggleTheme,
  privacyMode,
  onTogglePrivacy,
  onOpenShortcuts,
  onLogout,
}: SettingsPageProps) {
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState(getServerConfig);

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
