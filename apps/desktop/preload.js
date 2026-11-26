// Lets the page know it runs inside the Windows app.
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("ldNative", { platform: "windows", app: "desktop", version: "1.0.0" });
