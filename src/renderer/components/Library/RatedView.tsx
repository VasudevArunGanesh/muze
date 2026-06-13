import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { formatDuration } from '../../utils/format'
import type { Song } from '../../types'

export function RatedView() {
  const { getAllSongs } = useLibraryStore()
  const { playSong } = usePlayerStore()

  const ratedSongs = getAllSongs()
    .filter(s => s.rating && s.rating > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  return (
    <div style={{ flex: 1, overflow: 'hidden auto', padding: 28 }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Rated songs</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 4 }}>
          {ratedSongs.length} rated · double-click to play
        </p>
      </div>

      {ratedSongs.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>★</div>
          <p>No rated songs yet.</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Click the star on any track to rate it.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ratedSongs.map(song => (
            <RatedRow key={song.id} song={song} onPlay={() => playSong(song, ratedSongs)} />
          ))}
        </div>
      )}
    </div>
  )
}

function RatedRow({ song, onPlay }: { song: Song; onPlay: () => void }) {
  const stars = song.rating ?? 0

  return (
    <div
      onDoubleClick={onPlay}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '9px 14px', borderRadius: 'var(--radius-md)',
        cursor: 'pointer', transition: 'background var(--transition)'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ color: '#EF9F27', fontSize: 13, minWidth: 80, letterSpacing: 2 }}>
        {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
        {song.review && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            "{song.review}"
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDuration(song.duration)}</div>
    </div>
  )
}
