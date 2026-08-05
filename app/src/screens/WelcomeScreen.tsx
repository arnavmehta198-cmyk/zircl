import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithPopup } from 'firebase/auth'
import { motion, useReducedMotion } from 'motion/react'
import Lenis from 'lenis'
import { auth, googleProvider } from '../lib/firebase'
import { Button, EASE, OrbitMark } from '../components/ui'

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

    </div>
  )
}
