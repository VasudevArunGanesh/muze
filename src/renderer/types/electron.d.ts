import type { AppSettings, LyricsRequest, LyricsResult } from './index'

interface MuzeElectronAPI {
  scanLibrary: (musicPath: string) => Promise<{ success: true; data: import('./index').Library } | { success: false; error: string }>
  getCoverArt: (coverPath: string) => Promise<string | null>
  getSongRating: (songId: string) => Promise<{ rating: number; review: string } | null>
  saveSongRating: (songId: string, rating: number, review: string) => Promise<void>
  getAlbumRating: (albumId: string) => Promise<{ rating: number; review: string } | null>
  saveAlbumRating: (albumId: string, rating: number, review: string) => Promise<void>
  recordPlay: (songId: string) => Promise<void>
  getRecentlyPlayed: (limit: number) => Promise<Array<{ song_id: string; played_at: string }>>
  getLyrics: (request: LyricsRequest) => Promise<LyricsResult>
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
