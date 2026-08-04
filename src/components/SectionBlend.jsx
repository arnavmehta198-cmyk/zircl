import './SectionBlend.css'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Zero first AND second derivative at both ends (Perlin's smootherstep) —
// a plain ease only zeroes the slope, which still leaves a visible kink
// where the gradient meets each flat neighbor.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const STOPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

export default function SectionBlend({ from, to }) {
  const fromRgb = hexToRgb(from)
  const toRgb = hexToRgb(to)

  const gradient = STOPS.map(t => {
    const eased = smootherstep(t)
    const rgb = fromRgb.map((c, i) => Math.round(c + (toRgb[i] - c) * eased))
    return `rgb(${rgb.join(',')}) ${t * 100}%`
  }).join(', ')

  return (
    <div
      className="section-blend"
      style={{ background: `linear-gradient(180deg, ${gradient})` }}
    />
  )
}
