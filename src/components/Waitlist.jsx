import { useState } from 'react'
import { joinWaitlist } from '../lib/supabase'
import './Waitlist.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Client-side cooldown between submissions. Not a security control on its
// own (trivially bypassed), just friction for casual abuse. Real rate
// limiting lives server-side — see supabase/functions/join-waitlist.
const COOLDOWN_MS = 10_000
const COOLDOWN_KEY = 'zircl:waitlist:last-submit'

export default function Waitlist() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Honeypot: hidden from humans, commonly auto-filled by naive bots.
  const [website, setWebsite] = useState('')

  const onSubmit = async e => {
    e.preventDefault()
    if (submitting) return

    const value = email.trim().toLowerCase()

    // Bot filled the hidden field — fake success, insert nothing.
    if (website) {
      setJoined(true)
      return
    }

    if (!value) {
      setError('Enter your email to join.')
      return
    }
    if (!EMAIL_RE.test(value)) {
      setError('That email doesn’t look right.')
      return
    }
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
    if (Date.now() - last < COOLDOWN_MS) {
      setError('Hang on a moment before trying again.')
      return
    }

    setError('')
    setSubmitting(true)
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()))

    const result = await joinWaitlist(value)
    setSubmitting(false)

    if (result.ok) {
      setJoined(true)
      return
    }
    setError(result.message)
  }

  return (
    <section className="waitlist" id="waitlist">
      <div className="waitlist-inner">
        <span className="waitlist-eyebrow">Launching soon</span>
        <h2 className="waitlist-title">Be first in the circle.</h2>

        {joined ? (
          <div className="waitlist-success" role="status">
            <span className="waitlist-check">✓</span>
            You&rsquo;re on the list. We&rsquo;ll email you at <strong>{email.trim()}</strong>.
          </div>
        ) : (
          <form className="waitlist-form" onSubmit={onSubmit} noValidate>
            {/* Honeypot — hidden from humans and screen readers. */}
            <input
              className="waitlist-hp"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={e => setWebsite(e.target.value)}
            />
            <div className="waitlist-field">
              <label className="waitlist-label" htmlFor="waitlist-email">
                Email address
              </label>
              <input
                id="waitlist-email"
                className={`waitlist-input ${error ? 'has-error' : ''}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'waitlist-error' : undefined}
                disabled={submitting}
              />
            </div>
            <button className="waitlist-button" type="submit" disabled={submitting}>
              {submitting ? 'Joining…' : 'Join the waitlist'}
            </button>
          </form>
        )}

        {error && (
          <p className="waitlist-error" id="waitlist-error" role="alert">
            {error}
          </p>
        )}

        {!joined && <p className="waitlist-fine">No spam. Just one email when we launch.</p>}
      </div>
    </section>
  )
}
