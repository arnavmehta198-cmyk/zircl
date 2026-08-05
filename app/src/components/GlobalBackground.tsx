import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// A different solid color per nav tab, chosen at random each time you land
// on it (not a fixed per-route mapping — revisiting a tab can land on a
// different color than last time). Pastel-weight versions of the requested
// hues so ink-colored page text (headings, eyebrows) sitting directly on
// the background — not just inside opaque white cards — stays legible.
const PALETTE = [
  '#CDE7FA', // light blue
  '#9FC2E8', // dark blue
  '#FDE68A', // yellow
  '#BBEFC7', // green
  '#FBD5E4', // pink
  '#E3D5FA', // purple
  '#E3CBB0', // brown
  '#EDE0C8', // tan
  '#D7F2C2', // light green
]

function randomColor(excluding?: string): string {
  const options = excluding ? PALETTE.filter((c) => c !== excluding) : PALETTE
  return options[Math.floor(Math.random() * options.length)]
}

export default function GlobalBackground() {
  const { pathname } = useLocation()
  const lastColor = useRef<string | null>(null)
  const [color, setColor] = useState(() => randomColor())

  useEffect(() => {
    const next = randomColor(lastColor.current ?? undefined)
    lastColor.current = next
    setColor(next)
    // Only re-roll when the tab itself changes, not on every sub-route
    // param (e.g. /chat/:id) — the first path segment is "the tab".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname.split('/')[1]])

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none transition-colors duration-500"
      style={{ backgroundColor: color }}
    />
  )
}
