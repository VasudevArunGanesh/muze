export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatBitrate(kbps: number | undefined): string {
  if (!kbps) return ''
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`
}

export function getFormatColor(format: string): string {
  switch (format.toLowerCase()) {
    case 'flac': return '#5cb85c'
    case 'alac': return '#5bc0de'
    case 'wav':  return '#9b59b6'
    case 'mp3':  return '#888888'
    default:     return '#666666'
  }
}

export function pluralise(n: number, word: string): string {
  return `${n} ${word}${n !== 1 ? 's' : ''}`
}
