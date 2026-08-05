import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import Lenis from 'lenis'
import { auth, googleProvider } from '../lib/firebase'
import { Button, EASE, OrbitMark } from '../components/ui'
import { HOBBIES } from '../lib/types'

// three.js is heavy — code-split so only the landing pays for it.
const Hero3D = lazy(() => import('../components/Hero3D'))

// Port of AuthViewModel.message(for:) — the copy is user-facing and exact.
function authErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string }
  switch (err?.code) {
    case 'auth/invalid-email': return "That email address doesn't look right."
    case 'auth/email-already-in-use': return 'An account with this email already exists.'
    case 'auth/weak-password': return 'Password must be at least 6 characters.'
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-credential': return 'Incorrect email or password.'
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.'
    default: return err?.message ?? 'Something went wrong.'
  }
}

const isPopupCancel = (e: unknown) => (e as { code?: string })?.code === 'auth/popup-closed-by-user'

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-2.8-.4-4.1H24v7.5h12.7c-.3 2.1-1.6 5.3-4.7 7.4l7.2 5.6c4.3-4 6.9-9.8 6.9-16.4z" />
      <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 010-9.2l-7.9-6.2a24 24 0 000 21.6l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.4-8.7 2.4-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/** Each display line rises out of its own clip mask (one line per thought). */
function MaskedLines({ lines, delay = 0 }: { lines: { text: string; azure?: string }[]; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <h1 className="text-[38px] sm:text-[50px] lg:text-[62px] font-display font-extrabold
                   tracking-[-0.02em] leading-[1.08]">
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
          <motion.span
            className="block"
            initial={reduce ? { opacity: 0 } : { y: '105%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            transition={{ delay: delay + i * 0.1, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            {l.azure
              ? <>{l.text}<span className="text-azure">{l.azure}</span></>
              : l.text}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

const RISE = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
} as const

const STEPS = [
  { n: '01', title: 'Pick your hobbies', body: 'Tennis, board games, hiking — tell Zircl what you actually love doing.' },
  { n: '02', title: 'See who orbits nearby', body: 'Real people within a couple of miles who share them. Swipe, follow, match.' },
  { n: '03', title: 'Meet up for real', body: 'Schedule the game, join the club, put your phone away. That’s the point.' },
]

/**
 * The how-it-works sequence. A hairline trace draws itself down the left rail
 * as the section scrolls through the viewport — the "scan" progressing.
 */
function StepsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.55'] })
  const traceScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })

  return (
    <div ref={ref} className="mx-auto max-w-[1080px] px-6 lg:px-10 pb-24">
      <motion.div {...RISE} transition={{ duration: 0.5, ease: EASE }}>
        <div className="eyebrow mb-3">[ HOW IT WORKS ]</div>
        <h2 className="text-[30px] lg:text-[38px] font-display font-extrabold tracking-[-0.01em]">
          Three steps. Zero small talk.
        </h2>
      </motion.div>

      <div className="mt-10 relative">
        {/* scroll-driven trace down the number rail */}
        <motion.div
          aria-hidden
          className="absolute left-[10px] top-0 bottom-0 w-px bg-azure origin-top"
          style={{ scaleY: reduce ? 1 : traceScale }}
        />
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            className="grid grid-cols-[56px_minmax(0,280px)_1fr] max-sm:grid-cols-[56px_1fr] gap-x-6 gap-y-1 items-baseline
                       py-6 border-t border-line first:border-t-0"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.1, duration: 0.55, ease: EASE }}
          >
            <div className="font-mono text-[14px] font-medium text-ink-3 bg-page relative z-10 pr-2 w-fit">{s.n}</div>
            <h3 className="text-[19px] font-display font-medium">{s.title}</h3>
            <p className="text-[14.5px] text-ink-2 leading-relaxed max-sm:col-start-2">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const READOUTS = [
  '[ SCANNING — 2 MI RADIUS ]',
  `[ ${HOBBIES.length} HOBBIES INDEXED ]`,
  '[ 0 VIDEO CALLS — EVER ]',
]

export default function WelcomeScreen() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reduce = useReducedMotion()

  // Lenis smooth scroll — marketing page only.
  useEffect(() => {
    if (reduce) return
    const lenis = new Lenis({ duration: 1.1 })
    let raf = 0
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); lenis.destroy() }
  }, [reduce])

  async function google() {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (!isPopupCancel(e)) setError(authErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full ambient overflow-x-clip">
      {/* ---- hero ---- */}
      <div className="mx-auto max-w-[1200px] px-6 lg:px-10 pt-8
                      grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-6 items-center lg:min-h-[88vh]">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <motion.div
            className="flex items-center gap-3 self-start"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <OrbitMark size={36} />
            <span className="text-[20px] font-display font-extrabold tracking-tight">Zircl</span>
          </motion.div>

          <div className="mt-10 lg:mt-14">
            <MaskedLines
              delay={0.1}
              lines={[
                { text: 'Your people are ', azure: 'closer' },
                { text: 'than you think.' },
              ]}
            />
          </div>

          <motion.p
            className="mt-6 text-[16px] lg:text-[17px] text-ink-2 leading-relaxed max-w-[46ch]"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
          >
            Zircl finds the tennis partners, hiking crews, and board-game rivals
            already around you — then gets you off the app and into the world.
          </motion.p>

          <motion.div
            className="mt-8 w-full max-w-sm flex flex-col gap-3"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.5, ease: EASE }}
          >
            {error && <div className="text-[13px] text-danger">{error}</div>}
            <Button size="lg" fullWidth onClick={() => navigate('/signup')}>
              Find your people
            </Button>
            <Button variant="secondary" fullWidth size="lg" onClick={google} isLoading={loading} icon={<GoogleG />}>
              Continue with Google
            </Button>
            <p className="text-[13.5px] text-ink-2 text-center">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-ink underline underline-offset-2 hover:text-azure-hover">
                Log in
              </Link>
            </p>
          </motion.div>
        </div>

        <div className="hidden lg:flex justify-center items-center relative">
          <Suspense fallback={null}>
            <Hero3D className="absolute -inset-16 pointer-events-none" />
          </Suspense>
        </div>
      </div>

      {/* ---- instrument readouts (no fabricated stats) ---- */}
      <motion.div {...RISE} transition={{ duration: 0.5, ease: EASE }} className="pb-20">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 px-6">
          {READOUTS.map((r) => (
            <span key={r} className="font-mono text-[12px] tracking-[0.08em] text-ink-2">{r}</span>
          ))}
        </div>
      </motion.div>

      {/* ---- how it works: a scan sequence with a scroll-driven trace ---- */}
      <StepsSection />

      {/* ---- final CTA ---- */}
      <div className="border-t border-line bg-surface">
        <div className="mx-auto max-w-[1080px] px-6 lg:px-10 py-20 text-center">
          <motion.div {...RISE} transition={{ duration: 0.5, ease: EASE }}>
            <h2 className="text-[28px] lg:text-[34px] font-display font-extrabold tracking-[-0.01em]">
              The best clubs are the ones you <span className="text-azure">show up to</span>.
            </h2>
            <div className="mt-7 flex justify-center">
              <Button size="lg" onClick={() => navigate('/signup')}>Join Zircl — it's free</Button>
            </div>
          </motion.div>

          <div className="mt-16 flex flex-col items-center gap-3 text-[12.5px] text-ink-3">
            <p className="max-w-[52ch]">
              Zircl is for meeting in person — first meetups happen in public spots.
            </p>
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} Zircl</span>
              <span aria-hidden>·</span>
              <Link to="/privacy" className="hover:text-ink-2 transition-colors">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
