export function ScanningOverlay() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(var(--player-height) + 16px)',
      right: 24,
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-mid)',
      borderRadius: 'var(--radius-md)',
      padding: '12px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 13,
      color: 'var(--text-secondary)',
      zIndex: 100,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
    }}>
      <div style={{
        width: 16, height: 16,
        border: '2px solid var(--border-mid)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0
      }} />
      Scanning music library…
    </div>
  )
}
