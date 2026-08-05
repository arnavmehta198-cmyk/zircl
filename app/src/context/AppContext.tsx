import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { supabase } from '../lib/supabase'
import { getUser } from '../services/users'
import type { PlanTier } from '../lib/types'

interface AppState {
  user: User | null
  loadingAuth: boolean
  /** null while unknown, then true/false — mirrors RootView's three-way gate. */
  hasCompletedOnboarding: boolean | null
  profile: { name: string | null; photoURL: string | null; hobbies: string[] }
  plan: PlanTier
  isPremium: boolean
  signOut: () => Promise<void>
  refreshOnboarding: () => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [hasCompletedOnboarding, setHasCompleted] = useState<boolean | null>(null)
  const [profile, setProfile] = useState({ name: null as string | null, photoURL: null as string | null, hobbies: [] as string[] })
  const [plan, setPlan] = useState<PlanTier>('free')
  const [nonce, setNonce] = useState(0)

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u)
    setLoadingAuth(false)
    if (!u) {
      setHasCompleted(null)
      setProfile({ name: null, photoURL: null, hobbies: [] })
      setPlan('free')
    }
  }), [])

  // An initial fetch plus a live Realtime subscription on the user row
  // drives onboarding state, profile, and plan.
  useEffect(() => {
    if (!user) return
    const uid = user.uid
    let cancelled = false

    function apply(row: {
      onboardingComplete: boolean; name: string | null; photoURL: string | null; hobbies: string[]
      plan?: PlanTier
    }) {
      if (cancelled) return
      setHasCompleted(row.onboardingComplete === true)
      setProfile({ name: row.name, photoURL: row.photoURL, hobbies: row.hobbies })
      setPlan(row.plan === 'premium' ? 'premium' : 'free')
    }

    void getUser(uid).then((row) => {
      if (!row) { if (!cancelled) setHasCompleted(false); return } // a failed/missing read means "not onboarded", same as iOS
      apply(row)
    })

    const channel = supabase
      .channel(`user-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (!row || Object.keys(row).length === 0) return
          apply({
            onboardingComplete: row.onboarding_complete === true,
            name: (row.name as string) ?? null,
            photoURL: (row.photo_url as string) || null,
            hobbies: (row.hobbies as string[]) ?? [],
            plan: (row.plan as PlanTier) ?? 'free',
          })
        },
      )
      .subscribe()

    return () => { cancelled = true; void supabase.removeChannel(channel) }
  }, [user, nonce])

  const value = useMemo<AppState>(() => ({
    user,
    loadingAuth,
    hasCompletedOnboarding,
    profile,
    plan,
    // Everyone gets full access — no paid tier is live yet. See PremiumScreen.
    isPremium: true,
    signOut: () => fbSignOut(auth),
    refreshOnboarding: () => setNonce((n) => n + 1),
  }), [user, loadingAuth, hasCompletedOnboarding, profile, plan])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp must be used inside AppProviders')
  return v
}

/** Convenience for screens that are only reachable while signed in. */
export function useUID(): string {
  const { user } = useApp()
  return user?.uid ?? ''
}
