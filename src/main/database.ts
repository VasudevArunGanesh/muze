/**
 * Pure JSON database — no native modules, no WASM, no ABI issues.
 * Stores ratings, reviews, and play history in a single JSON file
 * in the user's app data directory.
 */
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

interface SongRating {
  rating: number
  review: string
  updatedAt: string
}

interface AlbumRating {
  rating: number
  review: string
  updatedAt: string
}

interface PlayEntry {
  songId: string
  playedAt: string
}

interface SongStats {
  playCount: number
  lastPlayed: string
}

interface DbData {
  songRatings: Record<string, SongRating>
  albumRatings: Record<string, AlbumRating>
  playHistory: PlayEntry[]         // chronological, newest last
  songStats: Record<string, SongStats>
}

const EMPTY_DB: DbData = {
  songRatings: {},
  albumRatings: {},
  playHistory: [],
  songStats: {}
}

let data: DbData = EMPTY_DB
let dbFilePath = ''

function getDbPath(): string {
  return join(app.getPath('userData'), 'muze-db.json')
}

function persist(): void {
  writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8')
}

export function initDatabase(): void {
  dbFilePath = getDbPath()
  if (existsSync(dbFilePath)) {
    try {
      data = JSON.parse(readFileSync(dbFilePath, 'utf8'))
      // Ensure all keys exist (handles upgrades from older schema)
      data.songRatings  ??= {}
      data.albumRatings ??= {}
      data.playHistory  ??= []
      data.songStats    ??= {}
    } catch {
      data = { ...EMPTY_DB }
    }
  } else {
    data = { ...EMPTY_DB }
    persist()
  }
}

// ── Song ratings ────────────────────────────────────────────────────────────

export function getSongRating(songId: string): { rating: number; review: string } | null {
  const entry = data.songRatings[songId]
  if (!entry) return null
  return { rating: entry.rating, review: entry.review }
}

export function saveSongRating(songId: string, rating: number, review: string): void {
  data.songRatings[songId] = { rating, review, updatedAt: new Date().toISOString() }
  persist()
}

// ── Album ratings ────────────────────────────────────────────────────────────

export function getAlbumRating(albumId: string): { rating: number; review: string } | null {
  const entry = data.albumRatings[albumId]
  if (!entry) return null
  return { rating: entry.rating, review: entry.review }
}

export function saveAlbumRating(albumId: string, rating: number, review: string): void {
  data.albumRatings[albumId] = { rating, review, updatedAt: new Date().toISOString() }
  persist()
}

// ── Play history ─────────────────────────────────────────────────────────────

export function recordPlay(songId: string): void {
  const now = new Date().toISOString()
  data.playHistory.push({ songId, playedAt: now })

  // Keep history bounded to last 5000 entries
  if (data.playHistory.length > 5000) {
    data.playHistory = data.playHistory.slice(-5000)
  }

  const stats = data.songStats[songId]
  if (stats) {
    stats.playCount++
    stats.lastPlayed = now
  } else {
    data.songStats[songId] = { playCount: 1, lastPlayed: now }
  }

  persist()
}

export function getRecentlyPlayed(limit: number): Array<{ song_id: string; played_at: string }> {
  return data.playHistory
    .slice()
    .reverse()
    .slice(0, limit)
    .map(e => ({ song_id: e.songId, played_at: e.playedAt }))
}
