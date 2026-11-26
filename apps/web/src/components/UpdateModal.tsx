import { useEffect } from "react";
import { Download, ExternalLink, Sparkles, X } from "lucide-react";
import type { UpdateCheckResult } from "@finflow/shared";

interface UpdateModalProps {
  open: boolean;
  info: UpdateCheckResult | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export function UpdateModal({
  open,
  info,
  downloading,
  progress,
  error,
  onAccept,
  onDismiss,
}: UpdateModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !downloading) {
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, downloading, onDismiss]);

  if (!open || !info) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atualização Disponível"
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Nova versão disponível</h2>
              <p className="text-xs text-zinc-500">
                v{info.currentVersion} &rarr; <strong className="text-emerald-500">v{info.latestVersion}</strong>
              </p>
            </div>
          </div>
          {!downloading && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar"
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">
          Deseja atualizar o <strong>FinFlow</strong> para a versão <strong>v{info.latestVersion}</strong> agora?
        </p>

        {info.releaseNotes && (
          <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            {info.releaseNotes}
          </div>
        )}

        {downloading && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Baixando atualização...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <p>{error}</p>
            <a
              href={info.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 underline"
            >
              Abrir página da release <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={downloading}
            onClick={onDismiss}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Agora não
          </button>
          <button
            type="button"
            disabled={downloading}
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Baixando..." : "Atualizar Agora"}
          </button>
        </div>
      </div>
    </div>
  );
}
