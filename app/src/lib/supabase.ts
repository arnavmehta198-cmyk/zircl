import { createClient } from '@supabase/supabase-js'
import { auth } from './firebase'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// Firebase issues the identity; Supabase trusts it as a third-party JWT
// issuer (configured in Supabase dashboard: Authentication > Third Party
// Auth). RLS policies read auth.jwt()->>'sub' as the Firebase uid.
export const supabase = createClient(url, key, {
  accessToken: async () => auth.currentUser?.getIdToken() ?? null,
})
