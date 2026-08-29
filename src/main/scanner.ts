import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { dirname, extname, basename, join, relative } from 'path'
import { createHash } from 'crypto'
import type { Library, Artist, Album, Song } from '../renderer/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.alac', '.m4a', '.aac', '.ogg', '.wma', '.aiff', '.ape', '.opus'])
const COVER_NAMES = ['cover', 'folder', 'album', 'artwork', 'front']
const IMAGE_EXTS   = ['.jpg', '.jpeg', '.png', '.webp']
const ARTIST_IMAGE_NAMES = ['artist', 'photo', 'profile', 'avatar', 'folder']
const UNKNOWN_ARTIST = 'Unknown Artist'
const UNKNOWN_ALBUM = 'Unknown Album'
const MIN_ALBUM_TRACKS = 3

interface OrganizeMove {
  from: string
  to: string
}

interface OrganizeMoveLog {
  createdAt: string
  musicPath: string
  moves: OrganizeMove[]
  undone?: boolean
}

function makeMediaUrl(filePath: string): string {
  return `muze-media://track/${encodeURIComponent(filePath)}`
}

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

function isDiscFolder(name: string): boolean {
  return /^(?:cd|disc|disk|volume|vol)\s*\d+$/i.test(name.trim())
}

function isProperlyStructured(musicPath: string, filePath: string): boolean {
  const segments = relative(musicPath, filePath).split(/[\\/]+/).filter(Boolean)
  if (segments.length === 3) return true
  return segments.length === 4 && isDiscFolder(segments[2])
}

async function organizeLooseTracks(musicPath: string, moveLogPath?: string): Promise<void> {
  const { parseFile } = await import('music-metadata')
  const audioFiles = collectAudioFiles(musicPath)
  const candidates: Array<{
    filePath: string
    artistFolder: string
    albumFolder: string
    discFolder?: string
  }> = []
  const groupCounts = new Map<string, number>()

  function addGroupCount(artistFolder: string, albumFolder: string) {
    const key = `${artistFolder}\u0000${albumFolder}`
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1)
  }

  for (const filePath of audioFiles) {
    const structuredSegments = relative(musicPath, filePath).split(/[\\/]+/).filter(Boolean)
    if (isProperlyStructured(musicPath, filePath)) {
      const [artistFolder, albumFolder] = structuredSegments
      addGroupCount(artistFolder, albumFolder)
      continue
    }

    const relSegments = relative(musicPath, filePath).split(/[\\/]+/).filter(Boolean)
    const parentName = relSegments.length > 1 ? relSegments[relSegments.length - 2] : undefined
    const grandParentName = relSegments.length > 2 ? relSegments[relSegments.length - 3] : undefined

    let artistName = grandParentName ?? parentName ?? UNKNOWN_ARTIST
    let albumName = parentName && parentName !== artistName ? parentName : UNKNOWN_ALBUM
    let discNumber: number | undefined

    try {
      const meta = await parseFile(filePath, { duration: false, skipCovers: true })
      artistName = meta.common.albumartist || meta.common.artist || artistName
      albumName = meta.common.album || albumName
      discNumber = meta.common.disk?.no ?? undefined
    } catch { /* use path-derived fallback names */ }

    const artistFolder = sanitizeFolderName(artistName, UNKNOWN_ARTIST)
    const albumFolder = sanitizeFolderName(albumName, UNKNOWN_ALBUM)
    const discFolder = discNumber ? `Disc ${discNumber}` : undefined
    candidates.push({ filePath, artistFolder, albumFolder, discFolder })
    addGroupCount(artistFolder, albumFolder)
  }

  const moves: OrganizeMove[] = []

  for (const candidate of candidates) {
    const key = `${candidate.artistFolder}\u0000${candidate.albumFolder}`
    const isSparseAlbum = (groupCounts.get(key) ?? 0) < MIN_ALBUM_TRACKS
    const targetDir = isSparseAlbum
      ? join(musicPath, candidate.artistFolder)
      : join(musicPath, candidate.artistFolder, candidate.albumFolder, ...(candidate.discFolder ? [candidate.discFolder] : []))
    const targetPath = getUniquePath(join(targetDir, basename(candidate.filePath)))

    if (!isInside(musicPath, targetPath)) continue
    if (targetPath === candidate.filePath) continue

    moves.push({ from: candidate.filePath, to: targetPath })
  }

  if (moves.length === 0) return

  if (moveLogPath) {
    const log: OrganizeMoveLog = {
      createdAt: new Date().toISOString(),
      musicPath,
      moves,
    }
    writeFileSync(moveLogPath, JSON.stringify(log, null, 2))
  }

  for (const move of moves) {
    mkdirSync(dirname(move.to), { recursive: true })
    renameSync(move.from, move.to)
  }
}

export function undoLastOrganize(moveLogPath: string): { restored: number; skipped: number } {
  if (!existsSync(moveLogPath)) throw new Error('No organize history found.')

  const log = JSON.parse(readFileSync(moveLogPath, 'utf8')) as OrganizeMoveLog
  if (log.undone) throw new Error('The last organize batch has already been undone.')

  let restored = 0
  let skipped = 0

  for (const move of [...log.moves].reverse()) {
    if (!existsSync(move.to) || existsSync(move.from)) {
      skipped += 1
      continue
    }
    mkdirSync(dirname(move.from), { recursive: true })
    renameSync(move.to, move.from)
    restored += 1
  }

  writeFileSync(moveLogPath, JSON.stringify({ ...log, undone: true, undoneAt: new Date().toISOString() }, null, 2))
  return { restored, skipped }
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

  const mediaUrl = makeMediaUrl(filePath)
  let discNumber: number | null = null
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
    if (common.disk?.no) discNumber = common.disk.no
    if (common.track?.no) trackNumber = common.track.no
    if (fmt.duration) duration = Math.round(fmt.duration)
    if (fmt.bitrate) bitrate = Math.round(fmt.bitrate / 1000)
    if (fmt.sampleRate) sampleRate = fmt.sampleRate
    if (fmt.numberOfChannels) channels = fmt.numberOfChannels
    if (fmt.container) format = fmt.container.toLowerCase()
  } catch { /* use filename-derived values */ }

  if (discNumber == null) {
    const parentFolder = basename(dirname(filePath))
    const discMatch = parentFolder.match(/^(?:cd|disc|disk|volume|vol)\s*(\d+)$/i)
    if (discMatch) discNumber = parseInt(discMatch[1])
  }

  return { id, filePath, mediaUrl, fileName, title, discNumber, trackNumber, duration, format, bitrate, sampleRate, channels, artistId, albumId, playCount: 0 }
}

async function scanAlbum(folderPath: string, artistId: string, artistName: string): Promise<Album | null> {
  let entries: string[]
  try { entries = readdirSync(folderPath) } catch { return null }

  const audioFiles = entries
    .filter(name => {
      try { return statSync(join(folderPath, name)).isFile() && isAudioFile(name) } catch { return false }
    })
    .map(name => join(folderPath, name))
  const discAudioFiles = entries
    .filter(name => {
      try { return statSync(join(folderPath, name)).isDirectory() && isDiscFolder(name) } catch { return false }
    })
    .flatMap(name => {
      const discPath = join(folderPath, name)
      try {
        return readdirSync(discPath)
          .filter(isAudioFile)
          .map(file => join(discPath, file))
      } catch {
        return []
      }
    })
  const allAudioFiles = [...audioFiles, ...discAudioFiles].sort()
  if (allAudioFiles.length === 0) return null

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
  for (let i = 0; i < allAudioFiles.length; i += BATCH) {
    const results = await Promise.all(
      allAudioFiles.slice(i, i + BATCH).map(f => parseSongMetadata(f, artistId, albumId))
    )
    songs.push(...results)
  }

  songs.sort((a, b) => {
    const discA = a.discNumber ?? 1
    const discB = b.discNumber ?? 1
    if (discA !== discB) return discA - discB
    if (a.trackNumber != null && b.trackNumber != null) return a.trackNumber - b.trackNumber
    if (a.trackNumber != null) return -1
    if (b.trackNumber != null) return 1
    return a.fileName.localeCompare(b.fileName)
  })

  return { id: albumId, folderPath, name, artistId, artistName, year, coverPath, songs }
}

export async function scanLibrary(musicPath: string, moveLogPath?: string, organize = true): Promise<Library> {
  if (!existsSync(musicPath)) throw new Error(`Music folder not found: ${musicPath}`)
  if (organize) await organizeLooseTracks(musicPath, moveLogPath)

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
    const looseSongs: Song[] = []
    const singlesId = makeId(artistPath + '/__singles__')

    for (const albumFolder of albumFolders.sort()) {
      const album = await scanAlbum(join(artistPath, albumFolder), artistId, artistName)
      if (!album) continue
      if (album.songs.length < MIN_ALBUM_TRACKS) {
        looseSongs.push(...album.songs.map(song => ({ ...song, albumId: singlesId })))
      } else {
        albums.push(album)
      }
    }

    const rootAudioFiles = subEntries.filter(isAudioFile)
    if (rootAudioFiles.length > 0) {
      for (const f of rootAudioFiles) {
        looseSongs.push(await parseSongMetadata(join(artistPath, f), artistId, singlesId))
      }
    }

    if (looseSongs.length > 0) {
      looseSongs.sort((a, b) => a.title.localeCompare(b.title))
      albums.unshift({ id: singlesId, folderPath: artistPath, name: "Singles & Loose Tracks", artistId, artistName, songs: looseSongs, isSinglesCollection: true })
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
