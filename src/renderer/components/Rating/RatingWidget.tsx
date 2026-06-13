import { useState, useEffect } from 'react'

interface Props {
  itemId: string
  itemType: 'song' | 'album'   // ← explicit type so we call the right IPC
  initialRating: number
  onSave: (rating: number, review: string) => void
  onCancel: () => void
  label: string
  compact?: boolean
}

const LABELS = ['', 'Awful', 'Meh', 'Good', 'Great', 'Perfect']

export function RatingWidget({ itemId, itemType, initialRating, onSave, onCancel, label, compact }: Props) {
  const [hovered, setHovered] = useState(0)
  const [rating, setRating]   = useState(initialRating)
  const [review, setReview]   = useState('')

  // Load the persisted review text once
  useEffect(() => {
    const fetch = itemType === 'song'
      ? window.muze.getSongRating(itemId)
      : window.muze.getAlbumRating(itemId)
    fetch.then(r => { if (r?.review) setReview(r.review) })
  }, [itemId, itemType])

  const display = hovered || rating

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12 }}>
      {!compact && (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Rate: <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </p>
      )}

      {/* Stars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(n)}
            style={{
              fontSize: compact ? 20 : 26,
              color: n <= display ? '#EF9F27' : 'var(--text-tertiary)',
              transform: n <= display ? 'scale(1.12)' : 'scale(1)',
              transition: 'color var(--transition), transform var(--transition)',
              lineHeight: 1
            }}
          >
            {n <= display ? '★' : '☆'}
          </button>
        ))}
        {rating > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 8 }}>
            {LABELS[rating]}
          </span>
        )}
      </div>

      {/* Review textarea (full mode only) */}
      {!compact && (
        <textarea
          placeholder="Add a note or review… (optional)"
          value={review}
          onChange={e => setReview(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }}
        />
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-primary"
          onClick={() => rating > 0 && onSave(rating, review)}
          disabled={rating === 0}
          style={{ padding: '6px 18px', fontSize: 13 }}
        >
          Save
        </button>
        <button
          className="btn-ghost"
          onClick={onCancel}
          style={{ padding: '6px 14px', fontSize: 13 }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
