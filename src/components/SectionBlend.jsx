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

// Interpolating tan-into-black straight through RGB drags the color through
// a flat, muddy brown-grey mid-tone (the two hues partially cancel out).
// Holding hue/saturation close to the source color and only snapping them
// over to the target near the very end — while lightness eases the whole
// way — reads as "the same color getting darker" instead of "graying out".
function easeHue(t) {
  return Math.pow(t, 4)
}

// Zero first AND second derivative at both ends (Perlin's smootherstep) —
// a plain ease only zeroes the slope, which still leaves a visible kink
// where the gradient meets each flat neighbor.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const STOPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

function lerpHue(h1, h2, t) {
  let d = h2 - h1
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return (h1 + d * t + 360) % 360
}

export default function SectionBlend({ from, to }) {
  const [h1, s1, l1] = rgbToHsl(hexToRgb(from))
  const [h2, s2, l2] = rgbToHsl(hexToRgb(to))

  const gradient = STOPS.map(t => {
    const hueT = easeHue(t)
    const lightT = smootherstep(t)
    const h = lerpHue(h1, h2, hueT)
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
