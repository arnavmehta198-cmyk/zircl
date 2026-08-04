import { useEffect, useRef, useState } from 'react'
import {
  Zap,
  Target,
  Waves,
  CircleDot,
  Bike,
  Mountain,
  Palette,
  Puzzle,
  Dice5,
  Clapperboard,
  Footprints,
  Volleyball
} from 'lucide-react'
import './SportsScroll.css'

const photo = id => `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`

const SPORTS = [
  { label: 'Tennis', Icon: Zap, image: photo('1554068865-24cecd4e34b8'), blurb: 'Rally up a match with someone nearby.' },
  { label: 'Pickleball', Icon: Target, image: photo('1659318006095-4d44845f3a1b'), blurb: 'The fastest growing way to meet your court.' },
  { label: 'Surfing', Icon: Waves, image: photo('1530870110042-98b2cb110834'), blurb: 'Catch waves with people who chase them too.' },
  { label: 'Basketball', Icon: CircleDot, image: photo('1546519638-68e109498ffc'), blurb: 'Run pickup games with your circle.' },
  { label: 'Cycling', Icon: Bike, image: photo('1452573992436-6d508f200b30'), blurb: 'Find riders for your next long haul.' },
  { label: 'Climbing', Icon: Mountain, image: photo('1601224748193-d24f166b5c77'), blurb: 'Send routes with a belay partner you trust.' },
  { label: 'Art', Icon: Palette, image: photo('1541961017774-22349e4a1262'), blurb: 'Create alongside people who get it.' },
  { label: 'Escape Rooms', Icon: Puzzle, image: photo('1463871181391-8550cd89c179'), blurb: 'Team up and crack the next puzzle.' },
  { label: 'Board Games', Icon: Dice5, image: photo('1547638375-ebf04735d792'), blurb: 'Pull up a chair for game night regulars.' },
  { label: 'Movies', Icon: Clapperboard, image: photo('1489599849927-2ee91cede3ba'), blurb: 'Never watch the new release alone again.' },
  { label: 'Hiking', Icon: Mountain, image: photo('1551632811-561732d1e306'), blurb: 'Hit the trail with people at your pace.' },
  { label: 'Running', Icon: Footprints, image: photo('1571008887538-b36bb32f4571'), blurb: 'Log miles with a crew that shows up.' },
  { label: 'Volleyball', Icon: Volleyball, image: photo('1612872087720-bb876e2e67d1'), blurb: 'Set, spike, repeat with your new team.' }
]

// Fraction of the horizontal distance used as vertical scroll length.
// Lower = shorter section, faster horizontal travel.
const SCROLL_LENGTH_RATIO = 0.5

export default function SportsScroll() {
  const sectionRef = useRef(null)
  const trackRef = useRef(null)
  const [sectionHeight, setSectionHeight] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const [exitY, setExitY] = useState(0)
  const [exitOpacity, setExitOpacity] = useState(1)

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current
      if (!track) return
      const viewportHeight = window.innerHeight
      const maxScroll = Math.max(track.scrollWidth - window.innerWidth, 0)
      // Compress the vertical scroll needed: same horizontal travel, shorter section.
      setSectionHeight(maxScroll * SCROLL_LENGTH_RATIO + viewportHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return

      const viewportHeight = window.innerHeight
      const maxScroll = Math.max(track.scrollWidth - window.innerWidth, 0)
      const rect = section.getBoundingClientRect()
      const progress = Math.min(Math.max(-rect.top / (rect.height - viewportHeight), 0), 1)

      setTranslateX(-progress * maxScroll)

      // Last 25% of the horizontal travel: keep sliding right while easing
      // downward, so the exit reads as "moving right, then down" into the
      // next section instead of a flat cut.
      const EXIT_START = 0.75
      const exitT = Math.min(Math.max((progress - EXIT_START) / (1 - EXIT_START), 0), 1)
      const eased = exitT * exitT * (3 - 2 * exitT) // smoothstep
      setExitY(eased * 120)
      setExitOpacity(1 - eased * 0.3)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [sectionHeight])

  return (
    <section
      ref={sectionRef}
      id="activities"
      className="sports-scroll-section"
      style={{ height: sectionHeight || undefined }}
    >
      <div
        className="sports-scroll-sticky"
        style={{ transform: `translateY(${exitY}px)`, opacity: exitOpacity }}
      >
        <p className="sports-scroll-heading">Pick the things you're into, we'll find your people.</p>
        <div
          ref={trackRef}
          className="sports-scroll-track"
          style={{ transform: `translateX(${translateX}px)` }}
        >
          {SPORTS.map(({ label, Icon, image, blurb }) => (
            <div
              className="sport-card"
              key={label}
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(8,6,13,0.15) 0%, rgba(8,6,13,0.75) 100%), url(${image})`
              }}
            >
              <div className="sport-card-icon-wrap">
                <Icon className="sport-card-icon" size={26} strokeWidth={1.5} />
              </div>
              <span className="sport-card-title">{label}</span>
              <p className="sport-card-blurb">{blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
