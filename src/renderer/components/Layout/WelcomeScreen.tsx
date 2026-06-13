interface Props {
  onFolderSelect: (path: string) => void
}

export function WelcomeScreen({ onFolderSelect }: Props) {
  async function handleBrowse() {
    const path = await window.muze.openMusicFolder()
    if (path) onFolderSelect(path)
  }

  async function handleDefault() {
    onFolderSelect('C:\\Users\\Vasudev\\Music')
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 24,
      background: 'var(--bg-base)'
    }}>
      <div style={{ fontSize: 48, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.1em' }}>
        muze
      </div>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 320, textAlign: 'center', lineHeight: 1.7 }}>
        Point muze at your music folder and it will organise everything automatically.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 260 }}>
        <button
          onClick={handleDefault}
          style={{
            padding: '12px 24px',
            background: 'var(--accent)',
            color: '#000',
            fontWeight: 600,
            fontSize: 14,
            borderRadius: 'var(--radius-md)',
            letterSpacing: '0.02em'
          }}
        >
          Use C:\Users\Vasudev\Music
        </button>
        <button
          onClick={handleBrowse}
          style={{
            padding: '12px 24px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            fontSize: 14,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)'
          }}
        >
          Browse for folder…
        </button>
      </div>
    </div>
  )
}
