import { useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { clearCoverArtCache, useCoverArt } from '../../hooks/useCoverArt'
import { AlbumDetailView } from './AlbumDetailView'
import { formatDuration, pluralise } from '../../utils/format'
import type { Artist, Album, Song } from '../../types'

export function ArtistView() {
  const { getFilteredArtists, selectedArtist, selectedAlbum, selectArtist, selectAlbum } = useLibraryStore()
  const artists = getFilteredArtists()

  if (selectedAlbum) return <AlbumDetailView album={selectedAlbum} onBack={() => selectAlbum(null)} />
  if (selectedArtist) return <ArtistDetailView artist={selectedArtist} onBack={() => selectArtist(null)} onAlbumSelect={selectAlbum} />

  return (
    <div style={{ flex: 1, overflow: 'hidden auto', padding: '28px 32px' }} className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>Artists</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{pluralise(artists.length, 'artist')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {artists.map(a => <ArtistRow key={a.id} artist={a} onClick={() => selectArtist(a)} />)}
      </div>
      {artists.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>♪</div>
          <p>No artists found</p>
        </div>
      )}
    </div>
  )
}

function ArtistRow({ artist, onClick }: { artist: Artist; onClick: () => void }) {
  const imageSrc = useCoverArt(artist.imagePath)
  const totalDuration = artist.albums.flatMap(a => a.songs).reduce((n, s) => n + s.duration, 0)
  const [hovered, setHovered] = useState(false)
  const { updateArtistImage } = useLibraryStore()

  async function changeArtistImage(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await window.muze.chooseLibraryImage(artist.folderPath, 'artist')
    if (!result.success) return
    clearCoverArtCache(artist.imagePath)
    clearCoverArtCache(result.imagePath)
    updateArtistImage(artist.id, result.imagePath)
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 12px', borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer', transition: 'background var(--transition)'
      }}
    >
      <div
        onContextMenu={changeArtistImage}
        title="Right-click to choose artist image"
        style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {imageSrc
          ? <img src={imageSrc} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{artist.name.charAt(0).toUpperCase()}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {pluralise(artist.albums.filter(a => !a.isSinglesCollection).length, 'album')} · {pluralise(artist.songCount, 'song')}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatDuration(totalDuration)}</div>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 16, opacity: hovered ? 1 : 0, transition: 'opacity var(--transition)' }}>›</span>
    </div>
  )
}

// ── Artist detail — split view ───────────────────────────────────────────────
function ArtistDetailView({ artist, onBack, onAlbumSelect }: {
  artist: Artist; onBack: () => void; onAlbumSelect: (album: Album) => void
}) {
  const imageSrc = useCoverArt(artist.imagePath)
  const { playAlbum, playSong } = usePlayerStore()
  const { updateArtistImage } = useLibraryStore()

  const singlesAlbum = artist.albums.find(a => a.isSinglesCollection)
  const regularAlbums = artist.albums.filter(a => !a.isSinglesCollection)
  const hasSingles = !!singlesAlbum && singlesAlbum.songs.length > 0

  function playAll() {
    const allSongs = artist.albums.flatMap(a => a.songs)
    if (allSongs.length > 0) playAlbum(allSongs, 0)
  }

  async function changeArtistImage(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await window.muze.chooseLibraryImage(artist.folderPath, 'artist')
    if (!result.success) return
    clearCoverArtCache(artist.imagePath)
    clearCoverArtCache(result.imagePath)
    updateArtistImage(artist.id, result.imagePath)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="fade-in">

      {/* Back */}
      <div style={{ padding: '16px 28px 0', flexShrink: 0 }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 10 }}>
          ‹ Artists
        </button>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, padding: '16px 32px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div
          onContextMenu={changeArtistImage}
          title="Right-click to choose artist image"
          style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {imageSrc
            ? <img src={imageSrc} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--accent)' }}>{artist.name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Artist</p>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 7 }}>{artist.name}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 14 }}>
            {pluralise(regularAlbums.length, 'album')} · {pluralise(artist.songCount, 'song')}
            {hasSingles ? ` · ${pluralise(singlesAlbum!.songs.length, 'loose track')}` : ''}
          </p>
          <button className="btn-primary" onClick={playAll}>▶&nbsp; Play all</button>
        </div>
      </div>

      {/* ── Split body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Loose tracks (only rendered if they exist) */}
        {hasSingles && (
          <div style={{
            width: 280, minWidth: 280,
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 20px 10px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Loose tracks
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                {pluralise(singlesAlbum!.songs.length, 'track')}
              </p>
            </div>
            <div style={{ flex: 1, overflow: 'hidden auto' }}>
              {singlesAlbum!.songs.map((song, i) => (
                <LooseTrackRow
                  key={song.id}
                  song={song}
                  index={i}
                  allSongs={singlesAlbum!.songs}
                />
              ))}
            </div>
          </div>
        )}

        {/* RIGHT — Albums grid */}
        <div style={{ flex: 1, overflow: 'hidden auto', padding: '20px 28px' }}>
          {regularAlbums.length > 0 ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 18 }}>
                Albums
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 20 }}>
                {regularAlbums.map(album => (
                  <AlbumCard key={album.id} album={album} onClick={() => onAlbumSelect(album)} />
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No albums found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Loose track row (compact, no rating column) ──────────────────────────────
function LooseTrackRow({ song, index, allSongs }: { song: Song; index: number; allSongs: Song[] }) {
  const { playSong, currentSong, isPlaying } = usePlayerStore()
  const [hovered, setHovered] = useState(false)
  const isCurrent = currentSong?.id === song.id
  const isCurrentPlaying = isCurrent && isPlaying

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => playSong(song, allSongs)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 20px',
        background: isCurrent ? 'var(--accent-glow)' : hovered ? 'var(--bg-elevated)' : 'transparent',
        cursor: 'pointer', transition: 'background var(--transition)'
      }}
    >
      <div style={{ width: 20, textAlign: 'center', fontSize: 12, flexShrink: 0 }}>
        {hovered
          ? <button onClick={() => playSong(song, allSongs)} style={{ fontSize: 11, color: 'var(--text-primary)' }}>▶</button>
          : isCurrentPlaying
            ? <span style={{ color: 'var(--accent)', fontSize: 11 }}>▶</span>
            : <span style={{ color: 'var(--text-tertiary)' }}>{index + 1}</span>
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: isCurrent ? 600 : 400,
          color: isCurrent ? 'var(--accent)' : 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {song.title}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {formatDuration(song.duration)}
      </div>
    </div>
  )
}

// ── Album card ───────────────────────────────────────────────────────────────
function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  const coverSrc = useCoverArt(album.coverPath)
  const [hovered, setHovered] = useState(false)
  const { playAlbum } = usePlayerStore()
  const { updateAlbumCover } = useLibraryStore()

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
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ cursor: 'pointer' }}>
      <div
        onContextMenu={changeAlbumCover}
        title="Right-click to choose album cover"
        style={{
        width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        overflow: 'hidden', position: 'relative',
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform var(--transition), box-shadow var(--transition)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.5)' : 'none'
      }}>
        {coverSrc
          ? <img src={coverSrc} alt={album.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: 'var(--text-tertiary)' }}>♫</div>
        }
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); playAlbum(album.songs, 0) }}
            style={{ position: 'absolute', bottom: 8, right: 8, width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', color: '#000', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
          >▶</button>
        )}
      </div>
      <div style={{ marginTop: 9, padding: '0 2px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
          {album.year ? `${album.year} · ` : ''}{pluralise(album.songs.length, 'song')}
        </div>
      </div>
    </div>
  )
}
