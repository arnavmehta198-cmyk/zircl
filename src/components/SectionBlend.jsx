import './SectionBlend.css'

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.round(Math.min(Math.max(v, 0), 1) * 255)
}

// OKLab: a perceptually-uniform color space designed so plain Cartesian
// interpolation (no hue-angle wraparound to route around, no muddy dip in
// the middle) already looks like a natural blend. This replaces an earlier
// attempt at hand-rolled HSL hue routing that kept overshooting into colors
// neither endpoint had (a navy or green flash that didn't belong to either
// section) — the whole class of bug OKLab exists to avoid.
function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b)

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s)

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  ]
}

function oklabToRgb([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

  return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)]
}

// Zero first AND second derivative at both ends (Perlin's smootherstep) —
// a plain ease only zeroes the slope, which still leaves a visible kink
// where the gradient meets each flat neighbor.
function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

const STOPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]

export default function SectionBlend({ from, to }) {
  const labFrom = rgbToOklab(hexToRgb(from))
  const labTo = rgbToOklab(hexToRgb(to))

  const gradient = STOPS.map(t => {
    const eased = smootherstep(t)
    const lab = labFrom.map((c, i) => c + (labTo[i] - c) * eased)
    const rgb = oklabToRgb(lab)
    return `rgb(${rgb.join(',')}) ${t * 100}%`
  }).join(', ')

  return (
    <div
      className="section-blend"
      style={{ background: `linear-gradient(180deg, ${gradient})` }}
    />
  )
}
