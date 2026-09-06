/**
 * Drives the "Download from YouTube" flow: paste a link → fetch + confirm
 * metadata → download & tag → rescan the library. Handles both a single
 * video and a whole playlist (downloaded sequentially, in playlist order).
 */
import { create } from 'zustand'
import { useLibraryStore } from './libraryStore'
import type {
  YoutubeVideoInfo, YoutubeDownloadResult,
  YoutubePlaylistDownloadResult,
} from '../types'

type Stage =
  | 'idle' | 'fetching' | 'preview' | 'downloading' | 'tagging' | 'success' | 'error'
  | 'link-choice'
  | 'fetching-playlist' | 'playlist-preview' | 'playlist-downloading' | 'playlist-summary'

interface Progress {
  percent: number
  speed?: string
  eta?: string
}

export interface PlaylistTrackState {
  url: string
  videoTitle: string
  title: string
  durationSeconds: number
  include: boolean
  unavailable: boolean
}

interface PlaylistProgress {
  currentIndex: number
  total: number
  currentTitle: string
  percent: number
  speed?: string
  eta?: string
}

interface DownloadStore {
  isOpen: boolean
  stage: Stage
  url: string
  error: string | null
  downloadId: string | null

  // Ambiguous link (has both a video id and a playlist id)
  pendingUrl: string

  // Single-video flow
  videoInfo: YoutubeVideoInfo | null
  title: string
  artist: string
  album: string
  progress: Progress | null
  result: YoutubeDownloadResult | null

  // Playlist flow
  playlistTitle: string
  playlistArtist: string
  playlistAlbum: string
  playlistTracks: PlaylistTrackState[]
  playlistProgress: PlaylistProgress | null
  playlistResult: YoutubePlaylistDownloadResult | null

  open: () => void
  close: () => void
  reset: () => void
  setUrl: (url: string) => void
  fetchInfo: () => Promise<void>
  chooseSingleVideo: () => Promise<void>
  choosePlaylist: () => Promise<void>

  setTitle: (title: string) => void
  setArtist: (artist: string) => void
  setAlbum: (album: string) => void
  startDownload: (musicPath: string) => Promise<void>

  setPlaylistArtist: (artist: string) => void
  setPlaylistAlbum: (album: string) => void
  setTrackTitle: (index: number, title: string) => void
  toggleTrack: (index: number) => void
  toggleAllTracks: (include: boolean) => void
  startPlaylistDownload: (musicPath: string) => Promise<void>

  cancelDownload: () => void
}

function makeDownloadId(): string {
  return `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** A link is playlist-only (not also a specific video) if it's the bare /playlist page. */
function isBarePlaylistUrl(url: string): boolean {
  return /\/playlist\?/i.test(url)
}
function hasPlaylistParam(url: string): boolean {
  return /[?&]list=/i.test(url)
}

const INITIAL_STATE = {
  isOpen: false,
  stage: 'idle' as Stage,
  url: '',
  error: null as string | null,
  downloadId: null as string | null,
  pendingUrl: '',

  videoInfo: null as YoutubeVideoInfo | null,
  title: '',
  artist: '',
  album: '',
  progress: null as Progress | null,
  result: null as YoutubeDownloadResult | null,

  playlistTitle: '',
  playlistArtist: '',
  playlistAlbum: '',
  playlistTracks: [] as PlaylistTrackState[],
  playlistProgress: null as PlaylistProgress | null,
  playlistResult: null as YoutubePlaylistDownloadResult | null,
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  ...INITIAL_STATE,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  reset: () => set({ ...INITIAL_STATE, isOpen: true }),

  setUrl: (url) => set({ url, error: null }),

  fetchInfo: async () => {
    const trimmed = get().url.trim()
    if (!trimmed) return

    // A link with both a video id and a playlist id is ambiguous — let the
    // user pick, rather than silently assuming which one they meant.
    if (hasPlaylistParam(trimmed) && !isBarePlaylistUrl(trimmed)) {
      set({ stage: 'link-choice', pendingUrl: trimmed })
      return
    }
    if (hasPlaylistParam(trimmed)) {
      await runPlaylistFetch(trimmed, set)
      return
    }
    await runVideoFetch(trimmed, set)
  },

  chooseSingleVideo: async () => {
    await runVideoFetch(get().pendingUrl, set)
  },

  choosePlaylist: async () => {
    await runPlaylistFetch(get().pendingUrl, set)
  },

  setTitle: (title) => set({ title }),
  setArtist: (artist) => set({ artist }),
  setAlbum: (album) => set({ album }),

  startDownload: async (musicPath) => {
    const { url, title, artist, album } = get()
    if (!musicPath) {
      set({ stage: 'error', error: 'Set your music folder in Settings first.' })
      return
    }

    const downloadId = makeDownloadId()
    set({ stage: 'downloading', downloadId, progress: { percent: 0 }, error: null })

    const unsubscribe = window.muze.onYoutubeDownloadProgress((progress) => {
      if (progress.downloadId !== downloadId) return
      set({
        stage: progress.stage,
        progress: { percent: progress.percent, speed: progress.speed, eta: progress.eta },
      })
    })

    try {
      const result = await window.muze.downloadYoutubeAudio(downloadId, {
        url: url.trim(),
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        musicPath,
      })

      if (result.success) {
        set({ stage: 'success', result })
        // Rescan without re-running the folder organizer — we already placed
        // the file exactly where the library expects it.
        await useLibraryStore.getState().scanLibrary(musicPath, { organize: false })
      } else {
        set({ stage: result.canceled ? 'preview' : 'error', error: result.canceled ? null : result.error })
      }
    } catch (err) {
      set({ stage: 'error', error: err instanceof Error ? err.message : String(err) })
    } finally {
      unsubscribe()
      set({ downloadId: null })
    }
  },

  setPlaylistArtist: (playlistArtist) => set({ playlistArtist }),
  setPlaylistAlbum: (playlistAlbum) => set({ playlistAlbum }),

  setTrackTitle: (index, title) => set((s) => ({
    playlistTracks: s.playlistTracks.map((t, i) => (i === index ? { ...t, title } : t)),
  })),

  toggleTrack: (index) => set((s) => ({
    playlistTracks: s.playlistTracks.map((t, i) => (i === index ? { ...t, include: !t.include } : t)),
  })),

  toggleAllTracks: (include) => set((s) => ({
    playlistTracks: s.playlistTracks.map((t) => (t.unavailable ? t : { ...t, include })),
  })),

  startPlaylistDownload: async (musicPath) => {
    const { playlistArtist, playlistAlbum, playlistTracks } = get()
    if (!musicPath) {
      set({ stage: 'error', error: 'Set your music folder in Settings first.' })
      return
    }

    const selected = playlistTracks.filter((t) => t.include)
    if (selected.length === 0) {
      set({ stage: 'error', error: 'Select at least one track to download.' })
      return
    }

    const downloadId = makeDownloadId()
    set({
      stage: 'playlist-downloading',
      downloadId,
      error: null,
      playlistProgress: { currentIndex: 1, total: selected.length, currentTitle: selected[0].title, percent: 0 },
    })

    const unsubscribe = window.muze.onYoutubePlaylistDownloadProgress((progress) => {
      if (progress.downloadId !== downloadId) return
      set({
        playlistProgress: {
          currentIndex: progress.currentIndex,
          total: progress.total,
          currentTitle: progress.currentTitle,
          percent: progress.percent,
          speed: progress.speed,
          eta: progress.eta,
        },
      })
    })

    try {
      // trackNumber follows playlist order (1-based), independent of which
      // tracks were deselected, so the numbering still reflects real position.
      const numbered = playlistTracks
        .map((t, i) => ({ ...t, trackNumber: i + 1 }))
        .filter((t) => t.include)

      const result = await window.muze.downloadYoutubePlaylist(downloadId, {
        artist: playlistArtist.trim(),
        album: playlistAlbum.trim(),
        musicPath,
        tracks: numbered.map((t) => ({ url: t.url, title: t.title.trim(), trackNumber: t.trackNumber })),
      })

      set({ stage: 'playlist-summary', playlistResult: result })
      await useLibraryStore.getState().scanLibrary(musicPath, { organize: false })
    } catch (err) {
      set({ stage: 'error', error: err instanceof Error ? err.message : String(err) })
    } finally {
      unsubscribe()
      set({ downloadId: null })
    }
  },

  cancelDownload: () => {
    const { downloadId } = get()
    if (downloadId) window.muze.cancelYoutubeDownload(downloadId)
  },
}))

// ── Shared fetch implementations (used by fetchInfo and the link-choice) ────

async function runVideoFetch(url: string, set: (partial: Partial<DownloadStore>) => void) {
  set({ stage: 'fetching', error: null })
  try {
    const result = await window.muze.getYoutubeInfo(url)
    if (!result.success) {
      set({ stage: 'error', error: result.error })
      return
    }
    const info = result.data
    set({
      stage: 'preview',
      url,
      videoInfo: info,
      title: info.suggestedTitle,
      artist: info.suggestedArtist,
      album: '',
    })
  } catch (err) {
    set({ stage: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

async function runPlaylistFetch(url: string, set: (partial: Partial<DownloadStore>) => void) {
  set({ stage: 'fetching-playlist', error: null })
  try {
    const result = await window.muze.getYoutubePlaylistInfo(url)
    if (!result.success) {
      set({ stage: 'error', error: result.error })
      return
    }
    const info = result.data
    set({
      stage: 'playlist-preview',
      url,
      playlistTitle: info.playlistTitle,
      playlistArtist: info.suggestedArtist,
      playlistAlbum: info.playlistTitle,
      playlistTracks: info.entries.map((e) => ({
        url: e.url,
        videoTitle: e.videoTitle,
        title: e.suggestedTitle,
        durationSeconds: e.durationSeconds,
        include: !e.unavailable,
        unavailable: e.unavailable,
      })),
    })
  } catch (err) {
    set({ stage: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}
