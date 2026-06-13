import { useState, useEffect } from 'react'

const cache = new Map<string, string | null>()

export function useCoverArt(coverPath: string | undefined) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!coverPath) { setSrc(null); return }
    if (cache.has(coverPath)) { setSrc(cache.get(coverPath)!); return }

    window.muze.getCoverArt(coverPath).then(data => {
      cache.set(coverPath, data)
      setSrc(data)
    })
  }, [coverPath])

  return src
}
