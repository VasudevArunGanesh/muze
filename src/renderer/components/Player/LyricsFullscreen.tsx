import { useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useLyricsStore } from '../../store/lyricsStore'
import type { LyricsData } from '../../types'

interface SyncedLine {
  time: number
  text: string
}

export function LyricsFullscreen({ onClose }: { onClose: () => void }) {
  const { currentSong, currentTime, seek } = usePlayerStore()
  const { library } = useLibraryStore()
  const { result, isLoading } = useLyricsStore()
  const activeLineRef = useRef<HTMLDivElement | null>(null)

  const artist = currentSong ? library?.artists.find(a => a.id === currentSong.artistId) ?? null : null

  useEffect(() => {
    window.muze.setPlayerFullscreen(true)
    return () => {
      window.muze.setPlayerFullscreen(false)
    }
  }, [])

  const lyrics = result?.success ? result.data : null
  const syncedLines = useMemo(() => parseSyncedLyrics(lyrics?.syncedLyrics), [lyrics?.syncedLyrics])
  const activeIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1
    let low = 0
    let high = syncedLines.length - 1
    let match = 0

    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      if (syncedLines[mid].time <= currentTime + 0.08) {
        match = mid
        low = mid + 1
      } else {
        high = mid - 1
      }
    }

    return match
  }, [currentTime, syncedLines])

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeIndex])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'radial-gradient(circle at top left, var(--accent-glow), transparent 38%), var(--bg-base)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        height: 76,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {artist?.name ?? 'Lyrics'}
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 'min(720px, 70vw)',
          }}>
            {currentSong?.title ?? 'Nothing playing'}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close lyrics"
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </header>

      <main style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {!currentSong && (
          <Message title="Nothing playing" body="Start a song to load lyrics." />
        )}

        {currentSong && isLoading && (
          <Message title="Loading lyrics" body="Asking LRCLIB for a match." />
        )}

        {currentSong && !isLoading && result && !result.success && (
          <Message
            title={result.status === 404 ? 'Lyrics not found' : 'Technical issue'}
            body={result.status === 404
              ? 'LRCLIB could not find lyrics for this song.'
              : 'There was a technical issue loading lyrics. Please try again later.'}
          />
        )}

        {currentSong && !isLoading && lyrics && (
          syncedLines.length > 0
            ? <SyncedLyrics lines={syncedLines} activeIndex={activeIndex} activeLineRef={activeLineRef} onLineClick={seek} />
            : <PlainLyrics lyrics={lyrics} />
        )}
      </main>
    </div>
  )
}

function SyncedLyrics({ lines, activeIndex, activeLineRef, onLineClick }: {
  lines: SyncedLine[]
  activeIndex: number
  activeLineRef: React.MutableRefObject<HTMLDivElement | null>
  onLineClick: (time: number) => void
}) {
  return (
    <div style={{
      width: 'min(900px, 100%)',
      height: '100%',
      overflowY: 'auto',
      padding: '42vh 32px',
      scrollBehavior: 'smooth',
    }}>
      {lines.map((line, index) => {
        const isActive = index === activeIndex
        const isPast = index < activeIndex

        return (
          <div
            key={`${line.time}-${index}`}
            ref={isActive ? activeLineRef : undefined}
            onClick={() => onLineClick(line.time)}
            title="Jump to this lyric"
            style={{
              minHeight: 58,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              fontSize: isActive ? 34 : 24,
              lineHeight: 1.25,
              fontWeight: isActive ? 800 : 500,
              color: isActive ? 'var(--text-primary)' : isPast ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              opacity: isActive ? 1 : isPast ? 0.34 : 0.72,
              cursor: 'pointer',
              transition: 'font-size 180ms ease, opacity 180ms ease, color 180ms ease',
            }}
          >
            {line.text || '\u00A0'}
          </div>
        )
      })}
    </div>
  )
}

function PlainLyrics({ lyrics }: { lyrics: LyricsData }) {
  const text = lyrics.plainLyrics?.trim()

  if (!text) {
    return <Message title="No lyrics available" body="LRCLIB has a match, but it does not include lyric text." />
  }

  return (
    <div style={{
      width: 'min(780px, 100%)',
      height: '100%',
      overflowY: 'auto',
      padding: '56px 32px 80px',
      whiteSpace: 'pre-wrap',
      fontSize: 24,
      lineHeight: 1.65,
      color: 'var(--text-secondary)',
      userSelect: 'text',
    }}>
      {text}
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: 32,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360 }}>{body}</div>
    </div>
  )
}

function parseSyncedLyrics(value?: string | null): SyncedLine[] {
  if (!value) return []

  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)]
      if (matches.length === 0) return []

      const text = line.replace(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim()
      return matches.map((match) => {
        const minutes = Number(match[1])
        const seconds = Number(match[2])
        const fraction = match[3] ? Number(match[3].padEnd(3, '0')) / 1000 : 0
        return { time: minutes * 60 + seconds + fraction, text }
      })
    })
    .sort((a, b) => a.time - b.time)
}
