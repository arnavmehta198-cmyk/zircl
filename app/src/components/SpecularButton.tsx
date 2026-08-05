import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'
import { Renderer, Program, Mesh, Triangle, Color, type OGLRenderingContext } from 'ogl'
import './SpecularButton.css'

const PAD = 20

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`

/**
 * Adapted from reactbits.dev's SpecularButton (github.com/DavidHDev/react-bits,
 * src/content/Components/SpecularButton) — a WebGL rim-light shader button.
 * Changes from the original: radius/sizing match this app's `rounded-field`
 * button conventions instead of reactbits' own scale; recolored to
 * rose/ivory/plum; the shader only runs while hovered/focused instead of a
 * continuous idle sweep (this sits in a repeated step-by-step flow, not a
 * one-off hero); prefers-reduced-motion and WebGL-init failure both fall back
 * to the plain CSS button (no canvas, no animation).
 */
export default function SpecularButton({
  children, onClick, disabled = false, type = 'button', className = '',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'; className?: string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const fxRef = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const [fxOn, setFxOn] = useState(false)

  useEffect(() => {
    if (reduce) return // reduced motion: skip WebGL entirely, plain CSS button only
    const btn = btnRef.current
    const fx = fxRef.current
    if (!btn || !fx) return

    let renderer: Renderer
    let gl: OGLRenderingContext
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr: window.devicePixelRatio || 1 })
      gl = renderer.gl
      if (!gl) throw new Error('no gl context')
    } catch {
      return // WebGL unavailable — plain CSS button stands in
    }

    setFxOn(true)
    const dpr = window.devicePixelRatio || 1
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.17, 0.09, 0.15] },
        uIntensity: { value: 0 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    const canvas = gl.canvas as HTMLCanvasElement
    fx.appendChild(canvas)

    const sizeRef = { w: 1, h: 1 }
    const resize = () => {
      const rect = btn.getBoundingClientRect()
      sizeRef.w = rect.width
      sizeRef.h = rect.height
      renderer.setSize(rect.width + PAD * 2, rect.height + PAD * 2)
      program.uniforms.uCenter.value = [(PAD + rect.width / 2) * dpr, (PAD + rect.height / 2) * dpr]
      program.uniforms.uHalfSize.value = [(rect.width / 2) * dpr, (rect.height / 2) * dpr]
    }
    const ro = new ResizeObserver(resize)
    ro.observe(btn)
    resize()

    let pointerAngle: number | null = null
    const onPointerMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect()
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
      const ny = (rect.top + rect.height / 2 - e.clientY) / (rect.height / 2)
      pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15
    }

    let angle = 2.4
    let bright = 0
    let last = performance.now()
    let raf = 0
    let running = false

    const lineC = new Color()
    const baseC = new Color()
    lineC.set('#FFF7F2') // ivory shine
    baseC.set('#2B1625') // plum edge stroke

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      const target = pointerAngle ?? angle
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      angle += diff * (1 - Math.exp(-dt * 7))

      const brightTarget = running ? 1 : 0
      bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8))

      program.uniforms.uAngle.value = angle
      program.uniforms.uRadius.value = Math.min(10, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b]
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b]
      program.uniforms.uIntensity.value = bright
      program.uniforms.uShineSize.value = (10 * Math.PI) / 180
      program.uniforms.uShineFade.value = (40 * Math.PI) / 180
      program.uniforms.uThickness.value = dpr
      renderer.render({ scene: mesh })

      // Idle once fully faded out — stop the loop instead of animating forever.
      if (!running && bright < 0.002) cancelAnimationFrame(raf)
    }

    const start = () => {
      if (running) return
      running = true
      btn.addEventListener('pointermove', onPointerMove)
      last = performance.now()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      pointerAngle = null
      btn.removeEventListener('pointermove', onPointerMove)
      // loop is already running (or about to be started by `start`); let it
      // fade `bright` to 0 and self-cancel rather than cutting it off dead.
      if (!raf) raf = requestAnimationFrame(loop)
    }

    btn.addEventListener('pointerenter', start)
    btn.addEventListener('pointerleave', stop)
    btn.addEventListener('focus', start)
    btn.addEventListener('blur', stop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      btn.removeEventListener('pointerenter', start)
      btn.removeEventListener('pointerleave', stop)
      btn.removeEventListener('focus', start)
      btn.removeEventListener('blur', stop)
      btn.removeEventListener('pointermove', onPointerMove)
      if (canvas.parentNode === fx) fx.removeChild(canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [reduce])

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`specular-button${fxOn ? ' specular-button--live' : ''}${className ? ` ${className}` : ''}`}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__sheen" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  )
}
