// Rate-limited waitlist signup.
//
// The browser can no longer insert directly (see migration: the anon INSERT
// policy is dropped). All signups come through here, where we can enforce
// a per-IP limit using the service_role key.
//
// Deploy:  supabase functions deploy join-waitlist --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MAX_PER_WINDOW = 5
const WINDOW_MINUTES = 15
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

function corsHeaders(origin: string | null) {
  // Explicit allowlist — never reflect an arbitrary origin.
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  })
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin)
  }

  let email: string
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    return json({ error: 'bad_request' }, 400, origin)
  }

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'invalid_email' }, 400, origin)
  }

  // Supabase sets x-forwarded-for at the edge; a client-supplied value
  // cannot override the leftmost entry it appends.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: allowed, error: rlError } = await admin.rpc('check_waitlist_rate_limit', {
    p_ip: ip,
    p_max: MAX_PER_WINDOW,
    p_window_minutes: WINDOW_MINUTES
  })

  if (rlError) {
    console.error('rate limit check failed', rlError)
    return json({ error: 'server_error' }, 500, origin)
  }
  if (!allowed) {
    return json({ error: 'rate_limited' }, 429, origin)
  }

  const { error: insertError } = await admin.from('waitlist').insert({ email })

  if (insertError) {
    // Already signed up — treat as success, don't leak list membership.
    if (insertError.code === '23505') {
      return json({ ok: true }, 200, origin)
    }
    console.error('insert failed', insertError)
    return json({ error: 'server_error' }, 500, origin)
  }

  return json({ ok: true }, 200, origin)
})
