import { useEffect, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FeedUser } from '../lib/types'
import { distanceText } from '../lib/format'
import { Icon } from './icons'

export default function ProfileCard({
  user, interactive = true, shouldIgnoreTap,
}: {
  user: FeedUser
  /** Back-of-stack cards render inert — no photo paging, no navigation. */
  interactive?: boolean
  /** Lets the deck swallow the click that ends a drag gesture. */
  shouldIgnoreTap?: () => boolean
}) {
  const navigate = useNavigate()
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => { setPhotoIndex(0) }, [user.id])

  const photos = user.imageURLs
  const count = photos.length
  const active = Math.min(photoIndex, Math.max(0, count - 1))
  const src = count > 0 ? photos[active] : null

  const step = (delta: number) => {
    if (count < 2) return
    setPhotoIndex((i) => (i + delta + count) % count)
  }

  const onBody = () => {
    if (!interactive || shouldIgnoreTap?.()) return
    step(1)
  }

  // Untitled UI's carousel-base styling: frosted glass circular buttons that
  // sit inset from the edges, not flush against them.
  const pager = (delta: number, glyph: ReactNode, label: string, side: 'left' | 'right') => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e: PointerEvent) => e.stopPropagation()}
      onClick={(e: MouseEvent) => { e.stopPropagation(); step(delta) }}
      className={`absolute top-1/2 -translate-y-1/2 z-10 ${side === 'left' ? 'left-3' : 'right-3'}
                 w-9 h-9 rounded-full bg-white/90 text-ink-2 backdrop-blur-xs grid place-items-center
                 pointer-events-auto shadow-card transition-colors hover:text-ink hover:bg-white`}
    >
      {glyph}
    </button>
  )

  return (
    <div className="absolute inset-0 rounded-card overflow-hidden border border-line bg-dusk-900 select-none">
      <div className="relative w-full h-full" onClick={onBody}>
        {src ? (
          <img src={src} alt={user.name} draggable={false} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center bg-dusk-800">
            <span className="text-[88px] font-display font-extrabold text-ink-3">
              {user.name.trim()[0]?.toUpperCase() ?? ''}
            </span>
          </div>
        )}

        {/* The one gradient permitted outside ambient glow — legibility scrim. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(14,12,16,0.92), transparent 45%)' }}
        />

        {/* Framed dot indicator — a pill housing the dots, carousel-base style */}
        {count > 1 && (
          <div className="absolute bottom-[84px] left-1/2 -translate-x-1/2 z-10
                          bg-deep/50 backdrop-blur-xs rounded-full px-2.5 py-1.5 flex items-center gap-1.5">
            {photos.map((p, i) => (
              <span
                key={p}
                className={`rounded-full transition-all duration-200
                  ${i === active ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        )}

        {count > 1 && interactive && (
          <>
            {pager(-1, <Icon.ChevronLeft size={18} />, 'Previous photo', 'left')}
            {pager(1, <Icon.ChevronRight size={18} />, 'Next photo', 'right')}
          </>
        )}

        {/* Name + distance over the scrim */}
        <div className="absolute bottom-0 inset-x-0 p-5 pointer-events-none">
          <h3 className="text-[20px] font-display font-medium text-white leading-[1.3]">
            {user.name}, {user.age}
          </h3>
          <div className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[13px] text-white/75">
            <Icon.Pin size={14} className="text-white/60" />
            {distanceText(user.distanceMiles)}
          </div>
        </div>

        {interactive && (
          <button
            type="button"
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
            onClick={(e: MouseEvent) => { e.stopPropagation(); navigate(`/person/${user.id}`) }}
            className="absolute bottom-5 right-5 h-9 px-3 rounded-field bg-deep/60 backdrop-blur border border-white/20
                       text-[13px] font-semibold text-white inline-flex items-center gap-1
                       transition-colors hover:bg-deep/80"
          >
            See more <Icon.ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
