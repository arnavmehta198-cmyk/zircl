import { Users } from 'lucide-react'
import './About.css'

const LONELY_ICONS = Array.from({ length: 5 })
const SUPPORT_ICONS = Array.from({ length: 10 })

export default function About() {
  return (
    <section id="about" className="about">
      <div className="about-inner">
        <span className="about-eyebrow">Why Zircl exists</span>
        <h2 className="about-title">We're here to solve loneliness.</h2>
        <p className="about-body">
          Real connection is harder to find than it should be. Zircl exists to make it easy again —
          matching you with people nearby who actually share what you're into, so meeting up stops
          being the hard part.
        </p>

        <div className="about-stats">
          <div className="about-stat">
            <div className="about-stat-figure">
              <span className="about-stat-number lonely">1 in 5</span>
              <span className="about-stat-label">people feel lonely every day.</span>
            </div>
            <div className="about-stat-icons">
              {LONELY_ICONS.map((_, i) => (
                <Users key={i} className={i === 0 ? 'icon-active lonely' : 'icon-dim'} size={28} strokeWidth={1.5} />
              ))}
            </div>
          </div>

          <div className="about-stat">
            <div className="about-stat-figure">
              <span className="about-stat-number support">7 in 10</span>
              <span className="about-stat-label">say they lack enough emotional support.</span>
            </div>
            <div className="about-stat-icons">
              {SUPPORT_ICONS.map((_, i) => (
                <Users key={i} className={i < 7 ? 'icon-active support' : 'icon-dim'} size={28} strokeWidth={1.5} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
