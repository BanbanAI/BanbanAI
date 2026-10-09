import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("runtimeInfo", {
  inClient: true,
});
contextBridge.exposeInMainWorld("hide", () => ipcRenderer.send("hide-window"));
