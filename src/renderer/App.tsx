import { useEffect, useState } from 'react'
import { useLibraryStore } from './store/libraryStore'
import { usePlayerStore } from './store/playerStore'
import { AppLayout } from './components/Layout/AppLayout'
import { WelcomeScreen } from './components/Layout/WelcomeScreen'
import { DEFAULT_SETTINGS } from './types'
import type { AppSettings } from './types'

export function applySettings(s: AppSettings) {
  const root = document.documentElement

  // Accent colour + derived rgba variants
  root.style.setProperty('--accent', s.accentColor)
  const hex = s.accentColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16) || 200
  const g = parseInt(hex.slice(2, 4), 16) || 169
  const b = parseInt(hex.slice(4, 6), 16) || 110
  root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.15)`)
  root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.08)`)

  // Font size: set on <html> so all rem/em units scale.
  // Also expose as --font-base for any component that needs it.
  root.style.fontSize = `${s.fontSize}px`
  root.style.setProperty('--font-base', `${s.fontSize}px`)
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const { scanLibrary, library } = useLibraryStore()
  const { next, prev, togglePlay, seek, currentTime } = usePlayerStore()

  useEffect(() => {
    async function init() {
      const s = await window.muze.getSettings() as AppSettings
      const merged: AppSettings = { ...DEFAULT_SETTINGS, ...s }
      setSettings(merged)
      applySettings(merged)
      setIsLoading(false)
      if (merged.musicPath) await scanLibrary(merged.musicPath)
    }
    init()
  }, [])

  async function handleSettingsChange(s: AppSettings) {
    setSettings(s)
    applySettings(s)
    await window.muze.saveSettings(s)
  }

  // OS media keys
  useEffect(() => {
    const offNext = window.muze.onMediaNext(next)
    const offPrev = window.muze.onMediaPrev(prev)
    const offPlay = window.muze.onMediaPlayPause(togglePlay)
    return () => { offNext(); offPrev(); offPlay() }
  }, [next, prev, togglePlay])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      switch (true) {
        case e.code === 'Space' && !e.ctrlKey:        e.preventDefault(); togglePlay(); break
        case e.code === 'ArrowRight' && !e.ctrlKey:   e.preventDefault(); seek(currentTime + 15); break
        case e.code === 'ArrowLeft'  && !e.ctrlKey:   e.preventDefault(); seek(Math.max(0, currentTime - 15)); break
        case e.code === 'ArrowRight' && e.ctrlKey:    e.preventDefault(); next(); break
        case e.code === 'ArrowLeft'  && e.ctrlKey:    e.preventDefault(); prev(); break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [togglePlay, seek, next, prev, currentTime])

  if (isLoading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border-mid)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Starting muze…</span>
    </div>
  )

  if (!library && !settings.musicPath) {
    return <WelcomeScreen onFolderSelect={async (path) => {
      const newSettings = { ...settings, musicPath: path }
      await handleSettingsChange(newSettings)
      await scanLibrary(path)
    }} />
  }

  return <AppLayout settings={settings} onSettingsChange={handleSettingsChange} />
}
