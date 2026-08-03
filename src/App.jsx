import { useEffect, useState } from 'react'
import Aurora from './components/Aurora'
import TextPressure from './components/TextPressure'
import CircleFloatScroll from './components/CircleFloatScroll'
import SportsScroll from './components/SportsScroll'
import ScrollVideo from './components/ScrollVideo'
import LiveStats from './components/LiveStats'
import Waitlist from './components/Waitlist'
import SectionBlend from './components/SectionBlend'
import './App.css'

function getZirclFontSize(width) {
  // Below desktop, let TextPressure's own width-based formula size the
  // text (keeps it fit-to-container). Only force the oversized dramatic
  // floor once there's enough width for it to not overflow.
  if (width < 1024) return 40
  return 672
}

function App() {
  const [zirclFontSize, setZirclFontSize] = useState(() =>
    typeof window === 'undefined' ? 672 : getZirclFontSize(window.innerWidth)
  )
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  )

  useEffect(() => {
    const onResize = () => {
      setZirclFontSize(getZirclFontSize(window.innerWidth))
      setIsDesktop(window.innerWidth >= 1024)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
      <nav className="glass-nav">
        <span className="glass-nav-brand">ZIRCL</span>
      </nav>

      <section id="center" className="hero-section">
        <div className="hero-aurora">
          <Aurora
            colorStops={["#14d406", "#cf9a97", "#EAB308"]}
            blend={0.9}
            amplitude={0.4}
            speed={0.2}
          />
        </div>
        <div className="hero-content">
          <div className="zircl-title">
            <TextPressure
              text="ZIRCL"
              flex={true}
              alpha={false}
              stroke={false}
              width={isDesktop}
              weight={isDesktop}
              italic={isDesktop}
              textColor="#08060d"
              minFontSize={zirclFontSize}
            />
          </div>
        </div>
      </section>

      <SectionBlend from="#ffffff" to="#BFD7F5" />

      <CircleFloatScroll />

      <SectionBlend from="#FCE8A8" to="#C9A87C" />

      <SportsScroll />

      <SectionBlend from="#C9A87C" to="#08060d" />

      <ScrollVideo />

      <SectionBlend from="#08060d" to="#F5F1E6" />

      <LiveStats />

      <Waitlist />
    </>
  )
}

export default App
