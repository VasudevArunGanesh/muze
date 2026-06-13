import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { formatDuration } from '../../utils/format'
import type { Song } from '../../types'

export function RecentView() {
  const { getAllSongs } = useLibraryStore()
  const { playSong, currentSong } = usePlayerStore()
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    window.muze.getRecentlyPlayed(50).then(rows => {
      setRecentIds(rows.map(r => r.song_id))
    })
  }, [currentSong]) // refresh when song changes

  const allSongs = getAllSongs()
  const songMap = new Map(allSongs.map(s => [s.id, s]))

  // Deduplicate: show each song only once (most recent occurrence)
  const seen = new Set<string>()
  const recentSongs: Song[] = []
  for (const id of recentIds) {
    if (!seen.has(id)) {
      const song = songMap.get(id)
      if (song) { recentSongs.push(song); seen.add(id) }
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden auto', padding: 28 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Recently played</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>Your listening history</p>
      </div>

      {recentSongs.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>◷</div>
          <p>No history yet — start playing!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recentSongs.map((song, i) => (
            <div
              key={song.id + i}
              onDoubleClick={() => playSong(song, recentSongs)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '9px 14px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', transition: 'background var(--transition)',
                background: currentSong?.id === song.id ? 'var(--accent-glow)' : 'transparent'
              }}
              onMouseEnter={e => { if (currentSong?.id !== song.id) e.currentTarget.style.background = 'var(--bg-elevated)' }}
              onMouseLeave={e => { if (currentSong?.id !== song.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12, width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: currentSong?.id === song.id ? 500 : 400, color: currentSong?.id === song.id ? 'var(--accent)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {song.title}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDuration(song.duration)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
