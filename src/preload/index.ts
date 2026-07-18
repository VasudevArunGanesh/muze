import { contextBridge, ipcRenderer } from "electron";

// Expose a typed, safe API to the renderer process
contextBridge.exposeInMainWorld("muze", {
  scanLibrary: (musicPath: string) =>
    ipcRenderer.invoke("scan-library", musicPath),

  getCoverArt: (coverPath: string) =>
    ipcRenderer.invoke("get-cover-art", coverPath),

  chooseLibraryImage: (folderPath: string, kind: "artist" | "album") =>
    ipcRenderer.invoke("choose-library-image", folderPath, kind),

  getSongRating: (songId: string) =>
    ipcRenderer.invoke("get-song-rating", songId),

  saveSongRating: (songId: string, rating: number, review: string) =>
    ipcRenderer.invoke("save-song-rating", songId, rating, review),

  getAlbumRating: (albumId: string) =>
    ipcRenderer.invoke("get-album-rating", albumId),

  saveAlbumRating: (albumId: string, rating: number, review: string) =>
    ipcRenderer.invoke("save-album-rating", albumId, rating, review),

  recordPlay: (songId: string) => ipcRenderer.invoke("record-play", songId),

  getRecentlyPlayed: (limit: number) =>
    ipcRenderer.invoke("get-recently-played", limit),

  getLyrics: (request: unknown) => ipcRenderer.invoke("get-lyrics", request),

  openMusicFolder: () => ipcRenderer.invoke("open-music-folder"),

  getSettings: () => ipcRenderer.invoke("get-settings"),

  saveSettings: (settings: unknown) =>
    ipcRenderer.invoke("save-settings", settings),

  windowMinimize: () => ipcRenderer.invoke("window-minimize"),

  windowToggleMaximize: () => ipcRenderer.invoke("window-toggle-maximize"),

  windowClose: () => ipcRenderer.invoke("window-close"),

  maximizeFromMini: () => ipcRenderer.invoke("maximize-from-mini"),

  setPlayerFullscreen: (enabled: boolean) =>
    ipcRenderer.invoke("set-player-fullscreen", enabled),

  // Listen for OS media key events pushed from main
  onMediaNext: (cb: () => void) => {
    ipcRenderer.on("media-next", cb);
    return () => ipcRenderer.removeListener("media-next", cb);
  },
  onMediaPrev: (cb: () => void) => {
    ipcRenderer.on("media-prev", cb);
    return () => ipcRenderer.removeListener("media-prev", cb);
  },
  onMediaPlayPause: (cb: () => void) => {
    ipcRenderer.on("media-play-pause", cb);
    return () => ipcRenderer.removeListener("media-play-pause", cb);
  },
});
