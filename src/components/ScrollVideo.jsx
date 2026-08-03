import { useEffect, useRef, useState } from 'react'
import './ScrollVideo.css'

const FRAME_COUNT = 380
const FRAME_WIDTH = 960
const FRAME_HEIGHT = 540
const frameSrc = i => `/zircl-frames/frame-${String(i + 1).padStart(4, '0')}.jpg`

const CAPTIONS = [
  { at: 0.0, text: 'It starts with a text.' },
  { at: 0.35, text: 'Someone picks a time.' },
  { at: 0.7, text: 'Everyone just shows up.' }
]

export default function ScrollVideo() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const redrawRef = useRef(() => {})
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    const images = new Array(FRAME_COUNT)
    imagesRef.current = images

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image()
      img.src = frameSrc(i)
      // Redraw on load rather than bumping state per frame — 380 state
      // updates in a burst would cascade re-renders.
      img.onload = () => {
        if (cancelled) return
        redrawRef.current()
      }
      images[i] = img
    }

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let frameRequested = false
    let lastDrawn = -1

    const compute = () => {
      const section = sectionRef.current
      if (!section) return 0
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const raw = scrollable > 0 ? -rect.top / scrollable : 0
      return Math.min(Math.max(raw, 0), 1)
    }

    const render = () => {
      frameRequested = false
      const clamped = compute()

      const index = Math.min(FRAME_COUNT - 1, Math.round(clamped * (FRAME_COUNT - 1)))
      const img = imagesRef.current[index]
      if (img && img.complete && img.naturalWidth > 0 && index !== lastDrawn) {
        ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
        ctx.drawImage(img, 0, 0, FRAME_WIDTH, FRAME_HEIGHT)
        lastDrawn = index
      }

      setProgress(prev => (Math.abs(prev - clamped) > 0.0005 ? clamped : prev))
    }

    const schedule = () => {
      if (frameRequested) return
      frameRequested = true
      requestAnimationFrame(render)
    }

    redrawRef.current = () => {
      lastDrawn = -1
      schedule()
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      redrawRef.current = () => {}
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Phone rises and settles over the first 20% of the section.
  const entry = Math.min(progress / 0.2, 1)
  const phoneScale = 0.86 + entry * 0.14
  const phoneY = (1 - entry) * 60

  return (
    <section ref={sectionRef} className="scroll-video-section" style={{ height: `${FRAME_COUNT * 6}px` }}>
      <div className="scroll-video-sticky">
        <div className="scroll-video-captions">
          {CAPTIONS.map(({ at, text }, i) => {
            const end = CAPTIONS[i + 1]?.at ?? 1.01
            const fade = 0.05
            const fadeIn = Math.min(Math.max((progress - at) / fade, 0), 1)
            const fadeOut = Math.min(Math.max((end - progress) / fade, 0), 1)
            const opacity = Math.min(fadeIn, fadeOut)

            return (
              <h2
                key={text}
                className="scroll-video-caption"
                style={{ opacity, transform: `translateY(${(1 - opacity) * 16}px)` }}
              >
                {text}
              </h2>
            )
          })}
        </div>

        <div
          className="scroll-video-phone"
          style={{ transform: `translateY(${phoneY}px) scale(${phoneScale})`, opacity: entry }}
        >
          <canvas
            ref={canvasRef}
            className="scroll-video-canvas"
            width={FRAME_WIDTH}
            height={FRAME_HEIGHT}
          />
        </div>

        <div className="scroll-video-progress">
          <div className="scroll-video-progress-bar" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </section>
  )
}
