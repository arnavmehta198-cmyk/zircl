import { useEffect, useRef, useState } from 'react'
import './CircleFloatScroll.css'

const LINES = [
  { text: 'Find your circle', color: '#BFD7F5' },
  { text: 'Post!', color: '#C8E6C9' },
  { text: 'Match', color: '#F5C9D9' },
  { text: 'GO!', color: '#FCE8A8' }
]

export default function CircleFloatScroll() {
  const sectionRef = useRef(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current
      if (!section) return

      const viewportHeight = window.innerHeight
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - viewportHeight
      const raw = scrollable > 0 ? -rect.top / scrollable : 0
      const clamped = Math.min(Math.max(raw, 0), 1)

      setProgress(clamped * (LINES.length - 1))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section ref={sectionRef} className="circle-float-section" style={{ height: `${LINES.length * 100}vh` }}>
      <div className="circle-float-sticky">
        {LINES.map(({ text, color }, i) => {
          const offset = progress - i
          const opacity = Math.max(1 - Math.abs(offset) / 0.5, 0)

          return (
            <div
              key={text}
              className="circle-float-bg"
              style={{ backgroundColor: color, opacity }}
            />
          )
        })}
        {LINES.map(({ text }, i) => {
          const offset = progress - i
          const opacity = Math.max(1 - Math.abs(offset) / 0.5, 0)
          const translateY = Math.max(Math.min(offset, 1), -1) * -40

          const typeProgress = Math.min(Math.max((offset + 0.5) / 0.5, 0), 1)
          const visibleChars = Math.round(typeProgress * text.length)
          const isTyping = visibleChars < text.length && opacity > 0

          return (
            <h2
              key={text}
              className="circle-float-line"
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                pointerEvents: opacity > 0.5 ? 'auto' : 'none'
              }}
            >
              {text.slice(0, visibleChars)}
              {isTyping && <span className="circle-float-cursor" />}
            </h2>
          )
        })}
      </div>
    </section>
  )
}
