import { useState } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useDownloadStore } from '../../store/downloadStore'
import { SettingsPanel } from './SettingsPanel'
import type { ViewType, AppSettings } from '../../types'

interface NavItem { id: ViewType; label: string; icon: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'artists', label: 'Artists', icon: '⬡' },
  { id: 'albums',  label: 'Albums',  icon: '◫' },
  { id: 'songs',   label: 'Songs',   icon: '♪' },
]
const DISCOVER_ITEMS: NavItem[] = [
  { id: 'rated',  label: 'Rated',  icon: '★' },
  { id: 'recent', label: 'Recent', icon: '◷' },
]

interface Props {
  currentView: ViewType
  onViewChange: (v: ViewType) => void
  settings: AppSettings | null
  onSettingsChange: (s: AppSettings) => void
}

// Declare the electron-specific CSS property so TypeScript doesn't complain
const dragStyle: React.CSSProperties & { WebkitAppRegion?: string } = {
  padding: '20px 20px 14px',
  borderBottom: '1px solid var(--border)',
  WebkitAppRegion: 'drag',
}

export function Sidebar({ currentView, onViewChange, settings, onSettingsChange }: Props) {
  const { library, searchQuery, setSearchQuery } = useLibraryStore()
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <aside style={{
        width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
        background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Logo — drag region for frameless window */}
        <div style={dragStyle as React.CSSProperties}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
            muze
          </div>
          {library && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>
              {library.artists.length} artists · {library.totalSongs} songs
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px 6px' }}>
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', fontSize: 12,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflow: 'hidden auto', padding: '4px 0' }}>
          <SectionLabel>Library</SectionLabel>
          {NAV_ITEMS.map(item => (
            <NavButton key={item.id} item={item} active={currentView === item.id} onClick={() => onViewChange(item.id)} />
          ))}
          <SectionLabel>Discover</SectionLabel>
          {DISCOVER_ITEMS.map(item => (
            <NavButton key={item.id} item={item} active={currentView === item.id} onClick={() => onViewChange(item.id)} />
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            onClick={() => useDownloadStore.getState().reset()}
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', gap: 10, padding: '8px 10px', fontSize: 13, color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)' }}
          >
            <span style={{ fontSize: 14 }}>⬇</span> Download
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', gap: 10, padding: '8px 10px', fontSize: 13, color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)' }}
          >
            <span style={{ fontSize: 14 }}>⚙</span> Settings
          </button>
        </div>
      </aside>

      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px 5px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 20px',
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--bg-elevated)' : 'transparent',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 0, transition: 'all var(--transition)', textAlign: 'left'
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      <span style={{ fontSize: 15, color: active ? 'var(--accent)' : 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>
        {item.icon}
      </span>
      {item.label}
    </button>
  )
}
