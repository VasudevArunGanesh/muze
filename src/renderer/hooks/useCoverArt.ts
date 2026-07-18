import { useState, useEffect } from 'react'

const cache = new Map<string, string | null>()

export function clearCoverArtCache(path?: string) {
  if (path) cache.delete(path)
  else cache.clear()
  window.dispatchEvent(new CustomEvent('muze-cover-art-changed', { detail: path }))
}

export function useCoverArt(coverPath: string | undefined) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    function loadCoverArt(skipCache = false) {
      if (!coverPath) { setSrc(null); return }
      if (!skipCache && cache.has(coverPath)) { setSrc(cache.get(coverPath)!); return }

      window.muze.getCoverArt(coverPath).then(data => {
        if (cancelled) return
        cache.set(coverPath, data)
        setSrc(data)
      })
    }

    function handleCoverArtChanged(event: Event) {
      const changedPath = (event as CustomEvent<string | undefined>).detail
      if (!coverPath || (changedPath && changedPath !== coverPath)) return
      loadCoverArt(true)
    }

    loadCoverArt()
    window.addEventListener('muze-cover-art-changed', handleCoverArtChanged)

    return () => {
      cancelled = true
      window.removeEventListener('muze-cover-art-changed', handleCoverArtChanged)
    }
  }, [coverPath])

  return src
}
