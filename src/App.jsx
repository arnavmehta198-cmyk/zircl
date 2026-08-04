import { useEffect, useState } from 'react'
import Aurora from './components/Aurora'
import TextPressure from './components/TextPressure'
import About from './components/About'
import CircleFloatScroll from './components/CircleFloatScroll'
import SportsScroll from './components/SportsScroll'
import ScrollVideo from './components/ScrollVideo'
import LiveStats from './components/LiveStats'
import Waitlist from './components/Waitlist'
import SectionBlend from './components/SectionBlend'
import './App.css'

// Several sections below run their own scroll listener on every 'scroll'
// event (sticky scroll-jacked sections) and setState each time. A native
// smooth-scroll animation fires dozens of scroll events as it animates,
// and those listeners re-rendering mid-flight reliably cancels the
// animation (browsers abort smooth scrolling once something else appears
// to be fighting the scroll position) — the page silently never moves.
// Instant jump sidesteps that entirely.
function scrollToSection(e) {
  const href = e.currentTarget.getAttribute('href')
  if (!href?.startsWith('#')) return
  const el = document.querySelector(href)
  if (!el) return
  e.preventDefault()
  el.scrollIntoView({ behavior: 'instant', block: 'start' })
}

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
      <nav className="top-nav">
        <a className="top-nav-brand" href="#center" onClick={scrollToSection}>
          ZIRCL
        </a>
        <div className="top-nav-links">
          <a href="#about" onClick={scrollToSection}>
            About
          </a>
          <a href="#activities" onClick={scrollToSection}>
            Activities
          </a>
          <a href="#stats" onClick={scrollToSection}>
            Live
          </a>
          <a href="#waitlist" className="top-nav-cta" onClick={scrollToSection}>
            Join waitlist
          </a>
        </div>
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

      <SectionBlend from="#ffffff" to="#2b2a22" />

      <About />

      <SectionBlend from="#2b2a22" to="#BFD7F5" />

      <CircleFloatScroll />

      <SectionBlend from="#FCE8A8" to="#C9A87C" />

      <SportsScroll />

      <SectionBlend from="#C9A87C" to="#08060d" />

      <ScrollVideo />

      <LiveStats />

      <Waitlist />
    </>
  )
}

export default App
