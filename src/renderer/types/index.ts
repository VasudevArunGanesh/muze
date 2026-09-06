export interface Song {
  id: string
  filePath: string
  mediaUrl?: string
  fileName: string
  title: string
  discNumber: number | null
  trackNumber: number | null
  duration: number
  format: string
  bitrate?: number
  sampleRate?: number
  channels?: number
  artistId: string
  albumId: string
  rating?: number
  review?: string
  playCount: number
  lastPlayed?: string
}

export interface Album {
  id: string
  folderPath: string
  name: string
  artistId: string
  artistName: string
  year?: number
  coverPath?: string
  songs: Song[]
  avgRating?: number
  isSinglesCollection?: boolean  // true for the auto-generated "Singles & Loose Tracks" album
}

export interface Artist {
  id: string
  folderPath: string
  name: string
  albums: Album[]
  songCount: number
  imagePath?: string
  avgRating?: number
}

export interface Library {
  artists: Artist[]
  totalSongs: number
  totalAlbums: number
  scannedAt: string
}

export interface AppSettings {
  musicPath: string
  volume: number
  theme: 'dark'          // dark only for now
  accentColor: string    // hex e.g. '#c8a96e'
  fontSize: number       // base px, 13–18
}

export interface LyricsRequest {
  artistName: string
  trackName: string
  albumName?: string
  duration: number
}

export interface LyricsData {
  id: number
  name: string
  trackName: string
  artistName: string
  albumName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

export type LyricsResult =
  | { success: true; data: LyricsData }
  | { success: false; status: number | 'timeout' | 'error'; error: string }

export interface YoutubeVideoInfo {
  videoTitle: string
  uploader: string
  durationSeconds: number
  thumbnailDataUrl: string | null
  suggestedTitle: string
  suggestedArtist: string
}

export interface YoutubeDownloadRequest {
  url: string
  title: string
  artist: string
  album: string
  musicPath: string
}

export interface YoutubeDownloadProgress {
  downloadId: string
  stage: 'downloading' | 'tagging'
  percent: number
  speed?: string
  eta?: string
}

export type YoutubeDownloadResult =
  | { success: true; filePath: string; relativePath: string }
  | { success: false; error: string; canceled?: boolean }

export type YoutubeInfoResult =
  | { success: true; data: YoutubeVideoInfo }
  | { success: false; error: string }

export interface YoutubePlaylistEntry {
  url: string
  videoTitle: string
  uploader: string
  durationSeconds: number
  suggestedTitle: string
  unavailable: boolean
}

export interface YoutubePlaylistInfo {
  playlistTitle: string
  suggestedArtist: string
  entries: YoutubePlaylistEntry[]
}

export type YoutubePlaylistInfoResult =
  | { success: true; data: YoutubePlaylistInfo }
  | { success: false; error: string }

export interface YoutubePlaylistTrackRequest {
  url: string
  title: string
  trackNumber: number
}

export interface YoutubePlaylistDownloadRequest {
  artist: string
  album: string
  musicPath: string
  tracks: YoutubePlaylistTrackRequest[]
}

export interface YoutubePlaylistDownloadProgress {
  downloadId: string
  currentIndex: number
  total: number
  currentTitle: string
  stage: 'downloading' | 'tagging'
  percent: number
  speed?: string
  eta?: string
}

export interface YoutubePlaylistTrackResult {
  title: string
  success: boolean
  error?: string
}

export interface YoutubePlaylistDownloadResult {
  canceled: boolean
  results: YoutubePlaylistTrackResult[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  musicPath: '',
  volume: 0.8,
  theme: 'dark',
  accentColor: '#c8a96e',
  fontSize: 14
}

export const ACCENT_PRESETS = [
  { name: 'Gold',    value: '#c8a96e' },
  { name: 'Teal',    value: '#4ec9b0' },
  { name: 'Coral',   value: '#e07b72' },
  { name: 'Violet',  value: '#9d7fe3' },
  { name: 'Sky',     value: '#5aabde' },
  { name: 'Sage',    value: '#7ab87a' },
  { name: 'Rose',    value: '#d97eb5' },
  { name: 'White',   value: '#e8e8e8' },
]

export type ViewType = 'artists' | 'albums' | 'songs' | 'rated' | 'recent'
