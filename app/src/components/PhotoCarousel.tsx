import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Icon } from './icons'

/**
 * Shared photo pager — used by the feed match card and the full profile
 * screen, so the transition and controls only need fixing in one place.
 * Crossfade + a small directional slide, no spring/bounce (this should read
 * as a native "next photo" swap, not a playful bounce).
 */
export default function PhotoCarousel({
  photos, name, interactive = true, shouldIgnoreTap, overlay, topRightAction, fallbackBg = 'bg-plum',
}: {
  photos: string[]
  name: string
  interactive?: boolean
  shouldIgnoreTap?: () => boolean
  /** Rendered bottom-anchored over the scrim, e.g. name + distance. */
  overlay?: ReactNode
  /** Rendered top-right over the photo, e.g. a "Full profile" link. */
  topRightAction?: ReactNode
  fallbackBg?: string
}) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const dir = useRef(1)

  useEffect(() => { setIndex(0) }, [name])

  const count = photos.length
  const active = Math.min(index, Math.max(0, count - 1))
  const src = count > 0 ? photos[active] : null

  const step = (delta: number) => {
    if (count < 2) return
    dir.current = delta
    setIndex((i) => (i + delta + count) % count)
  }

  const onBody = () => {
    if (!interactive || shouldIgnoreTap?.()) return
    step(1)
  }

  const pager = (delta: number, glyph: ReactNode, label: string, side: 'left' | 'right') => (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e: PointerEvent) => e.stopPropagation()}
      onClick={(e: MouseEvent) => { e.stopPropagation(); step(delta) }}
      className={`absolute top-1/2 -translate-y-1/2 z-10 ${side === 'left' ? 'left-3' : 'right-3'}
                 w-9 h-9 rounded-full bg-white/90 text-plum backdrop-blur-xs grid place-items-center
                 pointer-events-auto shadow-card transition-colors hover:bg-white`}
    >
      {glyph}
    </button>
  )

  return (
    <div className={`relative w-full h-full select-none overflow-hidden ${fallbackBg}`} onClick={onBody}>
      {src ? (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={active}
            src={src}
            alt={name}
            draggable={false}
            initial={reduce ? { opacity: 1 } : { opacity: 0, x: `${dir.current * 9}%` }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, x: `${-dir.current * 9}%` }}
            transition={reduce ? { duration: 0.01 } : { duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
      ) : (
        <div className={`w-full h-full grid place-items-center ${fallbackBg}`}>
          <span className="text-[80px] font-display font-extrabold text-white/25">
            {name.trim()[0]?.toUpperCase() ?? ''}
          </span>
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(43,22,37,0.85), transparent 42%)' }}
      />

      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                        bg-plum/50 backdrop-blur-xs rounded-full px-2.5 py-1.5 flex items-center gap-1.5">
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

      {overlay && (
        <div className="absolute bottom-0 inset-x-0 p-5 pointer-events-none">{overlay}</div>
      )}

      {interactive && topRightAction}
    </div>
  )
}
