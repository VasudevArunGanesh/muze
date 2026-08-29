import { create } from 'zustand'
import type { Library, Artist, Album, Song } from '../types'

interface LibraryStore {
  library: Library | null
  isScanning: boolean
  scanError: string | null
  selectedArtist: Artist | null
  selectedAlbum: Album | null
  searchQuery: string

  scanLibrary: (path: string, options?: { organize?: boolean }) => Promise<void>
  selectArtist: (artist: Artist | null) => void
  selectAlbum: (album: Album | null) => void
  setSearchQuery: (q: string) => void
  updateSongRating: (songId: string, rating: number, review: string) => void
  updateAlbumRating: (albumId: string, rating: number, review: string) => void
  updateAlbumCover: (albumId: string, coverPath: string) => void
  updateArtistImage: (artistId: string, imagePath: string) => void

  // Derived helpers
  getAllSongs: () => Song[]
  getAllAlbums: () => Album[]
  getFilteredArtists: () => Artist[]
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  library: null,
  isScanning: false,
  scanError: null,
  selectedArtist: null,
  selectedAlbum: null,
  searchQuery: '',

  scanLibrary: async (path: string, options?: { organize?: boolean }) => {
    set({ isScanning: true, scanError: null })
    try {
      const result = await window.muze.scanLibrary(path, options)
      if (result.success) {
        set({ library: result.data, isScanning: false })
      } else {
        set({ scanError: result.error, isScanning: false })
      }
    } catch (err) {
      set({ scanError: String(err), isScanning: false })
    }
  },

  selectArtist: (artist) => set({ selectedArtist: artist, selectedAlbum: null }),
  selectAlbum: (album) => set({ selectedAlbum: album }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  updateSongRating: (songId, rating, review) => {
    const { library } = get()
    if (!library) return
    set({
      library: {
        ...library,
        artists: library.artists.map(artist => ({
          ...artist,
          albums: artist.albums.map(album => ({
            ...album,
            songs: album.songs.map(song =>
              song.id === songId ? { ...song, rating, review } : song
            )
          }))
        }))
      }
    })
  },

  updateAlbumRating: (albumId, rating, review) => {
    const { library } = get()
    if (!library) return
    set({
      library: {
        ...library,
        artists: library.artists.map(artist => ({
          ...artist,
          albums: artist.albums.map(album =>
            album.id === albumId ? { ...album, avgRating: rating } : album
          )
        }))
      }
    })
  },

  updateAlbumCover: (albumId, coverPath) => {
    const { library, selectedAlbum } = get()
    if (!library) return
    const updatedArtists = library.artists.map(artist => ({
      ...artist,
      albums: artist.albums.map(album =>
        album.id === albumId ? { ...album, coverPath } : album
      )
    }))
    set({
      library: { ...library, artists: updatedArtists },
      selectedArtist: updatedArtists.find(artist => artist.id === get().selectedArtist?.id) ?? get().selectedArtist,
      selectedAlbum: selectedAlbum?.id === albumId ? { ...selectedAlbum, coverPath } : selectedAlbum
    })
  },

  updateArtistImage: (artistId, imagePath) => {
    const { library, selectedArtist } = get()
    if (!library) return
    const updatedArtists = library.artists.map(artist =>
      artist.id === artistId ? { ...artist, imagePath } : artist
    )
    set({
      library: { ...library, artists: updatedArtists },
      selectedArtist: selectedArtist?.id === artistId ? { ...selectedArtist, imagePath } : selectedArtist
    })
  },

  getAllSongs: () => {
    const { library } = get()
    if (!library) return []
    return library.artists.flatMap(a => a.albums.flatMap(al => al.songs))
  },

  getAllAlbums: () => {
    const { library } = get()
    if (!library) return []
    return library.artists.flatMap(a => a.albums)
  },

  getFilteredArtists: () => {
    const { library, searchQuery } = get()
    if (!library) return []
    if (!searchQuery.trim()) return library.artists
    const q = searchQuery.toLowerCase()
    return library.artists.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.albums.some(al =>
        al.name.toLowerCase().includes(q) ||
        al.songs.some(s => s.title.toLowerCase().includes(q))
      )
    )
  }
}))
