import type { ViewedPerson } from '../lib/types'

// The iOS app keeps these in UserDefaults (per-device, not Firestore).
// localStorage is the direct web equivalent — same keys, same defaults.

const KEYS = {
  prioritizeHobbies: 'algo_prioritizeHobbies',
  prioritizeNearby: 'algo_prioritizeNearby',
  maxDistance: 'algo_maxDistance',
}

export interface AlgorithmSettings {
  prioritizeHobbies: boolean
  prioritizeNearby: boolean
  maxDistance: number
}

export function loadAlgorithmSettings(): AlgorithmSettings {
  const bool = (k: string, dflt: boolean) => {
    const v = localStorage.getItem(k)
    return v === null ? dflt : v === 'true'
  }
  return {
    prioritizeHobbies: bool(KEYS.prioritizeHobbies, true),
    prioritizeNearby: bool(KEYS.prioritizeNearby, true),
    maxDistance: Number(localStorage.getItem(KEYS.maxDistance) ?? 25),
  }
}

export function saveAlgorithmSettings(s: AlgorithmSettings) {
  localStorage.setItem(KEYS.prioritizeHobbies, String(s.prioritizeHobbies))
  localStorage.setItem(KEYS.prioritizeNearby, String(s.prioritizeNearby))
  localStorage.setItem(KEYS.maxDistance, String(s.maxDistance))
}

// ---------- recently viewed (max 40, most recent first) ----------

const MAX_VIEWED = 40
const viewedKey = (uid: string) => `recentlyViewed_${uid}`

export function loadRecentlyViewed(uid: string): ViewedPerson[] {
  try {
    return JSON.parse(localStorage.getItem(viewedKey(uid)) ?? '[]') as ViewedPerson[]
  } catch {
    return []
  }
}

export function recordViewed(uid: string, person: ViewedPerson) {
  const list = loadRecentlyViewed(uid).filter((p) => p.id !== person.id)
  list.unshift(person)
  localStorage.setItem(viewedKey(uid), JSON.stringify(list.slice(0, MAX_VIEWED)))
}
