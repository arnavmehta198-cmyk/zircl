import type { ReactNode } from 'react'

/** Two not-yet-connected profiles, bridged by a rose spark — not a generic ghost circle. */
export function NoMutualIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden>
      <circle cx="30" cy="42" r="20" fill="#FFE1E8" />
      <circle cx="30" cy="42" r="20" stroke="#2B1625" strokeOpacity="0.12" strokeWidth="1.5" />
      <circle cx="66" cy="42" r="20" fill="none" stroke="#2B1625" strokeOpacity="0.2" strokeWidth="1.5" />
      <g transform="translate(48 42)">
        <path
          d="M0 -9 L2.4 -2.4 L9 0 L2.4 2.4 L0 9 L-2.4 2.4 L-9 0 L-2.4 -2.4 Z"
          fill="#FF4D6D"
        />
      </g>
    </svg>
  )
}

/**
 * Shared "no mutual connection yet" empty state — Messages (no accepted
 * follow-back) and the event wizard's friend picker (no friends at all) are
 * the same underlying concept. No outer card here on purpose: Messages wraps
 * this in its own full-page ivory card, FriendSheet doesn't need one since
 * the modal itself is already the container. `action` is optional and, when
 * omitted, reserves no layout space — no dead margin/height.
 */
export function NoMutualState({ title, description, action }: {
  title: string; description: string; action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="max-w-[360px] flex flex-col items-center gap-4">
        <NoMutualIllustration />
        <div>
          <h3 className="text-[19px] font-display font-extrabold text-plum">{title}</h3>
          <p className="text-[14.5px] text-plum/60 leading-relaxed mt-2">{description}</p>
        </div>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  )
}
