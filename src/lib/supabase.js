const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const MESSAGES = {
  unconfigured: 'Waitlist isn’t connected yet. Try again later.',
  rate_limited: 'Too many attempts. Try again in a few minutes.',
  invalid_email: 'That email doesn’t look right.',
  generic: 'Something went wrong. Please try again.'
}

// Posts to the rate-limited Edge Function. Direct table inserts are blocked
// by RLS, so this is the only signup path.
export async function joinWaitlist(email) {
  if (!url || !anonKey) return { ok: false, message: MESSAGES.unconfigured }

  try {
    const res = await fetch(`${url}/functions/v1/join-waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey },
      body: JSON.stringify({ email })
    })

    if (res.ok) return { ok: true }

    const { error } = await res.json().catch(() => ({}))
    return { ok: false, message: MESSAGES[error] ?? MESSAGES.generic }
  } catch {
    return { ok: false, message: MESSAGES.generic }
  }
}
