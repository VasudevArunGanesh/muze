import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { dirname, extname, basename, join, relative } from 'path'
import { createHash } from 'crypto'
import type { Library, Artist, Album, Song } from '../renderer/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.alac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.ape', '.opus'])
const COVER_NAMES = ['cover', 'folder', 'album', 'artwork', 'front']
const IMAGE_EXTS   = ['.jpg', '.jpeg', '.png', '.webp']
const ARTIST_IMAGE_NAMES = ['artist', 'photo', 'profile', 'avatar', 'folder']
const UNKNOWN_ARTIST = 'Unknown Artist'
const UNKNOWN_ALBUM = 'Unknown Album'

function makeId(path: string): string {
  return createHash('sha1').update(path).digest('hex').slice(0, 16)
}

function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.has(extname(filename).toLowerCase())
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return !!rel && !rel.startsWith('..') && !rel.includes('..\\')
}

function sanitizeFolderName(value: string | undefined, fallback: string): string {
  const cleaned = (value ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
  return cleaned || fallback
}

function getUniquePath(targetPath: string): string {
  if (!existsSync(targetPath)) return targetPath

  const dir = dirname(targetPath)
  const ext = extname(targetPath)
  const name = basename(targetPath, ext)
  let index = 2
  let candidate = join(dir, `${name} (${index})${ext}`)

  while (existsSync(candidate)) {
    index += 1
    candidate = join(dir, `${name} (${index})${ext}`)
  }

  return candidate
}

function collectAudioFiles(folderPath: string): string[] {
  let entries: string[]
  try { entries = readdirSync(folderPath) } catch { return [] }

  const files: string[] = []
  for (const entry of entries) {
    const entryPath = join(folderPath, entry)
    try {
      const stats = statSync(entryPath)
      if (stats.isDirectory()) files.push(...collectAudioFiles(entryPath))
      else if (stats.isFile() && isAudioFile(entry)) files.push(entryPath)
    } catch { /* skip unreadable entries */ }
  }

  return files
}

function isProperlyStructured(musicPath: string, filePath: string): boolean {
  const segments = relative(musicPath, filePath).split(/[\\/]+/).filter(Boolean)
  return segments.length === 3
}

async function organizeLooseTracks(musicPath: string): Promise<void> {
  const { parseFile } = await import('music-metadata')
  const audioFiles = collectAudioFiles(musicPath)

  for (const filePath of audioFiles) {
    if (isProperlyStructured(musicPath, filePath)) continue

    const relSegments = relative(musicPath, filePath).split(/[\\/]+/).filter(Boolean)
    const parentName = relSegments.length > 1 ? relSegments[relSegments.length - 2] : undefined
    const grandParentName = relSegments.length > 2 ? relSegments[relSegments.length - 3] : undefined

    let artistName = grandParentName ?? parentName ?? UNKNOWN_ARTIST
    let albumName = parentName && parentName !== artistName ? parentName : UNKNOWN_ALBUM

    try {
      const meta = await parseFile(filePath, { duration: false, skipCovers: true })
      artistName = meta.common.albumartist || meta.common.artist || artistName
      albumName = meta.common.album || albumName
    } catch { /* use path-derived fallback names */ }

    const artistFolder = sanitizeFolderName(artistName, UNKNOWN_ARTIST)
    const albumFolder = sanitizeFolderName(albumName, UNKNOWN_ALBUM)
    const targetDir = join(musicPath, artistFolder, albumFolder)
    const targetPath = getUniquePath(join(targetDir, basename(filePath)))

    if (!isInside(musicPath, targetPath)) continue
    if (targetPath === filePath) continue

    mkdirSync(targetDir, { recursive: true })
    renameSync(filePath, targetPath)
  }
}

export function saveLibraryImage(folderPath: string, sourcePath: string, kind: 'artist' | 'album'): string {
  if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
    throw new Error('Target folder not found.')
  }
  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    throw new Error('Image file not found.')
  }

  const sourceExt = extname(sourcePath).toLowerCase()
  if (!IMAGE_EXTS.includes(sourceExt)) {
    throw new Error('Please choose a JPG, PNG, or WebP image.')
  }

  const baseName = kind === 'artist' ? 'artist' : 'cover'
  for (const ext of IMAGE_EXTS) {
    const existing = join(folderPath, `${baseName}${ext}`)
    try {
      if (existsSync(existing)) unlinkSync(existing)
    } catch { /* ignore image cleanup failures */ }
  }

  const targetPath = join(folderPath, `${baseName}${sourceExt}`)
  copyFileSync(sourcePath, targetPath)
  return targetPath
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
  await organizeLooseTracks(musicPath)

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
