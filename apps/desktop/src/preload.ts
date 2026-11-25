import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("finflowDesktop", {
  isElectron: true,
  defaultApiUrl: process.env.FINFLOW_LOCAL_API_URL ?? "http://127.0.0.1:3333",
});
