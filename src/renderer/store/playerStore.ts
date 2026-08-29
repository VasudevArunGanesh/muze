import { create } from 'zustand'
import { Howl } from 'howler'
import type { Song } from '../types'

interface PlayerStore {
  currentSong: Song | null
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  shuffle: boolean
  repeat: 'none' | 'one' | 'all'

  // Internal howl instance (not serialised)
  _howl: Howl | null
  _ticker: ReturnType<typeof setInterval> | null

  playSong: (song: Song, queue?: Song[]) => void
  playAlbum: (songs: Song[], startIndex?: number) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setVolume: (v: number) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  addToQueue: (song: Song) => void
  clearQueue: () => void
}

function buildHowl(song: Song, onEnd: () => void, onLoad: (duration: number) => void): Howl {
  return new Howl({
    src: [song.mediaUrl ?? song.filePath],
    html5: true,   // stream large files rather than loading into memory
    format: [song.format, 'mp3'],   // fallback format hint
    volume: usePlayerStore.getState().volume,
    onend: onEnd,
    onload: function (this: Howl) {
      onLoad(this.duration())
    },
    onloaderror: (_id, err) => {
      console.error('Howl load error:', err)
    }
  })
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  shuffle: false,
  repeat: 'none',
  _howl: null,
  _ticker: null,

  playSong: (song: Song, queue?: Song[]) => {
    const state = get()

    // Stop current howl
    if (state._howl) {
      state._howl.stop()
      state._howl.unload()
    }
    if (state._ticker) clearInterval(state._ticker)

    const newQueue = queue ?? (state.queue.length > 0 ? state.queue : [song])
    const newIndex = newQueue.findIndex(s => s.id === song.id)

    const howl = buildHowl(
      song,
      () => get().next(),  // on end
      (duration) => set({ duration })
    )

    const ticker = setInterval(() => {
      const h = get()._howl
      if (h?.playing()) {
        set({ currentTime: h.seek() as number })
      }
    }, 500)

    howl.play()

    // Record play in DB (fire and forget)
    window.muze.recordPlay(song.id).catch(() => {})

    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: newIndex,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
      _howl: howl,
      _ticker: ticker
    })
  },

  playAlbum: (songs: Song[], startIndex = 0) => {
    if (songs.length === 0) return
    get().playSong(songs[startIndex], songs)
  },

  togglePlay: () => {
    const { _howl, isPlaying } = get()
    if (!_howl) return
    if (isPlaying) {
      _howl.pause()
      set({ isPlaying: false })
    } else {
      _howl.play()
      set({ isPlaying: true })
    }
  },

  next: () => {
    const { queue, queueIndex, repeat, shuffle } = get()
    if (queue.length === 0) return

    if (repeat === 'one') {
      get().playSong(queue[queueIndex], queue)
      return
    }

    let nextIndex: number
    if (shuffle) {
      if (queue.length === 1) {
        if (repeat === 'all') {
          nextIndex = 0
        } else {
          get()._howl?.stop()
          set({ isPlaying: false, currentTime: 0 })
          return
        }
      } else {
        const candidates = queue.map((_, i) => i).filter(i => i !== queueIndex)
        nextIndex = candidates[Math.floor(Math.random() * candidates.length)]
      }
    } else {
      nextIndex = queueIndex + 1
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0
        } else {
          // End of queue
          get()._howl?.stop()
          set({ isPlaying: false, currentTime: 0 })
          return
        }
      }
    }

    get().playSong(queue[nextIndex], queue)
  },

  prev: () => {
    const { queue, queueIndex, currentTime, _howl } = get()

    // If more than 3s in, restart current song
    if (currentTime > 3) {
      _howl?.seek(0)
      set({ currentTime: 0 })
      return
    }

    const prevIndex = Math.max(0, queueIndex - 1)
    if (queue.length > 0) {
      get().playSong(queue[prevIndex], queue)
    }
  },

  seek: (time: number) => {
    const { _howl } = get()
    if (_howl) {
      _howl.seek(time)
      set({ currentTime: time })
    }
  },

  setVolume: (v: number) => {
    const { _howl } = get()
    if (_howl) _howl.volume(v)
    set({ volume: v })
    window.muze.saveSettings({ volume: v }).catch(() => {})
  },

  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),

  cycleRepeat: () => set(s => ({
    repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none'
  })),

  addToQueue: (song: Song) => set(s => ({ queue: [...s.queue, song] })),

  clearQueue: () => {
    const { _howl, _ticker } = get()
    _howl?.stop()
    _howl?.unload()
    if (_ticker) clearInterval(_ticker)
    set({ queue: [], queueIndex: -1, currentSong: null, isPlaying: false, _howl: null, _ticker: null })
  }
}))
