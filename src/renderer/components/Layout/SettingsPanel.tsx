import { useState } from 'react'
import { ACCENT_PRESETS } from '../../types'
import { applySettings } from '../../App'
import type { AppSettings } from '../../types'
import { useLibraryStore } from '../../store/libraryStore'

interface Props {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSettingsChange, onClose }: Props) {
  const { scanLibrary } = useLibraryStore()
  const [localAccent, setLocalAccent] = useState(settings.accentColor)
  const [customHex, setCustomHex] = useState('')
  const [fontSize, setFontSize] = useState(settings.fontSize)

  function applyAccent(color: string) {
    setLocalAccent(color)
    const next = { ...settings, accentColor: color, fontSize }
    applySettings(next)    // live preview
    onSettingsChange(next)
  }

  function applyFontSize(size: number) {
    setFontSize(size)
    const next = { ...settings, fontSize: size, accentColor: localAccent }
    applySettings(next)    // live preview
    onSettingsChange(next)
  }

  function handleCustomHex(val: string) {
    setCustomHex(val)
    // Apply live once it's a valid 6-digit hex
    if (/^#[0-9a-fA-F]{6}$/.test(val)) applyAccent(val)
  }

  async function handleChangeFolder() {
    const path = await window.muze.openMusicFolder()
    if (path) {
      const newSettings = { ...settings, musicPath: path, accentColor: localAccent, fontSize }
      onSettingsChange(newSettings)
      onClose()
      await scanLibrary(path)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.5)'
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 320, zIndex: 201,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-mid)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        animation: 'slideInRight 180ms ease'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h2>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '4px 10px', fontSize: 16, color: 'var(--text-secondary)' }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── Accent colour ── */}
          <section>
            <Label>Accent colour</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {ACCENT_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => applyAccent(preset.value)}
                  title={preset.name}
                  style={{
                    width: 32, height: 32,
                    borderRadius: '50%',
                    background: preset.value,
                    border: localAccent === preset.value
                      ? `3px solid var(--text-primary)`
                      : '3px solid transparent',
                    outline: localAccent === preset.value ? `2px solid ${preset.value}` : 'none',
                    outlineOffset: 2,
                    transition: 'transform var(--transition)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>

            {/* Custom hex input */}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom hex</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: /^#[0-9a-fA-F]{6}$/.test(customHex) ? customHex : localAccent,
                  border: '1px solid var(--border-mid)', flexShrink: 0
                }} />
                <input
                  type="text"
                  placeholder="#c8a96e"
                  value={customHex}
                  onChange={e => handleCustomHex(e.target.value)}
                  maxLength={7}
                  style={{
                    flex: 1, padding: '6px 10px', fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-mid)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            {/* Live preview swatch */}
            <div style={{
              marginTop: 14, padding: '10px 14px',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 18 }}>★</span>
              <span style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>Preview accent</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 'auto' }}>muze</span>
            </div>
          </section>

          {/* ── Font size ── */}
          <section>
            <Label>Font size</Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'S',    value: 13 },
                { label: 'M',    value: 14 },
                { label: 'L',    value: 15 },
                { label: 'XL',   value: 16 },
                { label: 'XXL',  value: 18 },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => applyFontSize(opt.value)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    background: fontSize === opt.value ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: fontSize === opt.value ? '#000' : 'var(--text-secondary)',
                    border: `1px solid ${fontSize === opt.value ? 'transparent' : 'var(--border-mid)'}`,
                    cursor: 'pointer',
                    transition: 'all var(--transition)'
                  }}
                >
                  {opt.label}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{opt.value}px</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10 }}>
              Scales the entire interface proportionally.
            </p>
          </section>

          {/* ── Music folder ── */}
          <section>
            <Label>Music folder</Label>
            <div style={{
              marginTop: 10, padding: '10px 14px',
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)', fontSize: 12,
              color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all', lineHeight: 1.6
            }}>
              {settings.musicPath || '(none set)'}
            </div>
            <button
              className="btn-ghost"
              onClick={handleChangeFolder}
              style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
            >
              Change folder…
            </button>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      {children}
    </p>
  )
}
