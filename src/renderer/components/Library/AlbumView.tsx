import { useEffect, useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { useCoverArt } from '../../hooks/useCoverArt'
import { AlbumDetailView } from './AlbumDetailView'
import { useNavStore } from '../../store/navStore'
import { pluralise } from '../../utils/format'
import type { Album } from '../../types'

export function AlbumView() {
  const { getAllAlbums, searchQuery, selectArtist, library } = useLibraryStore()
  const { navigateTo } = useNavStore()
  const [selected, setSelected] = useState<Album | null>(null)

  if (selected) {
    return <AlbumDetailView album={selected} onBack={() => setSelected(null)} />
  }

  const q = searchQuery.toLowerCase()
  const albums = getAllAlbums().filter(a =>
    !a.isSinglesCollection &&
    (!q || a.name.toLowerCase().includes(q) || a.artistName.toLowerCase().includes(q))
  )

  return (
    <div style={{ flex: 1, overflow: 'hidden auto', padding: '28px 32px' }} className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>Albums</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{pluralise(albums.length, 'album')}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 22 }}>
        {albums.map(album => (
          <AlbumGridCard
            key={album.id}
            album={album}
            onClick={() => setSelected(album)}
            onArtistClick={() => {
              const artist = library?.artists.find(a => a.id === album.artistId)
              if (artist) { selectArtist(artist); navigateTo('artists') }
            }}
          />
        ))}
      </div>
    </div>
  )
}

function AlbumGridCard({ album, onClick, onArtistClick }: {
  album: Album
  onClick: () => void
  onArtistClick: () => void
}) {
  const coverSrc = useCoverArt(album.coverPath)
  const [hovered, setHovered] = useState(false)
  const [rating, setRating] = useState<number>(album.avgRating ?? 0)
  const { playAlbum } = usePlayerStore()

  // Load rating from DB on mount
  useEffect(() => {
    window.muze.getAlbumRating(album.id).then(r => { if (r) setRating(r.rating) })
  }, [album.id])

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Cover art */}
      <div
        onClick={onClick}
        style={{
          width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          overflow: 'hidden', position: 'relative', cursor: 'pointer',
          transform: hovered ? 'scale(1.03)' : 'scale(1)',
          transition: 'transform var(--transition), box-shadow var(--transition)',
          boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.55)' : 'none'
        }}
      >
        {coverSrc
          ? <img src={coverSrc} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'var(--text-tertiary)' }}>♫</div>
        }
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); playAlbum(album.songs, 0) }}
            style={{
              position: 'absolute', bottom: 8, right: 8,
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent)', color: '#000',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}
          >▶</button>
        )}
      </div>

      {/* Info row */}
      <div style={{ marginTop: 9, padding: '0 2px' }}>
        {/* Album name + rating on same row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onClick}
            style={{
              flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13,
              color: 'var(--text-primary)', textAlign: 'left',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              transition: 'color var(--transition)'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          >
            {album.name}
          </button>
          {/* Rating badge — only shown if rated */}
          {rating > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              color: '#EF9F27', letterSpacing: 0.5,
              display: 'flex', alignItems: 'center', gap: 2
            }}>
              ★ <span style={{ fontFamily: 'var(--font-mono)' }}>{rating}</span>
            </span>
          )}
        </div>

        {/* Artist name — clickable hyperlink */}
        <button
          onClick={onArtistClick}
          style={{
            fontSize: 12, color: 'var(--text-secondary)', marginTop: 3,
            textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', width: '100%',
            transition: 'color var(--transition)'
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          {album.artistName}{album.year ? ` · ${album.year}` : ''}
        </button>
      </div>
    </div>
  )
}
