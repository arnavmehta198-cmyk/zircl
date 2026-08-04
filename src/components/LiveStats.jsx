import { useEffect, useRef, useState } from 'react'
import './LiveStats.css'

const DURATION = 5000

// People/meetups vary per visit; hobbies stay fixed.
const STAT_SPECS = [
  { min: 300, max: 1500, step: 10, suffix: '+', label: 'people nearby' },
  { min: 120, max: 340, step: 5, suffix: '', label: 'meetups happening now' },
  { fixed: 10, suffix: '+', label: 'hobbies you can join' }
]

const rollStats = () =>
  STAT_SPECS.map(spec => {
    if (spec.fixed != null) return { ...spec, value: spec.fixed }
    const steps = Math.floor((spec.max - spec.min) / spec.step) + 1
    return { ...spec, value: spec.min + Math.floor(Math.random() * steps) * spec.step }
  })

// Slow start, accelerating finish.
const ease = t => Math.pow(t, 1.8)

export default function LiveStats() {
  const sectionRef = useRef(null)
  const [stats] = useState(rollStats)
  const [counts, setCounts] = useState(() => stats.map(() => 0))

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    let rafId = 0
    // Local to this effect run: StrictMode remounts must be able to
    // restart the count-up after cleanup cancels the first pass.
    let started = false

    const run = () => {
      const start = performance.now()

      const tick = now => {
        const t = Math.min((now - start) / DURATION, 1)
        const eased = ease(t)
        setCounts(stats.map(s => Math.round(s.value * eased)))
        if (t < 1) rafId = requestAnimationFrame(tick)
      }

      rafId = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !started) {
            started = true
            run()
          }
        })
      },
      { threshold: 0.35 }
    )

    observer.observe(section)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [stats])

  return (
    <section ref={sectionRef} id="stats" className="live-stats">
      <div className="live-stats-head">
        <span className="live-stats-pulse" />
        <span className="live-stats-eyebrow">Live in your area</span>
      </div>

      <div className="live-stats-grid">
        {stats.map(({ suffix, label }, i) => (
          <div className="live-stat" key={label}>
            <div className="live-stat-value">
              {counts[i].toLocaleString()}
              {suffix}
            </div>
            <div className="live-stat-label">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
