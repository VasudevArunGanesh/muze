import { create } from 'zustand'
import type { Album, Artist, LyricsResult, Song } from '../types'

interface LyricsStore {
  songId: string | null
  result: LyricsResult | null
  isLoading: boolean
  loadLyrics: (song: Song | null, artist: Artist | null, album: Album | null, duration: number) => Promise<void>
  clearLyrics: () => void
}

const cache = new Map<string, LyricsResult>()
let requestSeq = 0

export const useLyricsStore = create<LyricsStore>((set, get) => ({
  songId: null,
  result: null,
  isLoading: false,

  loadLyrics: async (song, artist, album, duration) => {
    if (!song || !artist) {
      set({ songId: null, result: null, isLoading: false })
      return
    }

    const current = get()
    if (current.songId === song.id && current.isLoading) return

    const cached = cache.get(song.id)
    if (cached) {
      set({ songId: song.id, result: cached, isLoading: false })
      return
    }

    const seq = ++requestSeq
    set({ songId: song.id, result: null, isLoading: true })

    try {
      const result = await window.muze.getLyrics({
        artistName: artist.name,
        trackName: song.title,
        albumName: album?.isSinglesCollection ? undefined : album?.name,
        duration: song.duration || duration,
      })

      cache.set(song.id, result)
      if (seq === requestSeq) set({ songId: song.id, result, isLoading: false })
    } catch {
      const result: LyricsResult = {
        success: false,
        status: 'error',
        error: 'There was a technical issue loading lyrics.',
      }
      cache.set(song.id, result)
      if (seq === requestSeq) set({ songId: song.id, result, isLoading: false })
    }
  },

  clearLyrics: () => {
    requestSeq += 1
    set({ songId: null, result: null, isLoading: false })
  },
}))
