import './SectionBlend.css'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rgb
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  return rgb.map(v => Math.round((v + m) * 255))
}

// Zero first AND second derivative at both ends (Perlin's smootherstep) —
// a plain ease only zeroes the slope, which still leaves a visible kink
// where the gradient meets each flat neighbor.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

// This palette never uses green/cyan (80-200deg) on purpose — it's not one
// of the brand hues, so any gradient that transits through it (e.g. a warm
// dark tone sliding up to a light blue) reads as an unintended green flash.
// If the short way around the hue wheel crosses that band, go the long way
// instead (through red/violet), which this palette's other hues actually border.
const FORBIDDEN_LO = 80
const FORBIDDEN_HI = 200

function crossesForbidden(h1, d) {
  for (let i = 1; i < 20; i++) {
    const h = (h1 + (d * i) / 20 + 360) % 360
    if (h >= FORBIDDEN_LO && h <= FORBIDDEN_HI) return true
  }
  return false
}

function hueDelta(h1, h2) {
  let d = ((h2 - h1 + 540) % 360) - 180
  if (crossesForbidden(h1, d)) {
    d = d > 0 ? d - 360 : d + 360
  }
  return d
}

// A near-black or near-white color's hue is numerically defined but not
// visually meaningful — its "chroma" (how much it actually reads as a
// color rather than a shade of grey) fades to zero at both lightness
// extremes. Weighting the hue transition toward whichever endpoint has
// more real chroma means we hold the visible color and snap away from
// the invisible one, instead of lingering on an arbitrary hue nobody sees.
function chroma(s, l) {
  return s * 4 * l * (1 - l)
}

function huePower(c1, c2) {
  const r = c1 / (c1 + c2 + 1e-6)
  return Math.pow(4, 2 * r - 1)
}

const STOPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

export default function SectionBlend({ from, to }) {
  const [h1, s1, l1] = rgbToHsl(hexToRgb(from))
  const [h2, s2, l2] = rgbToHsl(hexToRgb(to))

  const d = hueDelta(h1, h2)
  const p = huePower(chroma(s1, l1), chroma(s2, l2))

  const gradient = STOPS.map(t => {
    const hueT = Math.pow(t, p)
    const lightT = smootherstep(t)
    const h = (h1 + d * hueT + 360) % 360
    const s = s1 + (s2 - s1) * hueT
    const l = l1 + (l2 - l1) * lightT
    const rgb = hslToRgb([h, s, l])
    return `rgb(${rgb.join(',')}) ${t * 100}%`
  }).join(', ')

  return (
    <div
      className="section-blend"
      style={{ background: `linear-gradient(180deg, ${gradient})` }}
    />
  )
}
