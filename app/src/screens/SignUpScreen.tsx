import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { Eye, EyeOff } from 'lucide-react'
import { auth } from '../lib/firebase'
import { Button, Field, OrbitMark, TextField } from '../components/ui'
import GoogleButton from '../components/GoogleButton'

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

export default function SignUpScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ready = name.trim().length > 0 && email.trim().length > 0 && password.length >= 6

  async function submit() {
    if (!ready) return
    setError('')
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: name.trim() })
    } catch (e) {
      if ((e as { code?: string })?.code !== 'auth/popup-closed-by-user') setError(authErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full grid place-items-center bg-page p-3">
      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 bg-surface border border-line rounded-card overflow-hidden shadow-card">
        {/* left: the form */}
        <div className="flex flex-col justify-center px-6 sm:px-12 py-14 lg:py-10">
          <div className="w-full max-w-sm mx-auto">
            <Link to="/welcome" className="inline-flex items-center gap-2.5 group">
              <OrbitMark size={36} />
            </Link>

            <h1 className="mt-7 text-[26px] font-display font-extrabold tracking-[-0.01em] leading-tight">
              Create your account
            </h1>
            <p className="text-[14.5px] text-ink-2 mt-1.5">Let's get you set up on Zircl.</p>

            <form
              className="mt-8 flex flex-col gap-4"
              onSubmit={(e) => { e.preventDefault(); void submit() }}
            >
              <TextField
                label="Name"
                value={name}
                onChange={setName}
                placeholder="Your name"
                autoComplete="name"
              />
              <TextField
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                type="email"
                inputMode="email"
                autoComplete="email"
              />

              <Field label="Password" hint="At least 6 characters.">
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full h-11 pl-3.5 pr-10 rounded-field border border-line bg-dusk-800 text-[15px] text-ink
                               placeholder:text-ink-3 outline-none transition
                               focus:border-azure focus:ring-[3px] focus:ring-azure-dim"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
                  </button>
                </div>
              </Field>

              {error && <p className="text-[13px] text-danger">{error}</p>}

              <Button type="submit" size="lg" fullWidth isLoading={loading} disabled={!ready}>
                Create account
              </Button>
              <GoogleButton onError={setError} />
            </form>

            <div className="mt-7 text-center text-[13.5px] text-ink-2">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-azure hover:underline">
                Log in
              </Link>
            </div>

            <p className="mt-8 text-center text-[12.5px] text-ink-3">
              By creating an account you agree to our{' '}
              <Link to="/privacy" className="hover:text-ink-2 underline underline-offset-2 transition-colors">
                Privacy Policy
              </Link>.
            </p>
          </div>
        </div>

        {/* right: the visual */}
        <div className="hidden lg:block relative bg-dusk-950">
          <img src="/app/spirals.webp" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-deep/30 via-transparent to-transparent" />
        </div>
      </div>
    </div>
  )
}
