import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
  nativeTheme,
  protocol,
} from "electron";
import { extname, join } from "path";
import { saveLibraryImage, scanLibrary, undoLastOrganize } from "./scanner";
import {
  initDatabase,
  getSongRating,
  saveSongRating,
  getAlbumRating,
  saveAlbumRating,
  recordPlay,
  getRecentlyPlayed,
} from "./database";
import { createReadStream, readFileSync, existsSync, statSync, writeFileSync } from "fs";

interface LyricsRequest {
  artistName: string;
  trackName: string;
  albumName?: string;
  duration: number;
}

interface LrclibResponse {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

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

protocol.registerSchemesAsPrivileged([
  {
    scheme: "muze-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
const MEDIA_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".alac",
  ".m4a",
  ".aac",
  ".ogg",
  ".wma",
  ".aiff",
  ".ape",
  ".opus",
]);
const MEDIA_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".alac": "audio/mp4",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".wma": "audio/x-ms-wma",
  ".aiff": "audio/aiff",
  ".ape": "audio/ape",
  ".opus": "audio/opus",
};
const MEDIA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

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
  const organizeLogPath = join(app.getPath("userData"), "last-organize.json");

  ipcMain.handle("scan-library", async (_event, musicPath: string, options?: { organize?: boolean }) => {
    try {
      const library = await scanLibrary(musicPath, organizeLogPath, options?.organize !== false);
      return { success: true, data: library };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle("undo-last-organize", async () => {
    try {
      return { success: true, data: undoLastOrganize(organizeLogPath) };
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

  ipcMain.handle(
    "choose-library-image",
    async (_event, folderPath: string, kind: "artist" | "album") => {
      try {
        const result = await dialog.showOpenDialog(mainWindow!, {
          properties: ["openFile"],
          title: kind === "artist" ? "Choose artist image" : "Choose album cover",
          filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
        });

        if (result.canceled || !result.filePaths[0]) {
          return { success: false, canceled: true };
        }

        const imagePath = saveLibraryImage(folderPath, result.filePaths[0], kind);
        return { success: true, imagePath };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

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

  ipcMain.handle("get-lyrics", async (_event, request: LyricsRequest) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const params = new URLSearchParams({
        artist_name: request.artistName,
        track_name: request.trackName,
        duration: String(Math.max(0, Math.round(request.duration))),
      });

      if (request.albumName) params.set("album_name", request.albumName);

      const response = await fetch(`https://lrclib.net/api/get?${params}`, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Muze desktop app",
        },
      });

      if (response.status === 404) {
        return { success: false, status: 404, error: "Lyrics not found." };
      }

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          error: "There was a technical issue loading lyrics.",
        };
      }

      const data = (await response.json()) as LrclibResponse;
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        status: err instanceof Error && err.name === "AbortError" ? "timeout" : "error",
        error: "There was a technical issue loading lyrics.",
      };
    } finally {
      clearTimeout(timeout);
    }
  });

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
    musicPath: app.getPath("music"),
    volume: 0.8,
    theme: "dark",
    accentColor: "#c8a96e",
    fontSize: 14,
  };

  function loadSettings() {
    try {
      if (existsSync(settingsPath)) {
        const saved = JSON.parse(readFileSync(settingsPath, "utf8"));
        return { ...defaultSettings, ...saved };
      }
    } catch {
      /* fall through */
    }
    return defaultSettings;
  }

  ipcMain.handle("get-settings", () => {
    return loadSettings();
  });

  ipcMain.handle("save-settings", (_event, settings: any) => {
    writeFileSync(settingsPath, JSON.stringify({ ...loadSettings(), ...settings }, null, 2));
  });
}

app.whenReady().then(async () => {
  protocol.handle("muze-media", (request) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: MEDIA_CORS_HEADERS });
    }

    const filePath = decodeURIComponent(new URL(request.url).pathname.slice(1));
    const ext = extname(filePath).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext) || !existsSync(filePath)) {
      return new Response(null, { status: 404 });
    }

    const stats = statSync(filePath);
    const range = request.headers.get("range");
    const mime = MEDIA_MIME[ext] ?? "application/octet-stream";

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match?.[1] ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? Math.min(parseInt(match[2], 10), stats.size - 1) : stats.size - 1;

      if (start >= stats.size || end < start) {
        return new Response(null, {
          status: 416,
          headers: { ...MEDIA_CORS_HEADERS, "Content-Range": `bytes */${stats.size}` },
        });
      }

      return new Response(createReadStream(filePath, { start, end }) as any, {
        status: 206,
        headers: {
          ...MEDIA_CORS_HEADERS,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Content-Type": mime,
        },
      });
    }

    return new Response(createReadStream(filePath) as any, {
      headers: {
        ...MEDIA_CORS_HEADERS,
        "Accept-Ranges": "bytes",
        "Content-Length": String(stats.size),
        "Content-Type": mime,
      },
    });
  });

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
