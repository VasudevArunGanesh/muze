import type {
  AppSettings, LyricsRequest, LyricsResult,
  YoutubeDownloadRequest, YoutubeDownloadResult, YoutubeInfoResult,
  YoutubePlaylistInfoResult, YoutubePlaylistDownloadRequest, YoutubePlaylistDownloadResult,
  YoutubePlaylistDownloadProgress,
} from './index'

interface MuzeElectronAPI {
  scanLibrary: (musicPath: string, options?: { organize?: boolean }) => Promise<{ success: true; data: import('./index').Library } | { success: false; error: string }>
  undoLastOrganize: () => Promise<
    | { success: true; data: { restored: number; skipped: number } }
    | { success: false; error: string }
  >
  getCoverArt: (coverPath: string) => Promise<string | null>
  chooseLibraryImage: (folderPath: string, kind: 'artist' | 'album') => Promise<
    | { success: true; imagePath: string }
    | { success: false; canceled?: boolean; error?: string }
  >
  getSongRating: (songId: string) => Promise<{ rating: number; review: string } | null>
  saveSongRating: (songId: string, rating: number, review: string) => Promise<void>
  getAlbumRating: (albumId: string) => Promise<{ rating: number; review: string } | null>
  saveAlbumRating: (albumId: string, rating: number, review: string) => Promise<void>
  recordPlay: (songId: string) => Promise<void>
  getRecentlyPlayed: (limit: number) => Promise<Array<{ song_id: string; played_at: string }>>
  getLyrics: (request: LyricsRequest) => Promise<LyricsResult>
  getYoutubeInfo: (url: string) => Promise<YoutubeInfoResult>
  downloadYoutubeAudio: (downloadId: string, request: YoutubeDownloadRequest) => Promise<YoutubeDownloadResult>
  getYoutubePlaylistInfo: (url: string) => Promise<YoutubePlaylistInfoResult>
  downloadYoutubePlaylist: (downloadId: string, request: YoutubePlaylistDownloadRequest) => Promise<YoutubePlaylistDownloadResult>
  onYoutubePlaylistDownloadProgress: (cb: (progress: YoutubePlaylistDownloadProgress) => void) => () => void
  cancelYoutubeDownload: (downloadId: string) => Promise<boolean>
  onYoutubeDownloadProgress: (cb: (progress: import('./index').YoutubeDownloadProgress) => void) => () => void
  openMusicFolder: () => Promise<string | null>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>
  windowMinimize: () => Promise<void>
  windowToggleMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  maximizeFromMini: () => Promise<void>
  setPlayerFullscreen: (enabled: boolean) => Promise<void>
  onMediaNext: (cb: () => void) => () => void
  onMediaPrev: (cb: () => void) => () => void
  onMediaPlayPause: (cb: () => void) => () => void
}

declare global {
  interface Window {
    muze: MuzeElectronAPI
  }
}

export {}
