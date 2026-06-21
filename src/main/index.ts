import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
  nativeTheme,
} from "electron";
import { join } from "path";
import { scanLibrary } from "./scanner";
import {
  initDatabase,
  getSongRating,
  saveSongRating,
  getAlbumRating,
  saveAlbumRating,
  recordPlay,
  getRecentlyPlayed,
} from "./database";
import { readFileSync, existsSync, writeFileSync } from "fs";

// ── WebGL2 / GPU flags — must be before app.whenReady() ──────────────────────
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-webgl");
app.commandLine.appendSwitch("enable-webgl2");
app.commandLine.appendSwitch("disable-gpu-driver-bug-workarounds");
app.commandLine.appendSwitch(
  "enable-features",
  "WebGL2ComputeContext,Vulkan,UseSkiaRenderer",
);
app.commandLine.appendSwitch("use-angle", "default");

let mainWindow: BrowserWindow | null = null;

// ── Window state persistence ─────────────────────────────────────────────────
interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

function getWindowStatePath() {
  return join(app.getPath("userData"), "window-state.json");
}

function loadWindowState(): WindowState {
  try {
    const p = getWindowStatePath();
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    /* fall through */
  }
  return { width: 1280, height: 800, maximized: true };
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const maximized = win.isMaximized();
    const bounds = win.getNormalBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized,
    };
    writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
  } catch {
    /* ignore */
  }
}

// ── Create window ─────────────────────────────────────────────────────────────
function createWindow(): void {
  nativeTheme.themeSource = "dark";
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 240,
    minHeight: 240,
    backgroundColor: "#0a0a0a",
    frame: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // Force GPU-accelerated rendering for WebGL2
      offscreen: false,
    },
    show: false,
    icon: join(__dirname, "../../resources/icon.ico"),
  });

  if (state.maximized) mainWindow.maximize();
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow) saveWindowState(mainWindow);
    }, 500);
  };
  mainWindow.on("resize", debouncedSave);
  mainWindow.on("move", debouncedSave);
  mainWindow.on("close", () => {
    if (mainWindow) saveWindowState(mainWindow);
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function registerMediaKeys(): void {
  globalShortcut.register("MediaPlayPause", () =>
    mainWindow?.webContents.send("media-play-pause"),
  );
  globalShortcut.register("MediaNextTrack", () =>
    mainWindow?.webContents.send("media-next"),
  );
  globalShortcut.register("MediaPreviousTrack", () =>
    mainWindow?.webContents.send("media-prev"),
  );
}

function registerIpcHandlers(): void {
  ipcMain.handle("scan-library", async (_event, musicPath: string) => {
    try {
      const library = await scanLibrary(musicPath);
      return { success: true, data: library };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("get-cover-art", async (_event, coverPath: string) => {
    try {
      if (!coverPath || !existsSync(coverPath)) return null;
      const ext = coverPath.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      };
      const data = readFileSync(coverPath);
      return `data:${mimeMap[ext] ?? "image/jpeg"};base64,${data.toString("base64")}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle("get-song-rating", (_e, id: string) => getSongRating(id));
  ipcMain.handle("save-song-rating", (_e, id: string, r: number, rev: string) =>
    saveSongRating(id, r, rev),
  );
  ipcMain.handle("get-album-rating", (_e, id: string) => getAlbumRating(id));
  ipcMain.handle(
    "save-album-rating",
    (_e, id: string, r: number, rev: string) => saveAlbumRating(id, r, rev),
  );
  ipcMain.handle("record-play", (_e, id: string) => recordPlay(id));
  ipcMain.handle("get-recently-played", (_e, limit: number) =>
    getRecentlyPlayed(limit),
  );

  ipcMain.handle("window-minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window-toggle-maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });

  ipcMain.handle("window-close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("maximize-from-mini", () => {
    if (!mainWindow) return;
    mainWindow.maximize();
    mainWindow.focus();
  });

  ipcMain.handle("set-player-fullscreen", (_event, enabled: boolean) => {
    if (!mainWindow) return;
    mainWindow.setFullScreen(enabled);
  });

  ipcMain.handle("open-music-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
      title: "Select your Music folder",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  const settingsPath = join(app.getPath("userData"), "settings.json");
  const defaultSettings = {
    musicPath: "C:\\Users\\Vasudev\\Music",
    volume: 0.8,
    theme: "dark",
    accentColor: "#c8a96e",
    fontSize: 14,
  };

  ipcMain.handle("get-settings", () => {
    try {
      if (existsSync(settingsPath)) {
        const saved = JSON.parse(readFileSync(settingsPath, "utf8"));
        return { ...defaultSettings, ...saved };
      }
    } catch {
      /* fall through */
    }
    return defaultSettings;
  });

  ipcMain.handle("save-settings", (_event, settings: any) => {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  });
}

app.whenReady().then(async () => {
  initDatabase();
  registerIpcHandlers();
  createWindow();
  registerMediaKeys();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});
