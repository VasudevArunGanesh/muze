export interface Song {
  id: string
  filePath: string
  fileName: string
  title: string
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
