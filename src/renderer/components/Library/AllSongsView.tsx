import { useState, useMemo } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useNavStore } from '../../store/navStore'
import { usePlayerStore } from '../../store/playerStore'
import { formatDuration, getFormatColor, pluralise } from '../../utils/format'
import type { Song } from '../../types'

type SortCol = 'index' | 'title' | 'artist' | 'duration' | 'rating'
type SortDir = 'asc' | 'desc'

interface ColDef { id: SortCol; label: string; style?: React.CSSProperties }
const COLS: ColDef[] = [
  { id: 'index',    label: '#',            style: { width: 36, textAlign: 'center' } },
  { id: 'title',    label: 'Title',        style: { flex: 1 } },
  { id: 'artist',   label: 'Artist · Album', style: { width: 180 } },
  { id: 'rating',   label: 'Rating',       style: { width: 80, textAlign: 'right' } },
  { id: 'duration', label: 'Time',         style: { width: 56, textAlign: 'right' } },
]

export function AllSongsView() {
  const { getAllSongs, searchQuery, library, selectArtist, selectAlbum } = useLibraryStore()
  const { navigateTo } = useNavStore()
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const [sortCol, setSortCol] = useState<SortCol>('index')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const allSongs = getAllSongs()
  const filtered = searchQuery
    ? allSongs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : allSongs

  function handleColClick(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortCol) {
      case 'title':    arr.sort((a, b) => dir * a.title.localeCompare(b.title)); break
      case 'duration': arr.sort((a, b) => dir * (a.duration - b.duration)); break
      case 'rating':   arr.sort((a, b) => dir * ((a.rating ?? 0) - (b.rating ?? 0))); break
      case 'artist': {
        arr.sort((a, b) => {
          const artA = library?.artists.find(ar => ar.id === a.artistId)?.name ?? ''
          const artB = library?.artists.find(ar => ar.id === b.artistId)?.name ?? ''
          return dir * artA.localeCompare(artB)
        })
        break
      }
      // 'index' = natural order (already filtered order)
    }
    return arr
  }, [filtered, sortCol, sortDir, library])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-in">
      <div style={{ padding: '24px 32px 14px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>Songs</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{pluralise(sorted.length, 'song')}</p>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto' }}>
        {/* Sticky sortable header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 32px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--bg-base)', zIndex: 1,
          flexShrink: 0
        }}>
          {COLS.map(col => (
            <ColHeader
              key={col.id}
              col={col}
              active={sortCol === col.id}
              dir={sortDir}
              onClick={() => handleColClick(col.id)}
            />
          ))}
          {/* Format col — not sortable */}
          <div style={{ width: 48, padding: '8px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
            Format
          </div>
        </div>

        {sorted.map((song, i) => (
          <SongRow
            key={song.id}
            song={song}
            index={i}
            allSongs={sorted}
            isCurrentSong={currentSong?.id === song.id}
            isPlaying={currentSong?.id === song.id && isPlaying}
            onPlay={() => playSong(song, sorted)}
            onArtistClick={() => {
              const artist = library?.artists.find(a => a.id === song.artistId)
              if (artist) { selectArtist(artist); navigateTo('artists') }
            }}
            onAlbumClick={() => {
              const artist = library?.artists.find(a => a.id === song.artistId)
              const album = artist?.albums.find(a => a.id === song.albumId)
              if (artist && album) { selectArtist(artist); selectAlbum(album); navigateTo('artists') }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ColHeader({ col, active, dir, onClick }: { col: ColDef; active: boolean; dir: SortDir; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...col.style,
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '9px 6px 9px 0',
        fontSize: 11, fontWeight: 700,
        color: active ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'color var(--transition)',
        justifyContent: (col.style?.textAlign === 'right') ? 'flex-end' : 'flex-start'
      }}
    >
      {col.label}
      {active && (
        <span style={{ fontSize: 10, color: 'var(--accent)' }}>
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  )
}

function SongRow({ song, index, allSongs, isCurrentSong, isPlaying, onPlay, onArtistClick, onAlbumClick }: {
  song: Song; index: number; allSongs: Song[]
  isCurrentSong: boolean; isPlaying: boolean
  onPlay: () => void; onArtistClick: () => void; onAlbumClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const { library } = useLibraryStore()
  const artist = library?.artists.find(a => a.id === song.artistId)
  const album = artist?.albums.find(a => a.id === song.albumId)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onPlay}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 32px',
        background: isCurrentSong ? 'var(--accent-glow)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer', transition: 'background var(--transition)'
      }}
    >
      {/* # */}
      <div style={{ width: 36, textAlign: 'center', fontSize: 12, flexShrink: 0 }}>
        {hovered
          ? <button onClick={onPlay} style={{ fontSize: 11, color: 'var(--text-primary)' }}>▶</button>
          : isPlaying
            ? <span style={{ color: 'var(--accent)', fontSize: 11 }}>▶</span>
            : <span style={{ color: 'var(--text-tertiary)' }}>{index + 1}</span>
        }
      </div>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <div style={{
          fontWeight: isCurrentSong ? 600 : 400, fontSize: 13,
          color: isCurrentSong ? 'var(--accent)' : 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {song.title}
        </div>
      </div>

      {/* Artist · Album — both clickable */}
      <div style={{ width: 180, display: 'flex', flexWrap: 'nowrap', gap: 4, alignItems: 'center', fontSize: 12, overflow: 'hidden', paddingRight: 8 }}>
        <Hyperlink onClick={onArtistClick}>{artist?.name ?? '—'}</Hyperlink>
        {album && !album.isSinglesCollection && (
          <>
            <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>·</span>
            <Hyperlink onClick={onAlbumClick}>{album.name}</Hyperlink>
          </>
        )}
      </div>

      {/* Rating */}
      <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#EF9F27', flexShrink: 0 }}>
        {song.rating ? '★'.repeat(song.rating) + '☆'.repeat(5 - song.rating) : ''}
      </div>

      {/* Duration */}
      <div style={{ width: 56, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
        {formatDuration(song.duration)}
      </div>

      {/* Format */}
      <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: getFormatColor(song.format), fontFamily: 'var(--font-mono)' }}>
          {song.format.toUpperCase().slice(0, 4)}
        </span>
      </div>
    </div>
  )
}

function Hyperlink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 12, color: hovered ? 'var(--accent)' : 'var(--text-secondary)',
        textDecoration: hovered ? 'underline' : 'none',
        textUnderlineOffset: 2, transition: 'color var(--transition)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        maxWidth: '100%', textAlign: 'left'
      }}
    >
      {children}
    </button>
  )
}
