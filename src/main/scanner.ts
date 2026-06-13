import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { createHash } from 'crypto'
import type { Library, Artist, Album, Song } from '../renderer/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.alac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.ape', '.opus'])
const COVER_NAMES = ['cover', 'folder', 'album', 'artwork', 'front']
const IMAGE_EXTS   = ['.jpg', '.jpeg', '.png', '.webp']
const ARTIST_IMAGE_NAMES = ['artist', 'photo', 'profile', 'avatar', 'folder']

function makeId(path: string): string {
  return createHash('sha1').update(path).digest('hex').slice(0, 16)
}

function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase())
}

function findCoverInFolder(folderPath: string): string | undefined {
  try {
    const files = readdirSync(folderPath)
    for (const name of COVER_NAMES) {
      for (const ext of IMAGE_EXTS) {
        const match = files.find(f => f.toLowerCase() === name + ext)
        if (match) return join(folderPath, match)
      }
    }
    const img = files.find(f => IMAGE_EXTS.includes(extname(f).toLowerCase()))
    if (img) return join(folderPath, img)
  } catch { /* unreadable */ }
  return undefined
}

function findArtistImageInFolder(folderPath: string): string | undefined {
  try {
    const files = readdirSync(folderPath)
    // Priority 1: known artist image names (artist.jpg, photo.png etc)
    for (const name of ARTIST_IMAGE_NAMES) {
      for (const ext of IMAGE_EXTS) {
        const match = files.find(f => f.toLowerCase() === name + ext)
        if (match) return join(folderPath, match)
      }
    }
    // Priority 2: any image directly in the artist root folder
    // (but NOT inside sub-directories — those are album covers)
    const img = files.find(f =>
      IMAGE_EXTS.includes(extname(f).toLowerCase()) &&
      !statSync(join(folderPath, f)).isDirectory()
    )
    if (img) return join(folderPath, img)
  } catch { /* unreadable */ }
  return undefined
}

async function parseSongMetadata(filePath: string, artistId: string, albumId: string): Promise<Song> {
  const { parseFile } = await import('music-metadata')
  const fileName = basename(filePath)
  const id = makeId(filePath)

  let title = fileName.replace(extname(fileName), '')
  title = title.replace(/^\d+[\s.\-_]+(?:[^-]+-\s*)?/, '').trim() || title

  let trackNumber: number | null = null
  let duration = 0
  let bitrate: number | undefined
  let sampleRate: number | undefined
  let channels: number | undefined
  let format = extname(filePath).slice(1).toLowerCase()

  try {
    const meta = await parseFile(filePath, { duration: true, skipCovers: true })
    const { common, format: fmt } = meta
    if (common.title) title = common.title
    if (common.track?.no) trackNumber = common.track.no
    if (fmt.duration) duration = Math.round(fmt.duration)
    if (fmt.bitrate) bitrate = Math.round(fmt.bitrate / 1000)
    if (fmt.sampleRate) sampleRate = fmt.sampleRate
    if (fmt.numberOfChannels) channels = fmt.numberOfChannels
    if (fmt.container) format = fmt.container.toLowerCase()
  } catch { /* use filename-derived values */ }

  return { id, filePath, fileName, title, trackNumber, duration, format, bitrate, sampleRate, channels, artistId, albumId, playCount: 0 }
}

async function scanAlbum(folderPath: string, artistId: string, artistName: string): Promise<Album | null> {
  let entries: string[]
  try { entries = readdirSync(folderPath) } catch { return null }

  const audioFiles = entries.filter(isAudioFile).sort()
  if (audioFiles.length === 0) return null

  const albumId = makeId(folderPath)
  let name = basename(folderPath).replace(/\s*-\s*[^-]+$/, '').trim() || basename(folderPath)

  let year: number | undefined
  const yearMatch = name.match(/[\[\(](\d{4})[\]\)]/) || name.match(/\b(19|20)\d{2}\b/)
  if (yearMatch) {
    year = parseInt(yearMatch[1])
    name = name.replace(/[\[\(]\d{4}[\]\)]/, '').replace(/\s*\b(19|20)\d{2}\b/, '').trim()
  }

  const coverPath = findCoverInFolder(folderPath)

  const BATCH = 8
  const songs: Song[] = []
  for (let i = 0; i < audioFiles.length; i += BATCH) {
    const results = await Promise.all(
      audioFiles.slice(i, i + BATCH).map(f => parseSongMetadata(join(folderPath, f), artistId, albumId))
    )
    songs.push(...results)
  }

  songs.sort((a, b) => {
    if (a.trackNumber != null && b.trackNumber != null) return a.trackNumber - b.trackNumber
    if (a.trackNumber != null) return -1
    if (b.trackNumber != null) return 1
    return a.fileName.localeCompare(b.fileName)
  })

  return { id: albumId, folderPath, name, artistId, artistName, year, coverPath, songs }
}

export async function scanLibrary(musicPath: string): Promise<Library> {
  if (!existsSync(musicPath)) throw new Error(`Music folder not found: ${musicPath}`)

  const artistFolders = readdirSync(musicPath)
    .filter(name => { try { return statSync(join(musicPath, name)).isDirectory() } catch { return false } })
    .sort()

  const artists: Artist[] = []

  for (const artistName of artistFolders) {
    const artistPath = join(musicPath, artistName)
    const artistId = makeId(artistPath)

    let subEntries: string[]
    try { subEntries = readdirSync(artistPath) } catch { continue }

    const albumFolders = subEntries.filter(name => {
      try { return statSync(join(artistPath, name)).isDirectory() } catch { return false }
    })

    const albums: Album[] = []
    for (const albumFolder of albumFolders.sort()) {
      const album = await scanAlbum(join(artistPath, albumFolder), artistId, artistName)
      if (album) albums.push(album)
    }

    const rootAudioFiles = subEntries.filter(isAudioFile)
    if (rootAudioFiles.length > 0) {
      const singlesId = makeId(artistPath + '/__singles__')
      const singles: Song[] = []
      for (const f of rootAudioFiles) {
        singles.push(await parseSongMetadata(join(artistPath, f), artistId, singlesId))
      }
      albums.unshift({ id: singlesId, folderPath: artistPath, name: "Singles & Loose Tracks", artistId, artistName, songs: singles, isSinglesCollection: true })
    }

    if (albums.length === 0) continue

    // Look for artist image in the artist root folder
    const imagePath = findArtistImageInFolder(artistPath)

    const songCount = albums.reduce((n, a) => n + a.songs.length, 0)
    artists.push({ id: artistId, folderPath: artistPath, name: artistName, albums, songCount, imagePath })
  }

  return {
    artists,
    totalSongs: artists.reduce((n, ar) => n + ar.songCount, 0),
    totalAlbums: artists.reduce((n, ar) => n + ar.albums.length, 0),
    scannedAt: new Date().toISOString()
  }
}
