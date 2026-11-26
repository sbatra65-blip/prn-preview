// LabelDesk for Windows: a window around https://labeldesk.app with desktop comforts
// (remembers its size, opens other sites in the browser, save dialogs, offline page).
const { app, BrowserWindow, shell, session, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const HOME = "https://labeldesk.app/?app=win";
const OURS = new Set(["labeldesk.app", "www.labeldesk.app", "labels.infinitesolutions.co.in"]);
const stateFile = () => path.join(app.getPath("userData"), "window.json");
let win;

function ours(u) { try { const x = new URL(u); return x.protocol === "https:" && OURS.has(x.hostname); } catch { return false; } }
function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch { return { width: 1400, height: 900 }; } }
function saveState() {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch {}
}

function create() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1400, height: st.height || 900, minWidth: 900, minHeight: 600,
    title: "LabelDesk", backgroundColor: "#111827", show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, spellcheck: true }
  });
  if (st.max) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);

  // Other websites (WhatsApp, help pages) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (ours(url) || url === "about:blank") return { action: "allow" };
    if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (ours(url) || url.startsWith("file:")) return;
    e.preventDefault(); if (/^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
  });

  // No internet: show a friendly page with Try again.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMain) => {
    if (isMain && code !== -3 && ours(url)) win.loadFile(path.join(__dirname, "offline.html"));
  });

  win.loadURL(HOME);
}

app.setAppUserModelId("app.labeldesk.desktop");
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    // Camera (picture to label) and microphone (speak a description) only for LabelDesk itself.
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
      const okPerm = ["media", "clipboard-read", "clipboard-sanitized-write", "notifications", "fullscreen", "persistent-storage", "local-network-access", "local-network", "loopback-network"].includes(perm);
      cb(okPerm && ours(details.requestingUrl || wc.getURL()));
    });
    // Ask where to save every file (.ldl, .prn, PDF, PNG).
    session.defaultSession.on("will-download", (_e, item) => {
      item.setSaveDialogOptions({ title: "Save " + item.getFilename(), defaultPath: path.join(app.getPath("downloads"), item.getFilename()) });
    });
    create();
  });
  app.on("window-all-closed", () => app.quit());
}
