import { useState, useEffect } from 'react'
import { clearCoverArtCache, useCoverArt } from '../../hooks/useCoverArt'
import { usePlayerStore } from '../../store/playerStore'
import { useLibraryStore } from '../../store/libraryStore'
import { RatingWidget } from '../Rating/RatingWidget'
import { formatDuration, getFormatColor, pluralise } from '../../utils/format'
import type { Album, Song } from '../../types'

interface Props { album: Album; onBack: () => void }

export function AlbumDetailView({ album, onBack }: Props) {
  const coverSrc = useCoverArt(album.coverPath)
  const { playSong, playAlbum, currentSong, isPlaying } = usePlayerStore()
  const { updateAlbumCover, updateAlbumRating } = useLibraryStore()
  const [albumRating, setAlbumRating] = useState(0)
  const [showRatingPanel, setShowRatingPanel] = useState(false)

  const totalDuration = album.songs.reduce((n, s) => n + s.duration, 0)

  useEffect(() => {
    window.muze.getAlbumRating(album.id).then(r => { if (r) setAlbumRating(r.rating) })
  }, [album.id])

  async function handleAlbumRate(rating: number, review: string) {
    await window.muze.saveAlbumRating(album.id, rating, review)
    setAlbumRating(rating)
    updateAlbumRating(album.id, rating, review)
    setShowRatingPanel(false)
  }

  async function changeAlbumCover(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await window.muze.chooseLibraryImage(album.folderPath, 'album')
    if (!result.success) return
    clearCoverArtCache(album.coverPath)
    clearCoverArtCache(result.imagePath)
    updateAlbumCover(album.id, result.imagePath)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-in">

      {/* ── Back button row — properly placed, not absolute ── */}
      <div style={{ padding: '16px 28px 0', flexShrink: 0 }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 10 }}>
          ‹ Back
        </button>
      </div>

      {/* ── Hero ── */}
      <div style={{
        padding: '16px 32px 24px',
        display: 'flex', alignItems: 'flex-end', gap: 24,
        borderBottom: '1px solid var(--border)', flexShrink: 0
      }}>
        <div
          onContextMenu={changeAlbumCover}
          title="Right-click to choose album cover"
          style={{
          width: 128, height: 128, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          overflow: 'hidden', flexShrink: 0,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
        }}>
          {coverSrc
            ? <img src={coverSrc} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, color: 'var(--text-tertiary)' }}>♫</div>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Album</p>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6, lineHeight: 1.15 }}>{album.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 18 }}>
            {album.artistName}
            {album.year ? ` · ${album.year}` : ''}
            {` · ${pluralise(album.songs.length, 'song')}`}
            {` · ${formatDuration(totalDuration)}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => playAlbum(album.songs, 0)}>▶&nbsp; Play</button>
            <button className="btn-ghost" onClick={() => {
              const shuffled = [...album.songs].sort(() => Math.random() - 0.5)
              playAlbum(shuffled, 0)
            }}>⇄&nbsp; Shuffle</button>
            <button className="btn-ghost" onClick={() => setShowRatingPanel(!showRatingPanel)}
              style={{ color: albumRating > 0 ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {albumRating > 0 ? `★ ${albumRating}/5` : '☆ Rate album'}
            </button>
          </div>
        </div>
      </div>

      {/* Rating panel */}
      {showRatingPanel && (
        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <RatingWidget itemType="album" itemId={album.id} initialRating={albumRating} onSave={handleAlbumRate} onCancel={() => setShowRatingPanel(false)} label={album.name} />
        </div>
      )}

      {/* Track list header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr 90px 60px 56px',
        gap: 8, padding: '8px 32px',
        borderBottom: '1px solid var(--border)',
        fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        position: 'sticky', top: 0, background: 'var(--bg-base)', zIndex: 1, flexShrink: 0
      }}>
        <span style={{ textAlign: 'center' }}>#</span>
        <span>Title</span>
        <span style={{ textAlign: 'right' }}>Rating</span>
        <span style={{ textAlign: 'right' }}>Time</span>
        <span style={{ textAlign: 'center' }}>Format</span>
      </div>

      {/* Track list */}
      <div style={{ flex: 1, overflow: 'hidden auto' }}>
        {album.songs.map((song, i) => (
          <TrackRow
            key={song.id} song={song} index={i}
            isCurrentSong={currentSong?.id === song.id}
            isPlaying={currentSong?.id === song.id && isPlaying}
            onPlay={() => playSong(song, album.songs)}
          />
        ))}
      </div>
    </div>
  )
}

function TrackRow({ song, index, isCurrentSong, isPlaying, onPlay }: {
  song: Song; index: number
  isCurrentSong: boolean; isPlaying: boolean; onPlay: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [songRating, setSongRating] = useState(song.rating ?? 0)
  const [showRating, setShowRating] = useState(false)
  const { updateSongRating } = useLibraryStore()

  async function handleRateSong(rating: number, review: string) {
    await window.muze.saveSongRating(song.id, rating, review)
    setSongRating(rating)
    updateSongRating(song.id, rating, review)
    setShowRating(false)
  }

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={onPlay}
        style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 90px 60px 56px',
          gap: 8, padding: '9px 32px', alignItems: 'center',
          background: isCurrentSong ? 'var(--accent-glow)' : hovered ? 'var(--bg-elevated)' : 'transparent',
          cursor: 'pointer', transition: 'background var(--transition)'
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 12 }}>
          {hovered
            ? <button onClick={onPlay} style={{ color: 'var(--text-primary)', fontSize: 12 }}>▶</button>
            : isPlaying
              ? <span style={{ color: 'var(--accent)', fontSize: 12 }}>▶</span>
              : <span style={{ color: 'var(--text-tertiary)' }}>{song.trackNumber ?? index + 1}</span>
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: isCurrentSong ? 600 : 400,
            fontSize: 14,
            color: isCurrentSong ? 'var(--accent)' : 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {song.title}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={() => setShowRating(!showRating)}
            style={{ fontSize: 12, color: songRating > 0 ? '#EF9F27' : 'var(--text-tertiary)', letterSpacing: 1 }}
          >
            {songRating > 0 ? '★'.repeat(songRating) + '☆'.repeat(5 - songRating) : hovered ? '☆☆☆☆☆' : ''}
          </button>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
          {formatDuration(song.duration)}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: getFormatColor(song.format), fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            {song.format.toUpperCase().slice(0, 4)}
          </span>
        </div>
      </div>

      {showRating && (
        <div style={{ padding: '10px 72px 14px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <RatingWidget itemType="song" itemId={song.id} initialRating={songRating} onSave={handleRateSong} onCancel={() => setShowRating(false)} label={song.title} compact />
        </div>
      )}
    </>
  )
}
