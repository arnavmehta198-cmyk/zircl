import { type MouseEvent, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FeedUser } from '../lib/types'
import { distanceText } from '../lib/format'
import { Icon } from './icons'
import { Button, HobbyTag } from './ui'
import PhotoCarousel from './PhotoCarousel'

/** matchScore (60-98ish) → a plain-language read, no fabricated claims. */
function matchLabel(score: number): string {
  if (score >= 90) return 'Strong match'
  if (score >= 80) return 'Good match'
  return 'Match'
}

function PhotoPane({ user, interactive, shouldIgnoreTap }: {
  user: FeedUser; interactive: boolean; shouldIgnoreTap?: () => boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="relative w-full h-[320px] shrink-0 lg:h-full">
      <PhotoCarousel
        photos={user.imageURLs}
        name={user.name}
        interactive={interactive}
        shouldIgnoreTap={shouldIgnoreTap}
        overlay={
          // Name lives on the photo on mobile (single column); the desktop
          // info panel carries it instead, so it isn't shown twice.
          <div className="lg:hidden">
            <h3 className="text-[26px] font-display font-extrabold text-white leading-[1.15]">
              {user.name}, {user.age}
            </h3>
            <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[13px] text-white/80">
              <Icon.Pin size={14} className="text-white/60" />
              {distanceText(user.distanceMiles)}
            </div>
          </div>
        }
        topRightAction={
          <button
            type="button"
            onPointerDown={(e: PointerEvent) => e.stopPropagation()}
            onClick={(e: MouseEvent) => { e.stopPropagation(); navigate(`/person/${user.id}`) }}
            className="absolute top-4 right-4 h-8 px-3 rounded-full bg-plum/50 backdrop-blur-xs border border-white/20
                       text-[12.5px] font-semibold text-white inline-flex items-center gap-1
                       transition-colors hover:bg-plum/70"
          >
            Full profile <Icon.ChevronRight size={13} />
          </button>
        }
      />
    </div>
  )
}


/** The single unified match card — photo and info share one surface, actions docked at the bottom. */
export default function MatchCard({
  user, interactive = true, shouldIgnoreTap, onPass, onFollow,
}: {
  user: FeedUser
  interactive?: boolean
  shouldIgnoreTap?: () => boolean
  onPass?: () => void
  onFollow?: () => void
}) {
  return (
    <div className="w-full h-full rounded-card overflow-hidden border border-line bg-ivory shadow-card
                    flex flex-col lg:grid lg:grid-cols-[1fr_1.05fr]">
      <PhotoPane user={user} interactive={interactive} shouldIgnoreTap={shouldIgnoreTap} />

      <div className="flex flex-col flex-1 min-h-0 lg:h-full">
        <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-6 py-5">
          {/* Name lives here on desktop; the photo carries it on mobile. */}
          <div className="hidden lg:flex items-start justify-between gap-3">
            <h3 className="text-[28px] font-display font-extrabold text-plum leading-[1.1]">
              {user.name}, {user.age}
            </h3>
            <span className="shrink-0 mt-1 inline-flex items-center gap-1 font-mono text-[12px] text-plum/60">
              <Icon.Pin size={13} />
              {distanceText(user.distanceMiles)}
            </span>
          </div>

          <div className="mt-2 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-gold/15 text-[11px] font-mono font-medium tracking-[0.04em] uppercase text-gold">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            {matchLabel(user.matchScore)} · {user.matchScore}%
          </div>

          {user.bio.trim() && (
            <p className="text-[14.5px] text-plum/70 leading-[1.6] mt-4 max-w-[46ch]">{user.bio}</p>
          )}

          {user.hobbies.length > 0 && (
            <div className="mt-5">
              <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-rose font-medium mb-2.5">
                Hobbies
              </div>
              <div className="flex flex-wrap gap-2">
                {user.hobbies.map((h) => <HobbyTag key={h} label={h} />)}
              </div>
            </div>
          )}

          {/* Second content layer — real, computed context rather than a
              fabricated first-person quote attributed to a real person. */}
          <div className="mt-5 rounded-2xl bg-white border-l-[3px] border-rose px-4 py-3.5">
            <div className="font-mono text-[11px] tracking-[0.1em] uppercase text-rose font-medium mb-1.5">
              Match highlights
            </div>
            <p className="text-[14.5px] font-display text-plum leading-snug">
              {matchLabel(user.matchScore)} · {distanceText(user.distanceMiles)}
              {user.hobbies.length > 0 && <> · into {user.hobbies.slice(0, 2).join(' & ')}</>}
            </p>
          </div>
        </div>

        {/* Actions docked to the card, not floating in empty space. */}
        {(onPass || onFollow) && (
          <div className="shrink-0 flex gap-2.5 px-6 py-4 border-t border-line/70">
            <Button
              variant="plum-outline"
              fullWidth
              icon={<Icon.Close size={17} />}
              onClick={onPass}
            >
              Pass
            </Button>
            <Button
              variant="rose"
              fullWidth
              icon={<Icon.Heart size={17} />}
              onClick={onFollow}
            >
              Follow
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
