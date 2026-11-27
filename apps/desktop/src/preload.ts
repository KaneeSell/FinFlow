import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("finflowDesktop", {
  isElectron: true,
  defaultApiUrl: process.env.FINFLOW_LOCAL_API_URL ?? "http://127.0.0.1:3333",
  appVersion: process.env.FINFLOW_APP_VERSION ?? "1.0.0",
  server: {
    getPort: () => ipcRenderer.invoke("finflow:server:get-port"),
    checkPort: (port: number) => ipcRenderer.invoke("finflow:server:check-port", port),
    setPort: (port: number) => ipcRenderer.invoke("finflow:server:set-port", port),
    setNetwork: (port: number, host: string) =>
      ipcRenderer.invoke("finflow:server:set-network", port, host),
  },
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
