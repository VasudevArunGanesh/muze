import { useEffect, useMemo, useRef } from 'react'
import { useDownloadStore } from '../../store/downloadStore'
import { useLibraryStore } from '../../store/libraryStore'
import { formatDuration } from '../../utils/format'
import type { YoutubeVideoInfo, YoutubePlaylistDownloadResult } from '../../types'

interface Props {
  musicPath: string
}

export function YoutubeDownloadModal({ musicPath }: Props) {
  const store = useDownloadStore()
  const { library } = useLibraryStore()
  const urlInputRef = useRef<HTMLInputElement>(null)

  const {
    isOpen, stage, url, videoInfo,
    title, artist, album, error, progress, result,
    playlistProgress, playlistResult,
  } = store

  const isBusy = stage === 'downloading' || stage === 'tagging' || stage === 'playlist-downloading'

  // Suggest existing albums for whatever artist name is currently typed,
  // so a downloaded track can land in an album that's already in the library.
  const knownAlbums = useMemo(() => {
    const match = library?.artists.find(
      a => a.name.toLowerCase() === artist.trim().toLowerCase()
    )
    return match?.albums.filter(a => !a.isSinglesCollection).map(a => a.name) ?? []
  }, [library, artist])

  const destinationPreview = artist.trim()
    ? `${artist.trim()}/${album.trim() ? album.trim() + '/' : ''}${title.trim() || 'Untitled'}.mp3`
    : ''

  useEffect(() => {
    if (isOpen && (stage === 'idle')) {
      requestAnimationFrame(() => urlInputRef.current?.focus())
    }
  }, [isOpen, stage])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isBusy) handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isBusy])

  if (!isOpen) return null

  function handleClose() {
    if (isBusy) store.cancelDownload()
    store.close()
  }

  return (
    <>
      <div
        onClick={isBusy ? undefined : handleClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 301, width: 480, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 64px)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'ytModalIn 160ms ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Download from YouTube
          </h2>
          <button
            onClick={handleClose}
            title={isBusy ? 'Cancel and close' : 'Close'}
            style={{ fontSize: 16, color: 'var(--text-tertiary)', padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          {(stage === 'idle' || stage === 'fetching') && (
            <UrlStep urlInputRef={urlInputRef} />
          )}
          {stage === 'link-choice' && <LinkChoiceStep />}
          {stage === 'fetching-playlist' && <PlaylistFetchingStep />}
          {stage === 'preview' && videoInfo && (
            <PreviewStep
              videoInfo={videoInfo}
              title={title}
              artist={artist}
              album={album}
              knownAlbums={knownAlbums}
              destinationPreview={destinationPreview}
              musicPath={musicPath}
            />
          )}
          {stage === 'playlist-preview' && <PlaylistPreviewStep musicPath={musicPath} />}
          {(stage === 'downloading' || stage === 'tagging') && <ProgressStep stage={stage} progress={progress} />}
          {stage === 'playlist-downloading' && <PlaylistProgressStep progress={playlistProgress} />}
          {stage === 'success' && result?.success && <SuccessStep relativePath={result.relativePath} />}
          {stage === 'playlist-summary' && playlistResult && <PlaylistSummaryStep result={playlistResult} />}
          {stage === 'error' && <ErrorStep error={error} />}
        </div>
      </div>

      <style>{`
        @keyframes ytModalIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}

// ── Step 1 — paste a link ────────────────────────────────────────────────────

function UrlStep({ urlInputRef }: { urlInputRef: React.RefObject<HTMLInputElement> }) {
  const { url, stage, setUrl, fetchInfo } = useDownloadStore()
  const isFetching = stage === 'fetching'

  return (
    <>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Paste a YouTube video or playlist link. We'll pull the title, artist, and
        thumbnail so you can confirm everything before it's saved.
      </p>
      <input
        ref={urlInputRef}
        type="text"
        placeholder="https://youtube.com/watch?v=…"
        value={url}
        disabled={isFetching}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !isFetching && fetchInfo()}
        style={{ width: '100%', padding: '9px 12px', fontSize: 13 }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn-primary"
          onClick={() => fetchInfo()}
          disabled={!url.trim() || isFetching}
          style={{ minWidth: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {isFetching ? <Spinner onAccent /> : 'Fetch details'}
        </button>
      </div>
    </>
  )
}

// ── Ambiguous link — video that's also part of a playlist ───────────────────

function LinkChoiceStep() {
  const { chooseSingleVideo, choosePlaylist, reset } = useDownloadStore()
  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        This link points to one video that's part of a playlist. What would you like to download?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className="btn-ghost"
          onClick={() => choosePlaylist()}
          style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
        >
          <span style={{ marginRight: 8 }}>▤</span> Download the whole playlist
        </button>
        <button
          className="btn-ghost"
          onClick={() => chooseSingleVideo()}
          style={{ justifyContent: 'flex-start', padding: '10px 14px', fontSize: 13 }}
        >
          <span style={{ marginRight: 8 }}>▸</span> Just this video
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={reset}>Back</button>
      </div>
    </>
  )
}

function PlaylistFetchingStep() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <Spinner />
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Reading playlist…</p>
    </div>
  )
}

// ── Step 2 — confirm title / artist / album ──────────────────────────────────

function PreviewStep({ videoInfo, title, artist, album, knownAlbums, destinationPreview, musicPath }: {
  videoInfo: YoutubeVideoInfo
  title: string; artist: string; album: string
  knownAlbums: string[]; destinationPreview: string; musicPath: string
}) {
  const { setTitle, setArtist, setAlbum, startDownload, reset } = useDownloadStore()
  const canDownload = title.trim().length > 0 && artist.trim().length > 0 && !!musicPath

  return (
    <>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{
          width: 104, height: 104, borderRadius: 'var(--radius-md)', flexShrink: 0,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {videoInfo.thumbnailDataUrl
            ? <img src={videoInfo.thumbnailDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 32, color: 'var(--text-tertiary)' }}>♫</span>}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {videoInfo.videoTitle}
          </div>
          {videoInfo.uploader && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{videoInfo.uploader}</div>
          )}
          {videoInfo.durationSeconds > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {formatDuration(videoInfo.durationSeconds)}
            </div>
          )}
        </div>
      </div>

      <Field label="Track title">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} />
      </Field>

      <Field label="Artist">
        <input type="text" value={artist} onChange={e => setArtist(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} />
      </Field>

      <Field label="Album (optional)">
        <input
          type="text" list="yt-known-albums" value={album}
          placeholder="Leave blank for a loose single"
          onChange={e => setAlbum(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', fontSize: 13 }}
        />
        <datalist id="yt-known-albums">
          {knownAlbums.map(name => <option key={name} value={name} />)}
        </datalist>
      </Field>

      {!musicPath && (
        <p style={{ fontSize: 11, color: '#e07b72' }}>Set your music folder in Settings before downloading.</p>
      )}
      {musicPath && destinationPreview && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          Saves to: {destinationPreview}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn-ghost" onClick={reset}>Back</button>
        <button className="btn-primary" onClick={() => startDownload(musicPath)} disabled={!canDownload}>
          Download
        </button>
      </div>
    </>
  )
}

// ── Step 3 — progress ────────────────────────────────────────────────────────

function ProgressStep({ stage, progress }: { stage: string; progress: { percent: number; speed?: string; eta?: string } | null }) {
  const { cancelDownload } = useDownloadStore()
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0))

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {stage === 'tagging' ? 'Tagging and saving…' : 'Downloading audio…'}
      </p>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: 'var(--accent)',
          transition: 'width 200ms ease', borderRadius: 999,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        <span>{percent.toFixed(0)}%</span>
        <span>{[progress?.speed, progress?.eta ? `ETA ${progress.eta}` : null].filter(Boolean).join(' · ')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={cancelDownload}>Cancel</button>
      </div>
    </>
  )
}

// ── Step 4 — success ─────────────────────────────────────────────────────────

function SuccessStep({ relativePath }: { relativePath: string }) {
  const { reset, close } = useDownloadStore()
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)',
          color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>✓</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Added to your library</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
            {relativePath}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={reset}>Download another</button>
        <button className="btn-primary" onClick={close}>Done</button>
      </div>
    </>
  )
}

// ── Playlist — confirm shared artist/album + which tracks, in order ─────────

function PlaylistPreviewStep({ musicPath }: { musicPath: string }) {
  const {
    playlistTitle, playlistArtist, playlistAlbum, playlistTracks,
    setPlaylistArtist, setPlaylistAlbum, setTrackTitle, toggleTrack, toggleAllTracks,
    startPlaylistDownload, reset,
  } = useDownloadStore()

  const selectedCount = playlistTracks.filter(t => t.include).length
  const allSelected = selectedCount === playlistTracks.length && playlistTracks.length > 0
  const canDownload = selectedCount > 0 && playlistArtist.trim().length > 0 && !!musicPath

  return (
    <>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {playlistTitle}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'} · order preserved from the playlist
        </div>
      </div>

      <Field label="Artist">
        <input type="text" value={playlistArtist} onChange={e => setPlaylistArtist(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} />
      </Field>
      <Field label="Album">
        <input type="text" value={playlistAlbum} onChange={e => setPlaylistAlbum(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontSize: 13 }} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tracks ({selectedCount}/{playlistTracks.length})
        </span>
        <button
          className="btn-ghost"
          style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={() => toggleAllTracks(!allSelected)}
        >
          {allSelected ? 'Select none' : 'Select all'}
        </button>
      </div>

      <div style={{
        maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      }}>
        {playlistTracks.map((track, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
              borderBottom: i < playlistTracks.length - 1 ? '1px solid var(--border)' : 'none',
              opacity: track.include ? 1 : 0.4,
            }}
          >
            <input type="checkbox" checked={track.include} onChange={() => toggleTrack(i)} style={{ flexShrink: 0, cursor: 'pointer' }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', width: 22, flexShrink: 0, textAlign: 'right' }}>
              {i + 1}
            </span>
            <input
              type="text"
              value={track.title}
              disabled={!track.include}
              onChange={e => setTrackTitle(i, e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: '5px 8px', fontSize: 12 }}
            />
            {track.unavailable
              ? <span style={{ fontSize: 10, color: '#e07b72', flexShrink: 0 }}>unavailable</span>
              : (
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {formatDuration(track.durationSeconds)}
                </span>
              )}
          </div>
        ))}
      </div>

      {!musicPath && (
        <p style={{ fontSize: 11, color: '#e07b72' }}>Set your music folder in Settings before downloading.</p>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={reset}>Back</button>
        <button className="btn-primary" onClick={() => startPlaylistDownload(musicPath)} disabled={!canDownload}>
          Download {selectedCount || ''} {selectedCount === 1 ? 'track' : 'tracks'}
        </button>
      </div>
    </>
  )
}

function PlaylistProgressStep({ progress }: {
  progress: { currentIndex: number; total: number; currentTitle: string; percent: number; speed?: string; eta?: string } | null
}) {
  const { cancelDownload } = useDownloadStore()
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0))

  return (
    <>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Track {progress?.currentIndex ?? 1} of {progress?.total ?? 1}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {progress?.currentTitle}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${percent}%`, background: 'var(--accent)',
          transition: 'width 200ms ease', borderRadius: 999,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        <span>{percent.toFixed(0)}%</span>
        <span>{[progress?.speed, progress?.eta ? `ETA ${progress.eta}` : null].filter(Boolean).join(' · ')}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={cancelDownload}>Cancel</button>
      </div>
    </>
  )
}

function PlaylistSummaryStep({ result }: { result: YoutubePlaylistDownloadResult }) {
  const { reset, close } = useDownloadStore()
  const succeeded = result.results.filter(r => r.success)
  const failed = result.results.filter(r => !r.success)
  const allOk = failed.length === 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%',
          background: allOk ? 'var(--accent-dim)' : 'rgba(224,123,114,0.15)',
          color: allOk ? 'var(--accent)' : '#e07b72',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
        }}>
          {allOk ? '✓' : '!'}
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {result.canceled ? 'Playlist download canceled' : 'Playlist download finished'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {succeeded.length} added{failed.length > 0 ? `, ${failed.length} failed` : ''}
          </div>
        </div>
      </div>

      {failed.length > 0 && (
        <div style={{
          maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5,
        }}>
          {failed.map((f, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <span style={{ color: '#e07b72' }}>✕</span> {f.title}
              {f.error && <span style={{ color: 'var(--text-tertiary)' }}> — {f.error}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={reset}>Download another</button>
        <button className="btn-primary" onClick={close}>Done</button>
      </div>
    </>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorStep({ error }: { error: string | null }) {
  const { reset, close } = useDownloadStore()
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(224,123,114,0.15)',
          color: '#e07b72', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>!</span>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {error || 'Something went wrong.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn-ghost" onClick={close}>Close</button>
        <button className="btn-primary" onClick={reset}>Try again</button>
      </div>
    </>
  )
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function Spinner({ onAccent = false }: { onAccent?: boolean }) {
  return (
    <span style={{
      width: 13, height: 13,
      border: `2px solid ${onAccent ? 'rgba(0,0,0,0.25)' : 'var(--border-mid)'}`,
      borderTopColor: onAccent ? '#000' : 'var(--text-tertiary)',
      borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }} />
  )
}
