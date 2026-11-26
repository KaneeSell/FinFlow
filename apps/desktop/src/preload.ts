import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("finflowDesktop", {
  isElectron: true,
  defaultApiUrl: process.env.FINFLOW_LOCAL_API_URL ?? "http://127.0.0.1:3333",
  appVersion: process.env.FINFLOW_APP_VERSION ?? "1.0.0",
  updates: {
    checkForUpdates: () => ipcRenderer.invoke("finflow:updates:check"),
    downloadAndInstall: (downloadUrl: string) =>
      ipcRenderer.invoke("finflow:updates:install", downloadUrl),
    openReleasePage: (url: string) =>
      ipcRenderer.invoke("finflow:updates:open-release", url),
    onUpdateStatus: (callback: (payload: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
      ipcRenderer.on("finflow:updates:status", listener);
      return () => ipcRenderer.removeListener("finflow:updates:status", listener);
    },
  },
});
