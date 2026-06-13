import { useRef, useCallback, useState } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { useCoverArt } from '../../hooks/useCoverArt'
import { useLibraryStore } from '../../store/libraryStore'
import { useNavStore } from '../../store/navStore'
import { formatDuration } from '../../utils/format'

export function PlayerBar() {
  const {
    currentSong, isPlaying, currentTime, duration,
    volume, shuffle, repeat,
    togglePlay, next, prev, seek, setVolume,
    toggleShuffle, cycleRepeat
  } = usePlayerStore()

  const { library, selectArtist, selectAlbum } = useLibraryStore()
  const { navigateTo } = useNavStore()

  // Resolve album + artist for the current song
  const artist = currentSong ? library?.artists.find(a => a.id === currentSong.artistId) ?? null : null
  const album  = currentSong ? artist?.albums.find(a => a.id === currentSong.albumId) ?? null : null

  // Cover art: prefer album cover, fall back to artist image
  const albumCover  = useCoverArt(album?.coverPath)
  const artistImage = useCoverArt(artist?.imagePath)
  const coverSrc    = albumCover ?? artistImage   // ← fallback here

  const progressRef = useRef<HTMLDivElement>(null)

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    seek(Math.max(0, Math.min(duration, ((e.clientX - rect.left) / rect.width) * duration)))
  }, [duration, seek])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Navigate to artist page
  function goToArtist() {
    if (!artist) return
    selectArtist(artist)
    selectAlbum(null)
    navigateTo('artists')
  }

  // Navigate to album (or artist if single/no album)
  function goToSong() {
    if (!artist) return
    selectArtist(artist)
    if (album && !album.isSinglesCollection) {
      selectAlbum(album)
    } else {
      selectAlbum(null)
    }
    navigateTo('artists')
  }

  return (
    <div style={{
      height: 88,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 20,
      flexShrink: 0, position: 'relative'
    }}>
      {/* ── Progress scrubber (top edge) ── */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        style={{
          position: 'absolute', top: -1, left: 0, right: 0,
          height: 4, cursor: 'pointer',
          background: 'var(--border)',
          transition: 'height var(--transition)'
        }}
        onMouseEnter={e => (e.currentTarget.style.height = '6px')}
        onMouseLeave={e => (e.currentTarget.style.height = '4px')}
      >
        <div style={{
          height: '100%', width: `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.5s linear',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 4px var(--accent)'
          }} />
        </div>
      </div>

      {/* ── Now playing ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: 240, flexShrink: 0 }}>
        {/* Cover — clicking goes to album */}
        <button
          onClick={goToSong}
          disabled={!currentSong}
          title={album ? `Go to ${album.name}` : undefined}
          style={{
            width: 54, height: 54, borderRadius: 10, flexShrink: 0,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            overflow: 'hidden', padding: 0, cursor: currentSong ? 'pointer' : 'default',
            transition: 'opacity var(--transition)'
          }}
          onMouseEnter={e => { if (currentSong) e.currentTarget.style.opacity = '0.8' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          {coverSrc
            ? <img src={coverSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--text-tertiary)' }}>♫</div>
          }
        </button>

        <div style={{ minWidth: 0 }}>
          {/* Song title → opens album page */}
          <NowPlayingLink
            onClick={goToSong}
            active={!!currentSong}
            style={{ fontWeight: 600, fontSize: 14, color: currentSong ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            {currentSong?.title ?? 'Nothing playing'}
          </NowPlayingLink>

          {/* Artist name → opens artist page */}
          {currentSong && (
            <NowPlayingLink
              onClick={goToArtist}
              active
              style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}
            >
              {artist?.name ?? ''}
            </NowPlayingLink>
          )}
        </div>
      </div>

      {/* ── Controls (centred) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Shuffle */}
          <Ctrl onClick={toggleShuffle} title="Shuffle" active={shuffle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </Ctrl>

          {/* Prev */}
          <Ctrl onClick={prev} title="Previous (Ctrl+←)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </Ctrl>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            style={{
              width: 48, height: 48, borderRadius: '50%',
              background: currentSong ? 'var(--accent)' : 'var(--bg-elevated)',
              border: 'none',
              color: currentSong ? '#000' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: currentSong ? 'pointer' : 'default',
              boxShadow: currentSong ? '0 2px 12px var(--accent-dim)' : 'none',
              transition: 'transform var(--transition), opacity var(--transition)'
            }}
            onMouseEnter={e => { if (currentSong) e.currentTarget.style.transform = 'scale(1.06)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {isPlaying
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z"/></svg>
            }
          </button>

          {/* Next */}
          <Ctrl onClick={next} title="Next (Ctrl+→)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/>
            </svg>
          </Ctrl>

          {/* Repeat */}
          <Ctrl onClick={cycleRepeat} title={`Repeat: ${repeat}`} active={repeat !== 'none'}>
            {repeat === 'one'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  <text x="10" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text>
                </svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
            }
          </Ctrl>
        </div>

        {/* Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span style={{ minWidth: 34, textAlign: 'right' }}>{formatDuration(currentTime)}</span>
          <span>·</span>
          <span style={{ minWidth: 34 }}>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* ── Volume ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 130, flexShrink: 0, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </span>
        <input
          type="range" min={0} max={1} step={0.01} value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          style={{ width: 80, accentColor: 'var(--accent)', cursor: 'pointer', height: 3 }}
        />
      </div>
    </div>
  )
}

// Inline clickable text for now-playing area
function NowPlayingLink({ children, onClick, active, style }: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  style?: React.CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={!active}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        cursor: active ? 'pointer' : 'default',
        textDecoration: hovered && active ? 'underline' : 'none',
        textUnderlineOffset: 2,
        transition: 'color var(--transition)',
        ...style,
        color: hovered && active
          ? 'var(--accent)'
          : (style?.color ?? 'var(--text-primary)')
      }}
    >
      {children}
    </button>
  )
}

// Icon control button
function Ctrl({ children, onClick, title, active }: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        padding: '6px', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'color var(--transition), background var(--transition)'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-elevated)'
        if (!active) e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = active ? 'var(--accent)' : 'var(--text-secondary)'
      }}
    >
      {children}
    </button>
  )
}
